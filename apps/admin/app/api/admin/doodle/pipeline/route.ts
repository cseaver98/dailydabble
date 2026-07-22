import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { NextResponse } from "next/server";
import { getDoodleSupabaseAdmin } from "@/lib/supabase/doodle";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const DOODLE_STORAGE_BUCKET = process.env.DOODLE_STORAGE_BUCKET || "doodle-sources";
const DOODLE_STORAGE_PREFIX = (process.env.DOODLE_STORAGE_PREFIX || "raw").replace(/^\/+|\/+$/g, "");
const REQUIRED_STAGE_COUNT = 6;

const findRepoRoot = (): string => {
  const candidates = [process.cwd(), resolve(process.cwd(), ".."), resolve(process.cwd(), "../..")] as const;
  const match = candidates.find((cwd) => existsSync(resolve(cwd, "apps/web/scripts/build-doodle-pipeline.mjs")));
  if (!match) {
    throw new Error("Could not locate the Doodle app directory");
  }
  return match;
};

const storagePathForName = (name: string): string =>
  DOODLE_STORAGE_PREFIX ? `${DOODLE_STORAGE_PREFIX}/${name}` : name;

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

const syncStorageRawToDir = async (rawDir: string, slug?: string): Promise<number> => {
  await ensureStorageBucket();

  mkdirSync(rawDir, { recursive: true });

  for (const file of readdirSync(rawDir)) {
    if (file.toLowerCase().endsWith(".svg")) {
      rmSync(resolve(rawDir, file), { force: true });
    }
  }

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
  const svgNames = rows
    .map((item) => (typeof item?.name === "string" ? item.name : ""))
    .filter((name) => name.toLowerCase().endsWith(".svg"))
    .filter((name) => !slug || name.toLowerCase() === `${slug}.svg`);

  for (const name of svgNames) {
    const { data: blob, error: downloadError } = await supabase.storage
      .from(DOODLE_STORAGE_BUCKET)
      .download(storagePathForName(name));

    if (downloadError || !blob) {
      throw new Error(`Could not download ${name} from storage: ${downloadError?.message || "unknown error"}`);
    }

    const content = await blob.text();
    writeFileSync(resolve(rawDir, name), content, "utf8");
  }

  return svgNames.length;
};

type ProcessedDoodleRecord = {
  slug?: string;
  answer?: string;
  aliases?: string[];
  viewBox?: string;
  stageCount?: number;
  pathCount?: number;
  stages?: unknown[];
};

const runDoodlePipeline = async ({
  slug,
  inputDir,
  outputDir,
  previewDir,
}: {
  slug?: string;
  inputDir: string;
  outputDir: string;
  previewDir: string;
}): Promise<{ stdout: string; stderr: string; doodleDir: string }> => {
  const repoRoot = findRepoRoot();
  const doodleDir = resolve(repoRoot, "apps/web");
  const seed = Date.now();
  const args = [
    "scripts/build-doodle-pipeline.mjs",
    `--in=${inputDir}`,
    `--out=${outputDir}`,
    `--preview=${previewDir}`,
    `--stages=${REQUIRED_STAGE_COUNT}`,
    `--seed=${seed}`,
  ];
  if (slug) {
    args.push(`--slug=${slug}`);
  }

  const { stdout, stderr } = await execFileAsync("node", args, {
    cwd: doodleDir,
    env: process.env,
    maxBuffer: 1024 * 1024,
  });
  return { stdout: stdout.trim(), stderr: stderr.trim(), doodleDir };
};

const readManifestSummary = (outputDir: string): { itemCount: number; slugs: string[]; generatedAt: string | null } => {
  const manifestPath = resolve(outputDir, "puzzles.generated.json");
  if (!existsSync(manifestPath)) {
    return { itemCount: 0, slugs: [], generatedAt: null };
  }

  const raw = readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as { generatedAt?: string; items?: Array<{ slug?: string }> };
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const slugs = items
    .map((item) => (typeof item.slug === "string" ? item.slug : ""))
    .filter(Boolean);

  return {
    itemCount: slugs.length,
    slugs,
    generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : null,
  };
};

