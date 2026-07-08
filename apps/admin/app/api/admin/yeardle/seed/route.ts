import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServerKey, getSupabaseUrl } from "@/lib/supabase/env";
import { fetchCommonsImageMetadata } from "@/lib/wikimedia-commons";

export const runtime = "nodejs";

const validBatchSizes = new Set([1, 3, 5, 7, 10, 14]);
const DEFAULT_TIMEZONE = process.env.TIMEZONE || "America/New_York";

type OnThisDayPage = {
  titles?: {
    normalized?: string;
  };
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
};

type OnThisDayEvent = {
  year?: number;
  text?: string;
  pages?: OnThisDayPage[];
};

type OnThisDayResponse = {
  events?: OnThisDayEvent[];
};

type WikipediaSummary = {
  extract?: string | null;
  thumbnail?: {
    source?: string;
  };
  originalimage?: {
    source?: string;
  };
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
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
    throw new Error("Failed to compute date in timezone");
  }

  return `${year}-${month}-${day}`;
};

const addDays = (date: string, delta: number): string => {
  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
};

const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

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

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getSupabaseYeardleAdmin = () => {
  return createClient(getSupabaseUrl(), getSupabaseServerKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: "yeardle",
    },
  });
};

const fetchOnThisDayEvents = async (month: number, day: number): Promise<OnThisDayEvent[]> => {
  const response = await fetch(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`, {
    headers: {
      "Api-User-Agent": "DailyDabble Yeardle Admin/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Wikipedia OnThisDay API failed (${response.status})`);
  }

  const payload = (await response.json()) as OnThisDayResponse;
  return Array.isArray(payload.events) ? payload.events : [];
};

const fetchSummary = async (title: string): Promise<WikipediaSummary | null> => {
  const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
    headers: {
      "Api-User-Agent": "DailyDabble Yeardle Admin/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as WikipediaSummary;
};

const pickEventCandidate = async (events: OnThisDayEvent[]) => {
  const sorted = [...events]
    .filter((item) => Number.isFinite(item.year) && Number(item.year) > 1000 && Number(item.year) <= new Date().getFullYear())
    .sort((a, b) => Number(b.year) - Number(a.year));

  for (const candidate of sorted) {
    const firstPage = Array.isArray(candidate.pages) ? candidate.pages[0] : null;
    const pageTitle = firstPage?.titles?.normalized?.trim() ?? "";
    if (!pageTitle) {
      continue;
    }

    const summary = await fetchSummary(pageTitle);
    const imageUrl = summary?.thumbnail?.source ?? summary?.originalimage?.source ?? "";
    if (!imageUrl) {
      continue;
    }

    const text = candidate.text?.trim() || summary?.extract?.trim() || pageTitle;
    return {
      year: Number(candidate.year),
      pageTitle,
      text,
      imageUrl,
      wikiUrl: summary?.content_urls?.desktop?.page ?? firstPage?.content_urls?.desktop?.page ?? null,
      description: summary?.extract?.trim() || text,
    };
  }

  return null;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { batchSize?: number; startDate?: string };
    const batchSize = Number(payload.batchSize ?? 5);

    if (!validBatchSizes.has(batchSize)) {
      return NextResponse.json({ error: "Invalid batch size" }, { status: 400 });
    }

    const initialDate = payload.startDate && isDateString(payload.startDate)
      ? payload.startDate
      : getDateInTimeZone(DEFAULT_TIMEZONE);

    const supabase = getSupabaseYeardleAdmin();
    const items: Array<{ date: string; eventId: string; title: string; eventYear: number }> = [];
    let skippedCount = 0;

    for (let offset = 0; offset < batchSize; offset += 1) {
      const targetDate = addDays(initialDate, offset);
      const parsed = new Date(`${targetDate}T00:00:00`);
      const month = parsed.getUTCMonth() + 1;
      const day = parsed.getUTCDate();
      const events = await fetchOnThisDayEvents(month, day);
      const chosen = await pickEventCandidate(events);

      if (!chosen) {
        skippedCount += 1;
        continue;
      }

      const sourceKey = `${slugify(chosen.pageTitle)}-${chosen.year}`;
      const hintDescription = chosen.description.slice(0, 280);
      const commonsMetadata = await fetchCommonsImageMetadata(chosen.imageUrl).catch(() => null);
      const hasVerifiedImageAttribution = Boolean(
        commonsMetadata?.sourcePageUrl &&
        commonsMetadata?.license &&
        commonsMetadata?.author &&
        commonsMetadata?.attributionText,
      );

      const { data: upsertedEvent, error: upsertError } = await supabase
        .from("events")
        .upsert(
          {
            source_key: sourceKey,
            title: chosen.pageTitle,
            event_year: chosen.year,
            image_url: commonsMetadata?.thumbUrl || commonsMetadata?.imageUrl || chosen.imageUrl,
            image_alt: commonsMetadata?.objectName || `${chosen.pageTitle} historical image`,
            image_source_page_url: commonsMetadata?.sourcePageUrl || null,
            image_file_title: commonsMetadata?.fileTitle || null,
            image_license: commonsMetadata?.license || null,
            image_license_url: commonsMetadata?.licenseUrl || null,
            image_author: commonsMetadata?.author || null,
            image_attribution_text: commonsMetadata?.attributionText || null,
            image_license_verified_at: hasVerifiedImageAttribution ? new Date().toISOString() : null,
            wikipedia_url: chosen.wikiUrl,
            hint_category: null,
            hint_region: null,
            hint_era: null,
            hint_person: inferKeyFigures(chosen.pageTitle, chosen.text),
            hint_description: hintDescription,
            status: hasVerifiedImageAttribution ? "approved" : "pending_review",
            reviewed_at: hasVerifiedImageAttribution ? new Date().toISOString() : null,
          },
          { onConflict: "source_key" },
        )
        .select("id,title,event_year")
        .single();

      if (upsertError || !upsertedEvent) {
        throw new Error(`Failed to upsert Yeardle event for ${targetDate}: ${upsertError?.message ?? "unknown error"}`);
      }

      items.push({
        date: targetDate,
        eventId: upsertedEvent.id,
        title: upsertedEvent.title,
        eventYear: Number(upsertedEvent.event_year),
      });
    }

    return NextResponse.json({
      ok: true,
      output: "Yeardle seed complete.",
      summary: {
        insertedCount: items.length,
        skippedCount,
        items,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, details: message }, { status: 500 });
  }
}
