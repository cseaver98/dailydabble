import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

import { NextResponse } from "next/server";
import { getDoodleSupabaseAdmin } from "@/lib/supabase/doodle";

export const runtime = "nodejs";

const STATUS_VALUES = ["pending", "approved"] as const;
const STORED_STATUS_VALUES = ["pending", "approved", "used"] as const;
type DoodleStatus = (typeof STATUS_VALUES)[number];
type StoredDoodleStatus = (typeof STORED_STATUS_VALUES)[number];

type ReviewStateRecord = {
  status: StoredDoodleStatus;
  updatedAt: string;
};

type ReviewState = Record<string, ReviewStateRecord>;

type StorageSvgItem = {
  slug: string;
  filename: string;
  updatedAt: string | null;
};

type ProcessedStageSegment =
  | string
  | {
      id?: string;
      d: string;
      to?: number;
      style?: Record<string, string>;
      fillOnly?: boolean;
      complete?: boolean;
      fullD?: string;
    };

type ProcessedDoodleRecord = {
  slug?: string;
  answer?: string;
  aliases?: string[];
  viewBox?: string;
  stageCount?: number;
  pathCount?: number;
  stages?: ProcessedStageSegment[][];
  stageParts?: ProcessedStageSegment[][];
};

const getDateInTimeZone = (timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
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
  const match = candidates.find((cwd) => existsSync(resolve(cwd, "apps/web/scripts/build-doodle-pipeline.mjs")));
  if (!match) {
    throw new Error("Could not locate the Doodle app directory");
  }
  return match;
};

const getRawDir = (): string => resolve(findRepoRoot(), "apps/web/content/doodle/raw");
const getProcessedDir = (): string => resolve(findRepoRoot(), "apps/web/content/doodle/processed");
const getPreviewDir = (): string => resolve(findRepoRoot(), "apps/web/content/doodle/previews");
const getReviewStatePath = (): string => resolve(findRepoRoot(), "apps/web/content/doodle/admin/review-state.json");

const storagePathForSlug = (slug: string): string =>
  DOODLE_STORAGE_PREFIX ? `${DOODLE_STORAGE_PREFIX}/${slug}.svg` : `${slug}.svg`;

const isValidStatus = (value: unknown): value is DoodleStatus =>
  typeof value === "string" && STATUS_VALUES.includes(value as DoodleStatus);

const isValidStoredStatus = (value: unknown): value is StoredDoodleStatus =>
  typeof value === "string" && STORED_STATUS_VALUES.includes(value as StoredDoodleStatus);