const readGeneratedRecords = (outputDir: string, slugs: string[]): ProcessedDoodleRecord[] =>
  slugs
    .map((slug) => {
      const path = resolve(outputDir, `${slug}.json`);
      if (!existsSync(path)) {
        return null;
      }
      return JSON.parse(readFileSync(path, "utf8")) as ProcessedDoodleRecord;
    })
    .filter((record): record is ProcessedDoodleRecord => Boolean(record?.slug));

const upsertGeneratedRecords = async (records: ProcessedDoodleRecord[]): Promise<number> => {
  if (records.length === 0) {
    return 0;
  }

  const supabase = getDoodleSupabaseAdmin();
  const slugs = records.map((record) => String(record.slug));
  const { data: existingRows, error: existingError } = await supabase
    .from("puzzles")
    .select("slug,status,answer,aliases")
    .in("slug", slugs)
    .returns<Array<{ slug: string; status?: string | null; answer?: string | null; aliases?: string[] | null }>>();
  if (existingError) {
    throw new Error(`Could not load existing Doodle puzzle rows: ${existingError.message}`);
  }

  const existingBySlug = new Map((existingRows ?? []).map((row) => [row.slug, row]));
  const payload = records.map((record) => {
    const slug = String(record.slug);
    const existing = existingBySlug.get(slug);
    return {
      slug,
      answer: (existing?.answer || record.answer || slug).trim().toLowerCase(),
      aliases: Array.isArray(existing?.aliases) ? existing.aliases : Array.isArray(record.aliases) ? record.aliases : [],
      view_box: typeof record.viewBox === "string" ? record.viewBox : "0 0 512 512",
      stage_count: Number.isFinite(record.stageCount) ? Number(record.stageCount) : Array.isArray(record.stages) ? record.stages.length : REQUIRED_STAGE_COUNT,
      path_count: Number.isFinite(record.pathCount) ? Number(record.pathCount) : 0,
      stages: Array.isArray(record.stages) ? record.stages : [],
      status: existing?.status || "pending",
      source_filename: `${slug}.svg`,
    };
  });

  const { error } = await supabase.from("puzzles").upsert(payload, { onConflict: "slug" });
  if (error) {
    throw new Error(`Could not save generated Doodle stages: ${error.message}`);
  }
  return payload.length;
};

export async function POST(request: Request) {
  let tempRoot = "";
  try {
    const payload = (await request.json().catch(() => ({}))) as { slug?: string };
    const normalizedSlug = typeof payload.slug === "string"
      ? payload.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")
      : "";
    findRepoRoot();
    tempRoot = mkdtempSync(join(tmpdir(), "doodle-pipeline-"));
    const inputDir = resolve(tempRoot, "raw");
    const outputDir = resolve(tempRoot, "processed");
    const previewDir = resolve(tempRoot, "previews");
    const syncedCount = await syncStorageRawToDir(inputDir, normalizedSlug || undefined);

    const { stdout, stderr } = await runDoodlePipeline({
      slug: normalizedSlug || undefined,
      inputDir,
      outputDir,
      previewDir,
    });
    const summary = readManifestSummary(outputDir);
    const generatedRecords = readGeneratedRecords(outputDir, summary.slugs);
    const savedCount = await upsertGeneratedRecords(generatedRecords);
    return NextResponse.json({
      ok: true,
      output: stdout || "Pipeline finished.",
      warnings: stderr || null,
      syncedFromStorage: syncedCount,
      savedToSupabase: savedCount,
      rerunSlug: normalizedSlug || null,
      summary,
    });
  } catch (error) {
    const details =
      error && typeof error === "object" && "stderr" in error && typeof (error as { stderr?: string }).stderr === "string"
        ? (error as { stderr?: string }).stderr
        : "";
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, details: details.trim() || message }, { status: 500 });
  } finally {
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}
