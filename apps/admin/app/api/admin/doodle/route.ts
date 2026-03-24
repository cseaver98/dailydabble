import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

import { NextResponse } from "next/server";
import { getDoodleSupabaseAdmin } from "@/lib/supabase/doodle";

export const runtime = "nodejs";

const STATUS_VALUES = ["pending", "approved", "used"] as const;
type DoodleStatus = (typeof STATUS_VALUES)[number];

type ReviewStateRecord = {
  status: DoodleStatus;
  updatedAt: string;
};

type ReviewState = Record<string, ReviewStateRecord>;

type StorageSvgItem = {
  slug: string;
  filename: string;
  updatedAt: string | null;
};

const DOODLE_STORAGE_BUCKET = process.env.DOODLE_STORAGE_BUCKET || "doodle-sources";
const DOODLE_STORAGE_PREFIX = (process.env.DOODLE_STORAGE_PREFIX || "raw").replace(/^\/+|\/+$/g, "");

const normalizeSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const findRepoRoot = (): string => {
  const candidates = [process.cwd(), resolve(process.cwd(), ".."), resolve(process.cwd(), "../..")] as const;
  const match = candidates.find((cwd) => existsSync(resolve(cwd, "apps/doodle/scripts/build-doodle-pipeline.mjs")));
  if (!match) {
    throw new Error("Could not locate the Doodle app directory");
  }
  return match;
};

const getRawDir = (): string => resolve(findRepoRoot(), "apps/doodle/content/raw");
const getProcessedDir = (): string => resolve(findRepoRoot(), "apps/doodle/content/processed");
const getPreviewDir = (): string => resolve(findRepoRoot(), "apps/doodle/content/previews");
const getReviewStatePath = (): string => resolve(findRepoRoot(), "apps/doodle/content/admin/review-state.json");

const storagePathForSlug = (slug: string): string =>
  DOODLE_STORAGE_PREFIX ? `${DOODLE_STORAGE_PREFIX}/${slug}.svg` : `${slug}.svg`;

const isValidStatus = (value: unknown): value is DoodleStatus =>
  typeof value === "string" && STATUS_VALUES.includes(value as DoodleStatus);