const normalizeAnswerText = (value: unknown): string =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normalizeAliases = (value: unknown): string[] => {
  const rawAliases = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((alias) => alias.trim());
  return Array.from(new Set(rawAliases.map((alias) => normalizeAnswerText(alias)).filter(Boolean)));
};

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
    if (!isValidStoredStatus(record.status)) {
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

const reorderArray = <T>(items: T[], fromIndex: number, toIndex: number): T[] => {
  const copy = [...items];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
};

const buildCumulativeStagesFromParts = (
  stageParts: Array<Array<string | { id?: string; d: string; to?: number; style?: Record<string, string>; fillOnly?: boolean; complete?: boolean; fullD?: string }>>,
) => {
  const state = new Map<string, { id?: string; d: string; [key: string]: unknown }>();
  return stageParts.map((stage) => {
    for (const segment of stage) {
      if (typeof segment === "string") {
        state.set(segment, { d: segment });
        continue;
      }
      const key = segment.id || segment.d;
      const previous = state.get(key) ?? null;
      state.set(key, {
        ...segment,
        d: previous ? `${String(previous.d || "")} ${String(segment.d || "")}`.trim() : String(segment.d || ""),
      });
    }
    return Array.from(state.values());
  });
};

const updateManifestStagesForSlug = (slug: string, nextStages: unknown): void => {
  const manifestPath = resolve(getProcessedDir(), "puzzles.generated.json");
  const parsed = readJsonFile<{
    generatedAt?: string;
    strategy?: string;
    stageCount?: number;
    items?: Array<Record<string, unknown> & { slug?: string }>;
  }>(manifestPath);

  if (!parsed || !Array.isArray(parsed.items)) {
    return;
  }

  let changed = false;
  const nextItems = parsed.items.map((item) => {
    if (item?.slug !== slug) {
      return item;
    }
    changed = true;
    return {
      ...item,
      stages: nextStages,
      stageCount: Array.isArray(nextStages) ? nextStages.length : item.stageCount,
    };
  });

  if (!changed) {
    return;
  }

  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: parsed.generatedAt ?? new Date().toISOString(),
        strategy: parsed.strategy ?? "balanced",
        stageCount: parsed.stageCount ?? (Array.isArray(nextStages) ? nextStages.length : 5),
        items: nextItems,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
};

const updateManifestAnswerForSlug = (slug: string, answer: string, aliases: string[]): void => {
  const manifestPath = resolve(getProcessedDir(), "puzzles.generated.json");
  const parsed = readJsonFile<{
    generatedAt?: string;
    strategy?: string;
    stageCount?: number;
    items?: Array<Record<string, unknown> & { slug?: string }>;
  }>(manifestPath);

  if (!parsed || !Array.isArray(parsed.items)) {
    return;
  }

  let changed = false;
  const nextItems = parsed.items.map((item) => {
    if (item?.slug !== slug) {
      return item;
    }
    changed = true;
    return {
      ...item,
      answer,
      aliases,
    };
  });

  if (!changed) {
    return;
  }

  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: parsed.generatedAt ?? new Date().toISOString(),
        strategy: parsed.strategy ?? "balanced",
        stageCount: parsed.stageCount ?? 5,
        items: nextItems,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
};

const readProcessedSummary = (
  slug: string,
): { answer: string | null; aliases: string[]; stageCount: number; pathCount: number; viewBox: string | null } | null => {
  const processedPath = resolve(getProcessedDir(), `${slug}.json`);
  const parsed = readJsonFile<{ answer?: string; aliases?: string[]; stageCount?: number; pathCount?: number; viewBox?: string }>(processedPath);
  if (!parsed) {
    return null;
  }

  return {
    answer: typeof parsed.answer === "string" ? parsed.answer : null,
    aliases: Array.isArray(parsed.aliases) ? parsed.aliases.filter((alias): alias is string => typeof alias === "string") : [],
    stageCount: Number.isFinite(parsed.stageCount) ? Number(parsed.stageCount) : 0,
    pathCount: Number.isFinite(parsed.pathCount) ? Number(parsed.pathCount) : 0,
    viewBox: typeof parsed.viewBox === "string" ? parsed.viewBox : null,
  };
};

const readProcessedRecord = (slug: string): ProcessedDoodleRecord | null => {
  const processedPath = resolve(getProcessedDir(), `${slug}.json`);
  const parsed = readJsonFile<ProcessedDoodleRecord>(processedPath);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  return parsed;
};

const syncPuzzleStatus = async (slug: string, status: DoodleStatus): Promise<void> => {
  const supabase = getDoodleSupabaseAdmin();

  if (status === "pending") {
    await supabase.from("puzzles").update({ status }).eq("slug", slug);
    return;
  }

  const processed = readProcessedRecord(slug);
  if (
    !processed ||
    typeof processed.answer !== "string" ||
    typeof processed.viewBox !== "string" ||
    !Number.isFinite(processed.stageCount) ||
    !Number.isFinite(processed.pathCount) ||
    !Array.isArray(processed.stages)
  ) {
    throw new Error("Processed puzzle is required before approving. Run staging pipeline first.");
  }

  const aliases = Array.isArray(processed.aliases)
    ? processed.aliases.filter((alias): alias is string => typeof alias === "string" && alias.trim().length > 0)
    : [];

  const upsertPayload = {
    slug,
    answer: processed.answer.trim().toLowerCase(),
    aliases,
    view_box: processed.viewBox,
    stage_count: Number(processed.stageCount),
    path_count: Number(processed.pathCount),
    stages: processed.stages,
    status,
    source_filename: `${slug}.svg`,
  };

  const { error } = await supabase.from("puzzles").upsert(upsertPayload, { onConflict: "slug" });
  if (error) {
    throw new Error(`Could not sync puzzle status to Supabase: ${error.message}`);
  }
};

const getScheduleWarning = async (slug: string): Promise<string | null> => {
  const supabase = getDoodleSupabaseAdmin();
  const { data: puzzle, error: puzzleError } = await supabase
    .from("puzzles")
    .select("id")
    .eq("slug", slug)
    .maybeSingle<{ id: string }>();
  if (puzzleError) {
    throw new Error(`Could not check Doodle puzzle history: ${puzzleError.message}`);
  }
  if (!puzzle?.id) {
    return null;
  }
  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .eq("puzzle_id", puzzle.id)
    .order("puzzle_date", { ascending: true })
    .limit(1);
  if (error) {
    throw new Error(`Could not check Doodle schedule history: ${error.message}`);
  }
  const scheduledDate = data?.[0]?.puzzle_date;
  return scheduledDate ? `Heads up: this Doodle puzzle has already been scheduled or played (${scheduledDate}).` : null;
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

const listLocalRawSvgs = (): StorageSvgItem[] => {
  const rawDir = getRawDir();
  if (!existsSync(rawDir)) {
    return [];
  }

  return readdirSync(rawDir)
    .filter((filename) => filename.toLowerCase().endsWith(".svg"))
    .map((filename) => {
      const slug = basename(filename, ".svg");
      const fullPath = resolve(rawDir, filename);
      const stats = statSync(fullPath);

      return {
        slug,
        filename,
        updatedAt: stats.mtime.toISOString(),
      };
    });
};

const listAvailableSvgs = async (): Promise<StorageSvgItem[]> => {
  const merged = new Map<string, StorageSvgItem>();

  for (const item of listLocalRawSvgs()) {
    merged.set(item.slug, item);
  }

  for (const item of await listStorageSvgs()) {
    const existing = merged.get(item.slug);
    if (!existing) {
      merged.set(item.slug, item);
      continue;
    }

    merged.set(item.slug, {
      slug: item.slug,
      filename: item.filename || existing.filename,
      updatedAt: item.updatedAt || existing.updatedAt,
    });
  }

  return Array.from(merged.values());
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
  const supabase = getDoodleSupabaseAdmin();
  const reviewState = loadReviewState();
  const manifestSlugs = readManifestSlugs();
  const previewDir = getPreviewDir();
  const nowIso = new Date().toISOString();
  const storageFiles = await listAvailableSvgs();
  const today = getDateInTimeZone(process.env.TIMEZONE || "America/New_York");

  const { data: puzzleRows, error: puzzleRowsError } = await supabase
    .from("puzzles")
    .select("id,slug,status,answer,aliases");

  if (puzzleRowsError) {
    throw new Error(`Could not load doodle puzzle rows: ${puzzleRowsError.message}`);
  }

  const puzzlesBySlug = new Map<string, string>();
  const puzzleStatusesBySlug = new Map<string, DoodleStatus>();
  const puzzleAnswerBySlug = new Map<string, { answer: string | null; aliases: string[] }>();
  const puzzleIds: string[] = [];
  for (const row of ((puzzleRows as Array<{ id?: string; slug?: string; status?: string; answer?: string | null; aliases?: string[] | null }> | null) ?? [])) {
    if (typeof row.slug !== "string" || typeof row.id !== "string") {
      continue;
    }
    puzzlesBySlug.set(row.slug, row.id);
    if (isValidStatus(row.status)) {
      puzzleStatusesBySlug.set(row.slug, row.status);
    }
    puzzleAnswerBySlug.set(row.slug, {
      answer: typeof row.answer === "string" ? row.answer : null,
      aliases: Array.isArray(row.aliases) ? row.aliases.filter((alias): alias is string => typeof alias === "string") : [],
    });
    puzzleIds.push(row.id);
  }

  const scheduleDatesByPuzzleId = new Map<string, string[]>();
  if (puzzleIds.length > 0) {
    const { data: scheduleRows, error: scheduleRowsError } = await supabase
      .from("daily_schedule")
      .select("puzzle_id,puzzle_date")
      .in("puzzle_id", puzzleIds);

    if (scheduleRowsError) {
      throw new Error(`Could not load doodle schedule rows: ${scheduleRowsError.message}`);
    }

    for (const row of ((scheduleRows as Array<{ puzzle_id?: string; puzzle_date?: string }> | null) ?? [])) {
      if (typeof row.puzzle_id !== "string" || typeof row.puzzle_date !== "string") {
        continue;
      }
      const current = scheduleDatesByPuzzleId.get(row.puzzle_id) ?? [];
      current.push(row.puzzle_date);
      scheduleDatesByPuzzleId.set(row.puzzle_id, current);
    }
  }

  const items = storageFiles.map((file) => {
    const slug = file.slug;
    const processedSummary = readProcessedSummary(slug);
    const state = reviewState[slug] ?? { status: "pending" as DoodleStatus, updatedAt: nowIso };
    const puzzleId = puzzlesBySlug.get(slug) ?? null;
    const scheduleDates = puzzleId ? (scheduleDatesByPuzzleId.get(puzzleId) ?? []).sort((a, b) => a.localeCompare(b)) : [];
    const usedDates = scheduleDates.filter((date) => date <= today);
    const futureDates = scheduleDates.filter((date) => date > today);
    const latestUsedDate = usedDates.length > 0 ? usedDates[usedDates.length - 1] : null;
    const nextScheduledDate = futureDates.length > 0 ? futureDates[0] : null;
    const isUsedToday = scheduleDates.includes(today);
    const isFinished = Boolean(latestUsedDate);
    const scheduledPuzzleDate = latestUsedDate ?? nextScheduledDate;
    const storedStatus: DoodleStatus = state.status === "used" ? "approved" : state.status;
    const dbStatus = puzzleStatusesBySlug.get(slug) ?? null;
    const normalizedStatus: DoodleStatus = isFinished || scheduledPuzzleDate
      ? "approved"
      : dbStatus ?? storedStatus;
    const dbAnswer = puzzleAnswerBySlug.get(slug) ?? null;

    return {
      slug,
      filename: file.filename,
      answer: dbAnswer?.answer ?? processedSummary?.answer ?? normalizeAnswerText(slug),
      aliases: dbAnswer?.aliases ?? processedSummary?.aliases ?? [],
      status: normalizedStatus,
      lifecycleStatus: isUsedToday ? "today" : latestUsedDate ? "finished" : nextScheduledDate ? "scheduled" : "unscheduled",
      statusUpdatedAt: state.updatedAt,
      rawUpdatedAt: file.updatedAt,
      hasProcessed: Boolean(processedSummary),
      stageCount: processedSummary?.stageCount ?? 0,
      pathCount: processedSummary?.pathCount ?? 0,
      viewBox: processedSummary?.viewBox ?? null,
      previewReady: existsSync(resolve(previewDir, `${slug}.html`)),
      inManifest: manifestSlugs.has(slug),
      storagePath: storagePathForSlug(slug),
      scheduledPuzzleDate,
      isUsedToday,
      isFinished,
      nextScheduledDate,
      lastUsedPuzzleDate: latestUsedDate,
    };
  });

  const queueCounts = items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { pending: 0, approved: 0 },
  );

  const approvedTotal = items.filter((item) => item.status === "approved").length;
  const approvedProcessed = items.filter((item) => item.status === "approved" && item.hasProcessed && !item.isFinished).length;
  const approvedUnprocessed = items.filter((item) => item.status === "approved" && !item.hasProcessed && !item.isFinished).length;
  const pendingProcessed = items.filter((item) => item.status === "pending" && item.hasProcessed).length;
  const finished = items.filter((item) => item.isFinished).length;
  const scheduled = items.filter((item) => item.scheduledPuzzleDate).length;
  const lowQueueThreshold = Number(process.env.ADMIN_QUEUE_LOW_THRESHOLD ?? 3);

  const queueHealth = {
    runwayDays: approvedProcessed,
    approvedProcessed,
    approvedUnprocessed,
    approved: approvedTotal,
    scheduled,
    pending: queueCounts.pending,
    pendingProcessed,
    finished,
    total: items.length,
    lowQueueThreshold,
    isLow: approvedProcessed < lowQueueThreshold,
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
          stages?: Array<Array<string | { id?: string; d: string; to?: number; style?: Record<string, string>; fillOnly?: boolean; complete?: boolean; fullD?: string }>>;
          stageParts?: Array<Array<string | { id?: string; d: string; to?: number; style?: Record<string, string>; fillOnly?: boolean; complete?: boolean; fullD?: string }>>;
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
    const currentState = loadReviewState();
    const existingRawSvg = await downloadStorageSvg(slug);
    const localPath = resolve(getRawDir(), `${slug}.svg`);
    if (currentState[slug] || existingRawSvg || existsSync(localPath)) {
      return NextResponse.json(
        { duplicateWarning: "This Doodle filename already exists as another candidate." },
        { status: 409 },
      );
    }

    const content = Buffer.from(await file.arrayBuffer()).toString("utf8");
    if (!content.includes("<svg")) {
      return NextResponse.json({ error: "Uploaded file does not appear to be valid SVG" }, { status: 400 });
    }

    await uploadStorageSvg(slug, content);
    writeLocalRaw(slug, content);

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
    const payload = (await request.json()) as {
      slug?: string;
      status?: string;
      action?: string;
      answer?: string;
      aliases?: string[] | string;
      fromIndex?: number;
      toIndex?: number;
      confirmDuplicate?: boolean;
    };
    const normalizedSlug = normalizeSlug(payload.slug ?? "");
    if (!normalizedSlug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    if (payload.action === "reorderStages") {
      const fromIndex = Number(payload.fromIndex);
      const toIndex = Number(payload.toIndex);
      if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) {
        return NextResponse.json({ error: "fromIndex and toIndex must be integers" }, { status: 400 });
      }

      const processedPath = resolve(getProcessedDir(), `${normalizedSlug}.json`);
      const processed = readJsonFile<{
        slug?: string;
        answer?: string;
        aliases?: string[];
        viewBox?: string;
        stageCount?: number;
        pathCount?: number;
        strategy?: string;
        stages?: Array<Array<string | { id?: string; d: string; to?: number; style?: Record<string, string>; fillOnly?: boolean; complete?: boolean; fullD?: string }>>;
        stageParts?: Array<Array<string | { id?: string; d: string; to?: number; style?: Record<string, string>; fillOnly?: boolean; complete?: boolean; fullD?: string }>>;
      }>(processedPath);

      if (!processed || !Array.isArray(processed.stages)) {
        return NextResponse.json({ error: "Processed doodle stages not found. Run pipeline first." }, { status: 404 });
      }

      const reorderTarget = Array.isArray(processed.stageParts) && processed.stageParts.length > 0
        ? processed.stageParts
        : processed.stages;
      const stageCount = reorderTarget.length;
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= stageCount ||
        toIndex >= stageCount
      ) {
        return NextResponse.json({ error: "Stage index out of bounds" }, { status: 400 });
      }

      if (fromIndex !== toIndex) {
        processed.stageParts = reorderArray(reorderTarget, fromIndex, toIndex);
        processed.stages = buildCumulativeStagesFromParts(processed.stageParts);
      } else if (!Array.isArray(processed.stageParts) || processed.stageParts.length === 0) {
        processed.stageParts = processed.stages;
      }

      processed.stageCount = processed.stageParts?.length ?? processed.stages.length;
      writeFileSync(processedPath, `${JSON.stringify(processed, null, 2)}\n`, "utf8");
      updateManifestStagesForSlug(normalizedSlug, processed.stages);

      let rawSvg = await downloadStorageSvg(normalizedSlug);
      if (!rawSvg) {
        const localPath = resolve(getRawDir(), `${normalizedSlug}.svg`);
        if (existsSync(localPath)) {
          rawSvg = readFileSync(localPath, "utf8");
        }
      }

      return NextResponse.json({
        ok: true,
        item: {
          slug: normalizedSlug,
          rawSvg: rawSvg ?? "",
          processed,
        },
      });
    }

    if (payload.action === "updateAnswer") {
      const answer = normalizeAnswerText(payload.answer);
      const aliases = normalizeAliases(payload.aliases).filter((alias) => alias !== answer);
      if (!answer) {
        return NextResponse.json({ error: "Answer is required" }, { status: 400 });
      }

      const processedPath = resolve(getProcessedDir(), `${normalizedSlug}.json`);
      const processed = readProcessedRecord(normalizedSlug);
      if (!processed) {
        return NextResponse.json({ error: "Processed doodle file not found. Run pipeline first." }, { status: 404 });
      }

      const nextProcessed = {
        ...processed,
        answer,
        aliases,
      };
      writeFileSync(processedPath, `${JSON.stringify(nextProcessed, null, 2)}\n`, "utf8");
      updateManifestAnswerForSlug(normalizedSlug, answer, aliases);

      const supabase = getDoodleSupabaseAdmin();
      const { error: updateError } = await supabase
        .from("puzzles")
        .update({ answer, aliases })
        .eq("slug", normalizedSlug);
      if (updateError) {
        throw new Error(`Could not update doodle answer in Supabase: ${updateError.message}`);
      }

      const overview = await buildOverview();
      return NextResponse.json({ ok: true, ...overview });
    }

    if (!isValidStatus(payload.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    let rawSvg = await downloadStorageSvg(normalizedSlug);
    if (!rawSvg) {
      const localPath = resolve(getRawDir(), `${normalizedSlug}.svg`);
      if (existsSync(localPath)) {
        rawSvg = readFileSync(localPath, "utf8");
      }
    }

    if (!rawSvg) {
      return NextResponse.json({ error: "Doodle file not found" }, { status: 404 });
    }

    const warning = payload.status === "approved" ? await getScheduleWarning(normalizedSlug) : null;
    if (warning && payload.confirmDuplicate !== true) {
      return NextResponse.json({ duplicateWarning: warning }, { status: 409 });
    }
    await syncPuzzleStatus(normalizedSlug, payload.status);
    const state = loadReviewState();
    state[normalizedSlug] = {
      status: payload.status,
      updatedAt: new Date().toISOString(),
    };
    saveReviewState(state);

    const overview = await buildOverview();
    return NextResponse.json({ ok: true, warning, ...overview });
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

    let rawSvg = await downloadStorageSvg(normalizedSlug);
    if (!rawSvg) {
      const localPath = resolve(getRawDir(), `${normalizedSlug}.svg`);
      if (existsSync(localPath)) {
        rawSvg = readFileSync(localPath, "utf8");
      }
    }

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
