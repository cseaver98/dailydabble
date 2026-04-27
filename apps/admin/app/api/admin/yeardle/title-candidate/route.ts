import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServerKey, getSupabaseUrl } from "@/lib/supabase/env";

export const runtime = "nodejs";

const MIN_YEAR = 1000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const REQUEST_TIMEOUT_MS = 6000;

type WikipediaSummary = {
  title?: string;
  extract?: string | null;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
};

type WikipediaParseResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        extract?: string;
        fullurl?: string;
        canonicalurl?: string;
        thumbnail?: { source?: string };
      }
    >;
  };
};

type ManualCandidate = {
  title: string;
  imageUrl: string;
  imageAlt: string;
  wikipediaUrl: string | null;
  keyFigures: string;
  description: string;
  eventYearGuess: number | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfterMs = (value: string | null): number | null => {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.floor(seconds * 1000);
  }

  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : null;
  }

  return null;
};

const fetchWithRetry = async (url: string, init: RequestInit, attempts = 2): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        return response;
      }

      if (RETRYABLE_STATUSES.has(response.status) && attempt < attempts) {
        const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
        const backoffMs = retryAfterMs ?? Math.min(1200, 300 * 2 ** (attempt - 1));
        await sleep(backoffMs);
        continue;
      }

      throw new Error(`${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown fetch error");
      if (attempt < attempts) {
        await sleep(Math.min(1200, 300 * 2 ** (attempt - 1)));
        continue;
      }
    }
  }

  throw lastError ?? new Error("Request failed");
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const inferKeyFigures = (title: string, text: string): string => {
  const pageName = title.replace(/\s*\(.+\)\s*/g, "").trim();
  const matches = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g) ?? [];
  const deduped = Array.from(new Set(matches.map((value) => value.trim()).filter(Boolean)));
  const chosen = [];

  for (const name of deduped) {
    if (name.length < 4) continue;
    chosen.push(name);
    if (chosen.length >= 4) break;
  }

  if (pageName.split(" ").length >= 2 && !chosen.includes(pageName)) {
    chosen.unshift(pageName);
  }

  return chosen.length ? chosen.slice(0, 4).join(", ") : (pageName || "Notable figures");
};

const extractYearGuess = (title: string, extract: string): number | null => {
  const currentYear = new Date().getFullYear();
  const matches = `${title} ${extract}`.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  const years = matches
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= MIN_YEAR && value <= currentYear);

  return years.length > 0 ? years[0] : null;
};

const getSupabaseYeardleAdmin = () =>
  createClient(getSupabaseUrl(), getSupabaseServerKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: "yeardle",
    },
  });

const parseWikipediaTitleFromUrl = (rawUrl: string): { title: string; canonicalUrl: string } | null => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!parsed.hostname.endsWith("wikipedia.org")) {
    return null;
  }

  let slug = "";
  const path = parsed.pathname || "";
  if (path.startsWith("/wiki/")) {
    slug = path.slice("/wiki/".length).trim();
  } else if (parsed.searchParams.get("title")) {
    slug = String(parsed.searchParams.get("title") || "").trim();
  } else {
    return null;
  }

  if (!slug) {
    return null;
  }

  if (slug.includes(":")) {
    return null;
  }

  const decoded = decodeURIComponent(slug).replace(/_/g, " ").trim();
  if (!decoded) {
    return null;
  }

  return {
    title: decoded,
    canonicalUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(decoded.replace(/ /g, "_"))}`,
  };
};

