import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { NextResponse } from "next/server";
import { getDoodleSupabaseAdmin } from "@/lib/supabase/doodle";

export const runtime = "nodejs";

type ProcessedDoodleRecord = {
  slug: string;
  answer: string;
  aliases?: string[];
  viewBox: string;
  stageCount: number;
  pathCount: number;
  stages: string[][];
};

type ReviewStateRecord = {
  status: "pending" | "approved" | "used";
  updatedAt: string;
};

type ReviewState = Record<string, ReviewStateRecord>;

const findRepoRoot = (): string => {
  const candidates = [process.cwd(), resolve(process.cwd(), ".."), resolve(process.cwd(), "../..")];
  const match = candidates.find((cwd) => existsSync(resolve(cwd, "apps/doodle/scripts/build-doodle-pipeline.mjs")));
  if (!match) {
    throw new Error("Could not locate the Doodle app directory");
  }
  return match;
};

const normalizeSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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
    throw new Error("Failed to compute date in timezone");
  }

  return `${year}-${month}-${day}`;
};

const addDays = (date: string, days: number): string => {
  const base = new Date(`${date}T00:00:00Z`);
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
};

const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const getReviewStatePath = (): string => resolve(findRepoRoot(), "apps/doodle/content/admin/review-state.json");

const loadReviewState = (): ReviewState => {
  const statePath = getReviewStatePath();
  if (!existsSync(statePath)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(statePath, "utf8")) as ReviewState;
  } catch {
    return {};
  }
};

const saveReviewState = (state: ReviewState): void => {
  const statePath = getReviewStatePath();
  mkdirSync(resolve(statePath, ".."), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};

const getProcessedRecord = (slug: string): ProcessedDoodleRecord => {
  const processedPath = resolve(findRepoRoot(), "apps/doodle/content/processed", `${slug}.json`);
  if (!existsSync(processedPath)) {
    throw new Error(`Missing processed puzzle for "${slug}". Run staging pipeline first.`);
  }

  const parsed = JSON.parse(readFileSync(processedPath, "utf8")) as ProcessedDoodleRecord;
  if (!parsed || typeof parsed !== "object" || !parsed.answer || !Array.isArray(parsed.stages)) {
    throw new Error(`Invalid processed puzzle JSON for "${slug}"`);
  }
  return parsed;
};

const getNextScheduleDate = async (preferredDate: string | null): Promise<string> => {
  if (preferredDate) {
    if (!isDateString(preferredDate)) {
      throw new Error("publishDate must be in YYYY-MM-DD format");
    }
    return preferredDate;
  }

  const supabase = getDoodleSupabaseAdmin();
  const today = getDateInTimeZone(process.env.PUZZLE_TIMEZONE || "America/New_York");
  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .order("puzzle_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load latest schedule date: ${error.message}`);
  }

  const latest = data?.puzzle_date ?? null;
  if (!latest) {
    return today;
  }

  if (latest >= today) {
    return addDays(latest, 1);
  }
  return today;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { slug?: string; publishDate?: string | null };
    const slug = normalizeSlug(payload.slug ?? "");
    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const publishDate = await getNextScheduleDate(payload.publishDate ?? null);
    const processed = getProcessedRecord(slug);
    const supabase = getDoodleSupabaseAdmin();

    const upsertPayload = {
      slug,
      answer: processed.answer,
      aliases: Array.isArray(processed.aliases) ? processed.aliases : [],
      view_box: processed.viewBox,
      stage_count: processed.stageCount,
      path_count: processed.pathCount,
      stages: processed.stages,
      status: "used",
      source_filename: `${slug}.svg`,
    };

    const { data: upserted, error: upsertError } = await supabase
      .from("puzzles")
      .upsert(upsertPayload, { onConflict: "slug" })
      .select("id,slug")
      .single();

    if (upsertError) {
      throw new Error(`Failed to upsert puzzle: ${upsertError.message}`);
    }

    const puzzleId = upserted.id;
    const { error: scheduleError } = await supabase.from("daily_schedule").insert({
      puzzle_date: publishDate,
      puzzle_id: puzzleId,
    });

    if (scheduleError) {
      if (scheduleError.code === "23505") {
        return NextResponse.json(
          { error: `Date ${publishDate} already has a scheduled doodle.` },
          { status: 409 },
        );
      }
      throw new Error(`Failed to schedule puzzle: ${scheduleError.message}`);
    }

    const reviewState = loadReviewState();
    reviewState[slug] = { status: "used", updatedAt: new Date().toISOString() };
    saveReviewState(reviewState);

    return NextResponse.json({
      ok: true,
      slug,
      publishDate,
      puzzleId,
      message: `Published "${slug}" for ${publishDate}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not publish doodle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
