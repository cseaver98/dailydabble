import { NextResponse } from "next/server";
import { getMoviedleSupabaseAdmin } from "@/lib/supabase/moviedle";

export const runtime = "nodejs";

const normalizeTitle = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const toUniqueNormalizedTitles = (titles: string[]) => {
  const seen = new Set<string>();
  const rows: Array<{ title: string; title_normalized: string }> = [];
  for (const rawTitle of titles) {
    const title = String(rawTitle || "").trim();
    const titleNormalized = normalizeTitle(title);
    if (!title || !titleNormalized || seen.has(titleNormalized)) {
      continue;
    }
    seen.add(titleNormalized);
    rows.push({ title, title_normalized: titleNormalized });
  }
  return rows;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "");
    const normalizedQuery = normalizeTitle(q);
    const limit = Math.min(25, Math.max(1, Number(url.searchParams.get("limit") || "8")));

    const supabase = getMoviedleSupabaseAdmin();

    const { count, error: countError } = await supabase.from("movie_titles").select("id", { count: "exact", head: true });
    if (countError) {
      throw new Error(`Failed counting title library rows: ${countError.message}`);
    }

    if (!normalizedQuery || normalizedQuery.length < 2) {
      return NextResponse.json({
        suggestions: [],
        totalTitles: count || 0,
      });
    }

    const expandedLimit = Math.min(80, Math.max(limit * 4, 24));
    const { data, error } = await supabase
      .from("movie_titles")
      .select("id,title,title_normalized")
      .ilike("title_normalized", `%${normalizedQuery}%`)
      .order("title", { ascending: true })
      .limit(expandedLimit);

    if (error) {
      throw new Error(`Failed searching title library: ${error.message}`);
    }

    const rows = Array.isArray(data) ? data : [];
    rows.sort((a, b) => {
      const aNorm = String(a.title_normalized || "");
      const bNorm = String(b.title_normalized || "");
      const aStarts = aNorm.startsWith(normalizedQuery);
      const bStarts = bNorm.startsWith(normalizedQuery);
      if (aStarts !== bStarts) {
        return aStarts ? -1 : 1;
      }
      return String(a.title || "").localeCompare(String(b.title || ""));
    });

    return NextResponse.json({
      suggestions: rows.slice(0, limit).map((row) => ({
        id: row.id,
        title: row.title,
      })),
      totalTitles: count || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to search title library";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const source = String(payload?.source || "manual");
    const titlesText = String(payload?.titlesText || "");
    const inputTitles = titlesText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 25000);

    if (inputTitles.length === 0) {
      return NextResponse.json({ error: "Provide at least one movie title (one per line)." }, { status: 400 });
    }

    const rows = toUniqueNormalizedTitles(inputTitles);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid movie titles to import." }, { status: 400 });
    }

    const supabase = getMoviedleSupabaseAdmin();
    const chunkSize = 500;
    let insertedOrUpdated = 0;

    for (let index = 0; index < rows.length; index += chunkSize) {
      const chunk = rows.slice(index, index + chunkSize).map((row) => ({
        title: row.title,
        title_normalized: row.title_normalized,
        source,
      }));

      const { error } = await supabase
        .from("movie_titles")
        .upsert(chunk, { onConflict: "title_normalized", ignoreDuplicates: false });
      if (error) {
        throw new Error(`Failed importing title chunk: ${error.message}`);
      }
      insertedOrUpdated += chunk.length;
    }

    const { count, error: countError } = await supabase.from("movie_titles").select("id", { count: "exact", head: true });
    if (countError) {
      throw new Error(`Failed counting imported title library rows: ${countError.message}`);
    }

    return NextResponse.json({
      ok: true,
      submitted: inputTitles.length,
      uniquePrepared: rows.length,
      insertedOrUpdated,
      totalTitles: count || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import title library";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