const fetchSummaryFromQueryApi = async (title: string): Promise<WikipediaSummary | null> => {
  try {
    const response = await fetchWithRetry(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages|info&inprop=url&explaintext=1&exintro=1&pithumbsize=1200&redirects=1&titles=${encodeURIComponent(title)}&format=json`,
      {
        headers: { "Api-User-Agent": "DailyDabble Yeardle Admin/1.0" },
        cache: "no-store",
      },
      1,
    );

    const payload = (await response.json()) as WikipediaParseResponse;
    const pages = payload.query?.pages ? Object.values(payload.query.pages) : [];
    const first = pages.find((page) => page && page.title);
    if (!first?.title) {
      return null;
    }

    return {
      title: first.title,
      extract: first.extract ?? null,
      thumbnail: first.thumbnail,
      content_urls: { desktop: { page: first.fullurl ?? first.canonicalurl ?? undefined } },
    };
  } catch {
    return null;
  }
};

const fetchSummaryFromRestApi = async (title: string): Promise<WikipediaSummary | null> => {
  try {
    const normalizedTitle = title.replace(/ /g, "_");
    const response = await fetchWithRetry(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(normalizedTitle)}`,
      {
        headers: { "Api-User-Agent": "DailyDabble Yeardle Admin/1.0" },
        cache: "no-store",
      },
      1,
    );
    return (await response.json()) as WikipediaSummary;
  } catch {
    return null;
  }
};

const buildManualCandidate = async (page: { title: string; canonicalUrl: string }): Promise<ManualCandidate> => {
  const summary = (await fetchSummaryFromRestApi(page.title)) ?? (await fetchSummaryFromQueryApi(page.title));
  const title = String(summary?.title || page.title).trim();
  const description = String(summary?.extract || "").trim();
  const imageUrl = String(summary?.thumbnail?.source || summary?.originalimage?.source || "").trim();

  const fallbackSummary = `Review and edit this candidate for ${title}.`;
  const normalizedDescription = (description || fallbackSummary).slice(0, 600);
  const yearGuess = extractYearGuess(title, normalizedDescription);

  return {
    title,
    imageUrl,
    imageAlt: `${title} historical image`,
    wikipediaUrl: summary?.content_urls?.desktop?.page ?? page.canonicalUrl,
    keyFigures: inferKeyFigures(title, normalizedDescription),
    description: normalizedDescription,
    eventYearGuess: yearGuess,
  };
};

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const url = String(requestUrl.searchParams.get("url") || "").trim();
    if (!url) {
      return NextResponse.json({ error: "Wikipedia URL is required." }, { status: 400 });
    }

    const page = parseWikipediaTitleFromUrl(url);
    if (!page) {
      return NextResponse.json(
        { error: "Provide a valid Wikipedia article URL (example: https://en.wikipedia.org/wiki/Apollo_11)." },
        { status: 400 },
      );
    }

    const candidate = await buildManualCandidate(page);

    return NextResponse.json({ ok: true, candidate });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Failed to lookup event";
    const message = rawMessage === "429"
      ? "Wikipedia rate-limited this request. Please wait a minute and try again."
      : rawMessage;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      candidate?: ManualCandidate;
      eventYear?: number;
    };

    const candidate = payload.candidate;
    const eventYear = Number(payload.eventYear);
    const currentYear = new Date().getFullYear();

    if (!candidate || !candidate.title || !candidate.imageUrl) {
      return NextResponse.json({ error: "candidate is required." }, { status: 400 });
    }

    if (!Number.isFinite(eventYear) || eventYear < MIN_YEAR || eventYear > currentYear) {
      return NextResponse.json({ error: `eventYear must be between ${MIN_YEAR} and ${currentYear}.` }, { status: 400 });
    }

    const sourceKey = `${slugify(candidate.title)}-${eventYear}`;
    const supabase = getSupabaseYeardleAdmin();

    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .upsert(
        {
          source_key: sourceKey,
          title: candidate.title,
          event_year: eventYear,
          image_url: candidate.imageUrl,
          image_alt: candidate.imageAlt,
          wikipedia_url: candidate.wikipediaUrl,
          hint_category: null,
          hint_region: null,
          hint_era: null,
          hint_person: candidate.keyFigures,
          hint_description: candidate.description,
          status: "pending_review",
          reviewed_at: null,
        },
        { onConflict: "source_key" },
      )
      .select("id,title,event_year,status")
      .single();

    if (eventError || !eventRow) {
      throw new Error(`Failed to save candidate event: ${eventError?.message ?? "unknown error"}`);
    }

    return NextResponse.json({
      ok: true,
      candidate: {
        id: eventRow.id,
        title: eventRow.title,
        eventYear: Number(eventRow.event_year),
        status: eventRow.status,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add manual candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
