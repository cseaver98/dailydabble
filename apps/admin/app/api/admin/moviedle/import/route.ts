import { NextResponse } from "next/server";
import { getMoviedleSupabaseAdmin } from "@/lib/supabase/moviedle";

export const runtime = "nodejs";

type OmdbSearchItem = {
  imdbID?: string;
  Title?: string;
  Year?: string;
  Type?: string;
};

type OmdbDetail = {
  Response?: string;
  imdbID?: string;
  Title?: string;
  Year?: string;
  Plot?: string;
  Actors?: string;
  Country?: string;
  Type?: string;
  imdbVotes?: string;
};

const normalizeTitle = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const parseIntInRange = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  if (rounded < min || rounded > max) return fallback;
  return rounded;
};

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

const isUsMovie = (countryField: string | undefined): boolean =>
  String(countryField || "")
    .toLowerCase()
    .split(",")
    .map((part) => part.trim())
    .some((part) => part === "usa" || part === "united states");

const fetchOmdbSearch = async ({
  apiKey,
  query,
  page,
  year,
}: {
  apiKey: string;
  query: string;
  page: number;
  year?: number;
}): Promise<OmdbSearchItem[]> => {
  const params = new URLSearchParams({
    apikey: apiKey,
    s: query,
    type: "movie",
    page: String(page),
  });
  if (year) params.set("y", String(year));
  const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (payload?.Response !== "True") {
    const message = String(payload?.Error || "OMDb search failed");
    if (message.toLowerCase().includes("movie not found")) {
      return [];
    }
    if (message.toLowerCase().includes("too many results")) {
      // Some broad terms can overflow OMDb's search cap. Skip and continue.
      return [];
    }
    if (message.toLowerCase().includes("conversion failed when converting the varchar value")) {
      // OMDb occasionally returns backend SQL conversion errors for certain query/year combos.
      // Treat as a transient/unsupported query and continue.
      return [];
    }
    throw new Error(`OMDb search error: ${message}`);
  }
  return Array.isArray(payload?.Search) ? (payload.Search as OmdbSearchItem[]) : [];
};

const fetchOmdbDetail = async (apiKey: string, imdbId: string): Promise<OmdbDetail | null> => {
  const params = new URLSearchParams({
    apikey: apiKey,
    i: imdbId,
    plot: "short",
  });
  const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (payload?.Response !== "True") {
    const message = String(payload?.Error || "OMDb detail failed");
    if (message.toLowerCase().includes("movie not found")) {
      return null;
    }
    throw new Error(`OMDb detail error: ${message}`);
  }
  return payload as OmdbDetail;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OMDB_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OMDB_API_KEY environment variable for admin importer." }, { status: 400 });
    }

    const payload = await request.json().catch(() => ({}));
    const targetCount = parseIntInRange(payload?.targetCount, 100, 3000, 2000);
    const includeInternational = Boolean(payload?.includeInternational ?? true);
    const usMinVotes = parseIntInRange(payload?.usMinVotes, 100, 2000000, 3000);
    const intlMinVotes = parseIntInRange(payload?.intlMinVotes, 100, 2000000, 15000);

    const currentYear = new Date().getFullYear();
    const yearBands = [
      { from: currentYear, to: 2015 },
      { from: 2014, to: 2000 },
      { from: 1999, to: 1980 },
      { from: 1979, to: 1960 },
    ];
    const seedTerms = [
      "star",
      "dark",
      "mission",
      "harry",
      "lord",
      "ring",
      "avenger",
      "batman",
      "spider",
      "matrix",
      "dragon",
      "future",
      "alien",
      "jungle",
      "legend",
      "city",
      "island",
      "moon",
      "killer",
      "ghost",
      "king",
      "queen",
      "story",
      "game",
      "road",
      "river",
      "fire",
      "ice",
      "blood",
      "secret",
      "last",
      "first",
      "great",
      "good",
      "bad",
      "gold",
      "silver",
      "red",
      "blue",
      "black",
      "white",
      "american",
      "paris",
      "tokyo",
      "london",
    ];
    const maxPagesPerTerm = 8;

    const imdbIds = new Set<string>();
    outer: for (const band of yearBands) {
      for (let year = band.from; year >= band.to; year -= 1) {
        for (const term of seedTerms) {
          for (let page = 1; page <= maxPagesPerTerm; page += 1) {
            const rows = await fetchOmdbSearch({ apiKey, query: term, page, year });
            if (rows.length === 0) break;
            for (const row of rows) {
              const imdbID = String(row.imdbID || "").trim();
              if (!imdbID) continue;
              imdbIds.add(imdbID);
              if (imdbIds.size >= targetCount * 3) break outer;
            }
          }
        }
      }
    }

    const supabase = getMoviedleSupabaseAdmin();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let processed = 0;
    let filteredMissing = 0;
    let filteredCountry = 0;
    let filteredVotes = 0;

    for (const imdbID of imdbIds) {
      if (inserted + updated >= targetCount) break;
      const detail = await fetchOmdbDetail(apiKey, imdbID);
      processed += 1;
      if (!detail) {
        skipped += 1;
        continue;
      }

      const title = String(detail.Title || "").trim();
      const normalizedTitle = normalizeTitle(title);
      const releaseYear = parseReleaseYear(detail.Year);
      const votes = parseVotes(detail.imdbVotes);
      const usMovie = isUsMovie(detail.Country);

      if (!title || !normalizedTitle || !releaseYear) {
        filteredMissing += 1;
        skipped += 1;
        continue;
      }
      if (!includeInternational && !usMovie) {
        filteredCountry += 1;
        skipped += 1;
        continue;
      }
      if (usMovie && votes < usMinVotes) {
        filteredVotes += 1;
        skipped += 1;
        continue;
      }
      if (!usMovie && votes < intlMinVotes) {
        filteredVotes += 1;
        skipped += 1;
        continue;
      }

      const summary = String(detail.Plot || "").trim();
      const leadActors = String(detail.Actors || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 8);

      const { data: existing, error: existingError } = await supabase
        .from("movies")
        .select("id")
        .eq("title_normalized", normalizedTitle)
        .maybeSingle();
      if (existingError) {
        throw new Error(`Failed checking existing "${title}": ${existingError.message}`);
      }

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from("movies")
          .update({
            release_year: releaseYear,
            summary: summary ? summary.slice(0, 4000) : null,
            lead_actors: leadActors,
          })
          .eq("id", existing.id);
        if (updateError) {
          throw new Error(`Failed to update "${title}": ${updateError.message}`);
        }
        updated += 1;
      } else {
        const { error: insertError } = await supabase.from("movies").insert({
          title,
          title_normalized: normalizedTitle,
          aliases: [],
          aliases_normalized: [],
          release_year: releaseYear,
          summary: summary ? summary.slice(0, 4000) : null,
          lead_actors: leadActors,
          still_urls: ["/favicon.svg"],
        });
        if (insertError) {
          skipped += 1;
          continue;
        }
        inserted += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      source: "omdb",
      targetCount,
      includeInternational,
      candidatesCollected: imdbIds.size,
      detailProcessed: processed,
      inserted,
      updated,
      skipped,
      filters: {
        usMinVotes,
        intlMinVotes,
        filteredMissing,
        filteredCountry,
        filteredVotes,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import OMDb movies";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
