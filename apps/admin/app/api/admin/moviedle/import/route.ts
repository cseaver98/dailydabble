import { NextResponse } from "next/server";
import { getMoviedleSupabaseAdmin } from "@/lib/supabase/moviedle";

export const runtime = "nodejs";

type OmdbDetail = {
  Response?: string;
  Error?: string;
  imdbID?: string;
  Title?: string;
  Year?: string;
  Plot?: string;
  Actors?: string;
  imdbVotes?: string;
};

const normalizeTitle = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const parseVotes = (value: string | undefined): number => {
  const raw = String(value || "").replace(/,/g, "").trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseReleaseYear = (value: string | undefined): number | null => {
  const match = String(value || "").match(/(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  if (!Number.isFinite(year) || year < 1888 || year > 2100) return null;
  return year;
};

const fetchOmdbByTitle = async (apiKey: string, title: string): Promise<OmdbDetail | null> => {
  const params = new URLSearchParams({
    apikey: apiKey,
    t: title,
    type: "movie",
    plot: "short",
  });
  const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`, { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as OmdbDetail;
  if (payload.Response !== "True") {
    return null;
  }
  return payload;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OMDB_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OMDB_API_KEY in env." }, { status: 400 });
    }

    const payload = await request.json().catch(() => ({}));
    const titlesText = String(payload?.titlesText || "");
    const minVotes = Number.isFinite(Number(payload?.minVotes)) ? Math.floor(Number(payload.minVotes)) : 0;

    const inputTitles = titlesText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 500);

    if (inputTitles.length === 0) {
      return NextResponse.json({ error: "Provide at least one movie title (one per line)." }, { status: 400 });
    }

    const supabase = getMoviedleSupabaseAdmin();

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const sourceTitle of inputTitles) {
      const detail = await fetchOmdbByTitle(apiKey, sourceTitle);
      if (!detail) {
        skipped += 1;
        errors.push(`Not found in OMDb: ${sourceTitle}`);
        continue;
      }

      const title = String(detail.Title || "").trim();
      const normalizedTitle = normalizeTitle(title || sourceTitle);
      const releaseYear = parseReleaseYear(detail.Year);
      const imdbVotes = parseVotes(detail.imdbVotes);

      if (!normalizedTitle || !title || !releaseYear || imdbVotes < minVotes) {
        skipped += 1;
        continue;
      }

      const summary = String(detail.Plot || "").trim();
      const leadActors = String(detail.Actors || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 8);

      const moviePayload = {
        imdb_id: detail.imdbID || null,
        imdb_votes: imdbVotes,
        title,
        title_normalized: normalizedTitle,
        release_year: releaseYear,
        summary: summary ? summary.slice(0, 4000) : null,
        lead_actors: leadActors,
        source: "omdb_title_list",
        status: "pending_review",
      };

      const { data: existingByNorm, error: existingError } = await supabase
        .from("movies")
        .select("id")
        .eq("title_normalized", normalizedTitle)
        .maybeSingle();
      if (existingError) {
        throw new Error(`Failed to check existing movie "${title}": ${existingError.message}`);
      }

      if (existingByNorm?.id) {
        const { error: updateError } = await supabase
          .from("movies")
          .update(moviePayload)
          .eq("id", existingByNorm.id);
        if (updateError) {
          throw new Error(`Failed to update "${title}": ${updateError.message}`);
        }
        updated += 1;
        continue;
      }

      const { error: insertError } = await supabase.from("movies").insert({
        ...moviePayload,
        aliases: [],
        aliases_normalized: [],
      });
      if (insertError) {
        skipped += 1;
        errors.push(`Insert failed for ${title}: ${insertError.message}`);
        continue;
      }
      inserted += 1;
    }

    return NextResponse.json({
      ok: true,
      submitted: inputTitles.length,
      inserted,
      updated,
      skipped,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import title list";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
