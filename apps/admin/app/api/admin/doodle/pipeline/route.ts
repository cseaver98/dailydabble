import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { exec } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { NextResponse } from "next/server";
import { getDoodleSupabaseAdmin } from "@/lib/supabase/doodle";

export const runtime = "nodejs";

const execAsync = promisify(exec);

const DOODLE_STORAGE_BUCKET = process.env.DOODLE_STORAGE_BUCKET || "doodle-sources";
const DOODLE_STORAGE_PREFIX = (process.env.DOODLE_STORAGE_PREFIX || "raw").replace(/^\/+|\/+$/g, "");

const findRepoRoot = (): string => {
  const candidates = [process.cwd(), resolve(process.cwd(), ".."), resolve(process.cwd(), "../..")] as const;
  const match = candidates.find((cwd) => existsSync(resolve(cwd, "apps/doodle/scripts/build-doodle-pipeline.mjs")));
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

const syncStorageRawToLocal = async (doodleDir: string): Promise<number> => {
  await ensureStorageBucket();

  const rawDir = resolve(doodleDir, "content/raw");
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
    .filter((name) => name.toLowerCase().endsWith(".svg"));

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

const runDoodlePipeline = async (): Promise<{ stdout: string; stderr: string; doodleDir: string }> => {
  const repoRoot = findRepoRoot();
  const doodleDir = resolve(repoRoot, "apps/doodle");
  const { stdout, stderr } = await execAsync("node scripts/build-doodle-pipeline.mjs", {
    cwd: doodleDir,
    env: process.env,
    maxBuffer: 1024 * 1024,
  });
  return { stdout: stdout.trim(), stderr: stderr.trim(), doodleDir };
};

const readManifestSummary = (doodleDir: string): { itemCount: number; slugs: string[]; generatedAt: string | null } => {
  const manifestPath = resolve(doodleDir, "content/processed/puzzles.generated.json");
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

export async function POST() {
  try {
    const repoRoot = findRepoRoot();
    const doodleDir = resolve(repoRoot, "apps/doodle");
    const syncedCount = await syncStorageRawToLocal(doodleDir);

    const { stdout, stderr } = await runDoodlePipeline();
    const summary = readManifestSummary(doodleDir);
    return NextResponse.json({
      ok: true,
      output: stdout || "Pipeline finished.",
      warnings: stderr || null,
      syncedFromStorage: syncedCount,
      summary,
    });
  } catch (error) {
    const details =
      error && typeof error === "object" && "stderr" in error && typeof (error as { stderr?: string }).stderr === "string"
        ? (error as { stderr?: string }).stderr
        : "";
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, details: details.trim() || message }, { status: 500 });
  }
}
