import { NextResponse } from "next/server";

import { getMoviedleSupabaseAdmin } from "@/lib/supabase/moviedle";

export const runtime = "nodejs";

const isDateString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeTitle = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const title = String(payload?.title || "").trim();
    const puzzleDate = String(payload?.puzzleDate || "").trim();
    const stillUrls = Array.isArray(payload?.stillUrls) ? payload.stillUrls : [];
    const aliases = String(payload?.aliases || "")
      .split(",")
      .map((value: string) => value.trim())
      .filter(Boolean);
    const releaseYearRaw = String(payload?.releaseYear || "").trim();
    const summary = String(payload?.summary || "").trim();
    const leadActors = String(payload?.leadActors || "")
      .split(",")
      .map((value: string) => value.trim())
      .filter(Boolean);

    if (!title) {
      return NextResponse.json({ error: "Movie title is required" }, { status: 400 });
    }

    if (!isDateString(puzzleDate)) {
      return NextResponse.json({ error: "Puzzle date must be YYYY-MM-DD" }, { status: 400 });
    }

    const cleanStillUrls = stillUrls
      .map((url: unknown) => String(url || "").trim())
      .filter(Boolean)
      .slice(0, 6);

    if (cleanStillUrls.length < 1) {
      return NextResponse.json({ error: "At least one still image URL is required" }, { status: 400 });
    }

    const normalizedTitle = normalizeTitle(title);
    if (!normalizedTitle) {
      return NextResponse.json({ error: "Movie title is required" }, { status: 400 });
    }

    const normalizedAliases = aliases
      .map((alias) => normalizeTitle(alias))
      .filter((alias) => alias && alias !== normalizedTitle)
      .slice(0, 20);

    const parsedReleaseYear = Number(releaseYearRaw);
    const releaseYear = Number.isFinite(parsedReleaseYear) && parsedReleaseYear >= 1888 && parsedReleaseYear <= 2100
      ? Math.floor(parsedReleaseYear)
      : null;

    const supabase = getMoviedleSupabaseAdmin();

    const { data: movieRow, error: movieError } = await supabase
      .from("movies")
      .insert({
        title,
        title_normalized: normalizedTitle,
        aliases: aliases.slice(0, 20),
        aliases_normalized: normalizedAliases,
        still_urls: cleanStillUrls,
        release_year: releaseYear,
        summary: summary ? summary.slice(0, 4000) : null,
        lead_actors: leadActors.slice(0, 8),
      })
      .select("id")
      .maybeSingle();

    if (movieError) {
      throw new Error(`Failed to create movie: ${movieError.message}`);
    }

    if (!movieRow) {
      throw new Error("Failed to create movie record");
    }

    const { error: scheduleError } = await supabase
      .from("daily_schedule")
      .upsert({ puzzle_date: puzzleDate, movie_id: movieRow.id }, { onConflict: "puzzle_date" });

    if (scheduleError) {
      throw new Error(`Failed to schedule puzzle: ${scheduleError.message}`);
    }

    return NextResponse.json({ ok: true, movieId: movieRow.id, puzzleDate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create puzzle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