const readJsonFile = <T>(path: string): T | null => {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const loadReviewState = (): ReviewState => {
  const statePath = getReviewStatePath();
  const parsed = readJsonFile<ReviewState>(statePath);
  if (!parsed || typeof parsed !== "object") {
    return {};
  }

  const result: ReviewState = {};
  for (const [slug, entry] of Object.entries(parsed)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Partial<ReviewStateRecord>;
    if (!isValidStatus(record.status)) {
      continue;
    }
    result[slug] = {
      status: record.status,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date(0).toISOString(),
    };
  }
  return result;
};

const saveReviewState = (state: ReviewState): void => {
  const statePath = getReviewStatePath();
  mkdirSync(resolve(statePath, ".."), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};

const readManifestSlugs = (): Set<string> => {
  const manifestPath = resolve(getProcessedDir(), "puzzles.generated.json");
  const parsed = readJsonFile<{ items?: Array<{ slug?: string }> }>(manifestPath);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return new Set(items.map((item) => (typeof item.slug === "string" ? item.slug : "")).filter(Boolean));
};

const readProcessedSummary = (
  slug: string,
): { stageCount: number; pathCount: number; viewBox: string | null } | null => {
  const processedPath = resolve(getProcessedDir(), `${slug}.json`);
  const parsed = readJsonFile<{ stageCount?: number; pathCount?: number; viewBox?: string }>(processedPath);
  if (!parsed) {
    return null;
  }

  return {
    stageCount: Number.isFinite(parsed.stageCount) ? Number(parsed.stageCount) : 0,
    pathCount: Number.isFinite(parsed.pathCount) ? Number(parsed.pathCount) : 0,
    viewBox: typeof parsed.viewBox === "string" ? parsed.viewBox : null,
  };
};

const ensureStorageBucket = async () => {
  const supabase = getDoodleSupabaseAdmin();
  const { error } = await supabase.storage.createBucket(DOODLE_STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/svg+xml", "text/plain"],
  });

  if (error && !String(error.message || "").toLowerCase().includes("already exists")) {
    throw new Error(`Could not ensure doodle storage bucket: ${error.message}`);
  }
};

const listStorageSvgs = async (): Promise<StorageSvgItem[]> => {
  await ensureStorageBucket();

  const supabase = getDoodleSupabaseAdmin();
  const { data, error } = await supabase.storage.from(DOODLE_STORAGE_BUCKET).list(DOODLE_STORAGE_PREFIX || undefined, {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    throw new Error(`Could not list doodle storage files: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows
    .filter((item) => typeof item?.name === "string" && item.name.toLowerCase().endsWith(".svg"))
    .map((item) => {
      const filename = String(item.name);
      const slug = basename(filename, ".svg");
      return {
        slug,
        filename,
        updatedAt: typeof item.updated_at === "string" ? item.updated_at : null,
      };
    });
};

const downloadStorageSvg = async (slug: string): Promise<string | null> => {
  const supabase = getDoodleSupabaseAdmin();
  const { data, error } = await supabase.storage.from(DOODLE_STORAGE_BUCKET).download(storagePathForSlug(slug));

  if (error || !data) {
    return null;
  }

  try {
    return await data.text();
  } catch {
    return null;
  }
};

const uploadStorageSvg = async (slug: string, content: string): Promise<void> => {
  await ensureStorageBucket();

  const supabase = getDoodleSupabaseAdmin();
  const { error } = await supabase.storage.from(DOODLE_STORAGE_BUCKET).upload(storagePathForSlug(slug), Buffer.from(content, "utf8"), {
    upsert: true,
    contentType: "image/svg+xml",
  });

  if (error) {
    throw new Error(`Could not upload doodle SVG to storage: ${error.message}`);
  }
};

const deleteStorageSvg = async (slug: string): Promise<void> => {
  const supabase = getDoodleSupabaseAdmin();
  const { error } = await supabase.storage.from(DOODLE_STORAGE_BUCKET).remove([storagePathForSlug(slug)]);
  if (error) {
    throw new Error(`Could not delete doodle SVG from storage: ${error.message}`);
  }
};

const writeLocalRaw = (slug: string, content: string): void => {
  const rawDir = getRawDir();
  mkdirSync(rawDir, { recursive: true });
  writeFileSync(resolve(rawDir, `${slug}.svg`), content, "utf8");
};

const buildOverview = async () => {
  const reviewState = loadReviewState();
  const manifestSlugs = readManifestSlugs();
  const previewDir = getPreviewDir();
  const nowIso = new Date().toISOString();
  const storageFiles = await listStorageSvgs();

  const items = storageFiles.map((file) => {
    const slug = file.slug;
    const processedSummary = readProcessedSummary(slug);
    const state = reviewState[slug] ?? { status: "pending" as DoodleStatus, updatedAt: nowIso };

    return {
      slug,
      filename: file.filename,
      status: state.status,
      statusUpdatedAt: state.updatedAt,
      rawUpdatedAt: file.updatedAt,
      hasProcessed: Boolean(processedSummary),
      stageCount: processedSummary?.stageCount ?? 0,
      pathCount: processedSummary?.pathCount ?? 0,
      viewBox: processedSummary?.viewBox ?? null,
      previewReady: existsSync(resolve(previewDir, `${slug}.html`)),
      inManifest: manifestSlugs.has(slug),
      storagePath: storagePathForSlug(slug),
    };
  });

  const queueCounts = items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { pending: 0, approved: 0, used: 0 },
  );

  const approvedProcessed = items.filter((item) => item.status === "approved" && item.hasProcessed).length;
  const approvedUnprocessed = items.filter((item) => item.status === "approved" && !item.hasProcessed).length;
  const pendingProcessed = items.filter((item) => item.status === "pending" && item.hasProcessed).length;
  const usedTotal = items.filter((item) => item.status === "used").length;

  const queueHealth = {
    runwayDays: approvedProcessed,
    approvedProcessed,
    approvedUnprocessed,
    pending: queueCounts.pending,
    pendingProcessed,
    used: usedTotal,
    total: items.length,
  };

  return {
    storageBucket: DOODLE_STORAGE_BUCKET,
    storagePrefix: DOODLE_STORAGE_PREFIX || null,
    items,
    queueCounts,
    queueHealth,
  };
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");

    if (slug) {
      const normalized = normalizeSlug(slug);
      if (!normalized) {
        return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
      }

      let rawSvg = await downloadStorageSvg(normalized);
      if (!rawSvg) {
        const localPath = resolve(getRawDir(), `${normalized}.svg`);
        if (existsSync(localPath)) {
          rawSvg = readFileSync(localPath, "utf8");
        }
      }

      if (!rawSvg) {
        return NextResponse.json({ error: "Doodle file not found" }, { status: 404 });
      }

      const processedPath = resolve(getProcessedDir(), `${normalized}.json`);
      const detail = {
        slug: normalized,
        rawSvg,
        processed: readJsonFile<{
          stageCount?: number;
          pathCount?: number;
          viewBox?: string;
          stages?: string[][];
        }>(processedPath),
      };

      return NextResponse.json({ ok: true, item: detail });
    }

    const overview = await buildOverview();
    return NextResponse.json({ ok: true, ...overview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load doodle SVG files";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file upload" }, { status: 400 });
    }

    const originalName = file.name || "doodle.svg";
    const extension = extname(originalName).toLowerCase();
    if (extension !== ".svg") {
      return NextResponse.json({ error: "Only SVG files are supported" }, { status: 400 });
    }

    const base = basename(originalName, extension);
    const slug = normalizeSlug(base);
    if (!slug) {
      return NextResponse.json({ error: "Invalid SVG filename" }, { status: 400 });
    }

    const content = Buffer.from(await file.arrayBuffer()).toString("utf8");
    if (!content.includes("<svg")) {
      return NextResponse.json({ error: "Uploaded file does not appear to be valid SVG" }, { status: 400 });
    }

    await uploadStorageSvg(slug, content);
    writeLocalRaw(slug, content);

    const currentState = loadReviewState();
    if (!currentState[slug]) {
      currentState[slug] = { status: "pending", updatedAt: new Date().toISOString() };
      saveReviewState(currentState);
    }

    const overview = await buildOverview();
    return NextResponse.json({ ok: true, savedAs: `${slug}.svg`, ...overview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload SVG";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as { slug?: string; status?: string };
    const normalizedSlug = normalizeSlug(payload.slug ?? "");
    if (!normalizedSlug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    if (!isValidStatus(payload.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const rawSvg = await downloadStorageSvg(normalizedSlug);
    if (!rawSvg) {
      return NextResponse.json({ error: "Doodle file not found" }, { status: 404 });
    }

    const state = loadReviewState();
    state[normalizedSlug] = {
      status: payload.status,
      updatedAt: new Date().toISOString(),
    };
    saveReviewState(state);

    const overview = await buildOverview();
    return NextResponse.json({ ok: true, ...overview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update doodle status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { slug?: string };
    const normalizedSlug = normalizeSlug(payload.slug ?? "");
    if (!normalizedSlug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const rawSvg = await downloadStorageSvg(normalizedSlug);
    if (!rawSvg) {
      return NextResponse.json({ error: "Doodle file not found" }, { status: 404 });
    }

    await deleteStorageSvg(normalizedSlug);

    const rawPath = resolve(getRawDir(), `${normalizedSlug}.svg`);
    if (existsSync(rawPath) && statSync(rawPath).isFile()) {
      unlinkSync(rawPath);
    }

    const processedPath = resolve(getProcessedDir(), `${normalizedSlug}.json`);
    if (existsSync(processedPath) && statSync(processedPath).isFile()) {
      unlinkSync(processedPath);
    }

    const previewPath = resolve(getPreviewDir(), `${normalizedSlug}.html`);
    if (existsSync(previewPath) && statSync(previewPath).isFile()) {
      unlinkSync(previewPath);
    }

    const state = loadReviewState();
    if (state[normalizedSlug]) {
      delete state[normalizedSlug];
      saveReviewState(state);
    }

    const overview = await buildOverview();
    return NextResponse.json({ ok: true, deletedSlug: normalizedSlug, ...overview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete doodle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
