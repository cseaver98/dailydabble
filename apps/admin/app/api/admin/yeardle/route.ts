import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServerKey, getSupabaseUrl } from "@/lib/supabase/env";

export const runtime = "nodejs";

const validStatuses = ["pending_review", "approved"] as const;
type CandidateStatus = (typeof validStatuses)[number];
type CandidateFilter = CandidateStatus | "finished" | "today" | "all";

const getToday = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const isValidMonthDay = (month: number, day: number): boolean => {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  return new Date(Date.UTC(2000, month - 1, day)).getUTCMonth() === month - 1;
};
const getMonthDayFromDate = (date: string): { month: number; day: number } | null => {
  const parts = date.split("-").map((part) => Number(part));
  if (parts.length !== 3 || !Number.isFinite(parts[1]) || !Number.isFinite(parts[2])) {
    return null;
  }
  return { month: parts[1], day: parts[2] };
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

const getScheduleWarning = async (supabase: ReturnType<typeof getSupabaseYeardleAdmin>, eventId: string) => {
  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .eq("event_id", eventId)
    .order("puzzle_date", { ascending: true })
    .limit(1);
  if (error) {
    throw new Error(`Failed to check Yeardle schedule history: ${error.message}`);
  }
  const scheduledDate = data?.[0]?.puzzle_date;
  return scheduledDate ? `Heads up: this Yeardle event has already been scheduled or played (${scheduledDate}).` : null;
};

const getDuplicateWarning = async (supabase: ReturnType<typeof getSupabaseYeardleAdmin>, eventId: string) => {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("title,event_year,event_month,event_day")
    .eq("id", eventId)
    .maybeSingle<{ title: string; event_year: number; event_month: number | null; event_day: number | null }>();
  if (eventError) {
    throw new Error(`Failed to check Yeardle event duplicates: ${eventError.message}`);
  }
  if (!event?.title || !event.event_year) return null;
  let query = supabase
    .from("events")
    .select("id")
    .eq("title", event.title)
    .eq("event_year", event.event_year)
    .neq("id", eventId)
    .limit(1);
  query = event.event_month == null ? query.is("event_month", null) : query.eq("event_month", event.event_month);
  query = event.event_day == null ? query.is("event_day", null) : query.eq("event_day", event.event_day);
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to check Yeardle event duplicates: ${error.message}`);
  }
  return (data ?? []).length > 0 ? "Heads up: this Yeardle event already exists as another candidate." : null;
};

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const status = String(requestUrl.searchParams.get("status") || "pending_review") as CandidateFilter;
    const page = Math.max(1, Number(requestUrl.searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(5, Number(requestUrl.searchParams.get("pageSize") || "10")));

    if (!["all", "pending_review", "approved", "finished", "today"].includes(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const supabase = getSupabaseYeardleAdmin();
    const { data: eventRows, error: eventsError } = await supabase
      .from("events")
      .select("id,title,event_year,event_month,event_day,image_url,image_alt,image_source_page_url,image_file_title,image_license,image_license_url,image_author,image_attribution_text,image_license_verified_at,hint_description,wikipedia_url,status,created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (eventsError) {
      throw new Error(`Failed to load Yeardle events: ${eventsError.message}`);
    }

    const rows =
      (eventRows as Array<{
        id: string;
        title: string;
        event_year: number;
        event_month: number | null;
        event_day: number | null;
        image_url: string;
        image_alt: string | null;
        image_source_page_url: string | null;
        image_file_title: string | null;
        image_license: string | null;
        image_license_url: string | null;
        image_author: string | null;
        image_attribution_text: string | null;
        image_license_verified_at: string | null;
        hint_description: string | null;
        wikipedia_url: string | null;
        status: CandidateStatus;
        created_at: string;
      }> | null) ?? [];
    const ids = rows.map((row) => row.id);

    let scheduleRows: Array<{ event_id: string; puzzle_date: string }> = [];
    if (ids.length > 0) {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("daily_schedule")
        .select("event_id,puzzle_date")
        .in("event_id", ids);
      if (scheduleError) {
        throw new Error(`Failed to load Yeardle schedule: ${scheduleError.message}`);
      }
      scheduleRows = (scheduleData as Array<{ event_id: string; puzzle_date: string }> | null) ?? [];
    }

    const byEventId = new Map<string, string[]>();
    for (const row of scheduleRows) {
      const current = byEventId.get(row.event_id) ?? [];
      current.push(row.puzzle_date);
      byEventId.set(row.event_id, current);
    }

    const today = getToday();
    const hydrated = rows.map((row) => {
      const dates = (byEventId.get(row.id) ?? []).sort((a, b) => b.localeCompare(a));
      const isFinished = dates.some((date) => date <= today);
      const nextScheduledDate = dates.filter((date) => date >= today).sort((a, b) => a.localeCompare(b))[0] || null;
      const hasEventDate = typeof row.event_month === "number" && typeof row.event_day === "number";
      const mismatchedDates = hasEventDate
        ? dates.filter((date) => {
            const monthDay = getMonthDayFromDate(date);
            return !monthDay || monthDay.month !== row.event_month || monthDay.day !== row.event_day;
          })
        : [];
      return {
        ...row,
        scheduleCount: dates.length,
        lastScheduledDate: dates[0] || null,
        nextScheduledDate,
        isScheduledToday: dates.includes(today),
        isFinished,
        hasEventDate,
        scheduleDateWarning: hasEventDate
          ? mismatchedDates[0] || null
          : dates.length > 0
            ? "missing_event_date"
            : null,
      };
    });

    const filtered = hydrated.filter((row) => {
      if (status === "pending_review") return row.status === "pending_review";
      if (status === "approved") return row.status === "approved" && !row.isFinished;
      if (status === "finished") return row.isFinished;
      if (status === "today") return row.isScheduledToday;
      return true;
    });
    const offset = (page - 1) * pageSize;
    const items = filtered.slice(offset, offset + pageSize);

    const pending = hydrated.filter((row) => row.status === "pending_review").length;
    const approved = hydrated.filter((row) => row.status === "approved").length;
    const finished = hydrated.filter((row) => row.isFinished).length;
    const approvedUnused = hydrated.filter((row) => row.status === "approved" && !row.isFinished).length;
    const scheduled = hydrated.filter((row) => row.scheduleCount > 0).length;
    const lowQueueThreshold = Number(process.env.ADMIN_QUEUE_LOW_THRESHOLD ?? 3);

    return NextResponse.json({
      ok: true,
      items,
      total: filtered.length,
      page,
      pageSize,
      queueHealth: {
        runwayDays: approvedUnused,
        approved,
        scheduled,
        pending,
        finished,
        total: hydrated.length,
        lowQueueThreshold,
        isLow: approvedUnused < lowQueueThreshold,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Yeardle candidates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      eventId?: string;
      status?: CandidateStatus;
      imageUrl?: string;
      imageAlt?: string;
      imageSourcePageUrl?: string | null;
      imageFileTitle?: string | null;
      imageLicense?: string | null;
      imageLicenseUrl?: string | null;
      imageAuthor?: string | null;
      imageAttributionText?: string | null;
      imageLicenseVerified?: boolean;
      clearImage?: boolean;
      confirmDuplicate?: boolean;
      candidate?: {
        title?: string;
        eventYear?: number;
        eventMonth?: number | null;
        eventDay?: number | null;
        description?: string;
        wikipediaUrl?: string;
      };
    };
    const eventId = String(payload.eventId || "");
    const status = String(payload.status || "").trim() as CandidateStatus;
    const imageUrl = String(payload.imageUrl || "").trim();
    const imageAlt = String(payload.imageAlt || "").trim();
    const imageSourcePageUrl = payload.imageSourcePageUrl == null ? null : String(payload.imageSourcePageUrl || "").trim();
    const imageFileTitle = payload.imageFileTitle == null ? null : String(payload.imageFileTitle || "").trim();
    const imageLicense = payload.imageLicense == null ? null : String(payload.imageLicense || "").trim();
    const imageLicenseUrl = payload.imageLicenseUrl == null ? null : String(payload.imageLicenseUrl || "").trim();
    const imageAuthor = payload.imageAuthor == null ? null : String(payload.imageAuthor || "").trim();
    const imageAttributionText = payload.imageAttributionText == null ? null : String(payload.imageAttributionText || "").trim();
    const hasImageMetadata =
      payload.imageSourcePageUrl !== undefined ||
      payload.imageFileTitle !== undefined ||
      payload.imageLicense !== undefined ||
      payload.imageLicenseUrl !== undefined ||
      payload.imageAuthor !== undefined ||
      payload.imageAttributionText !== undefined ||
      payload.imageLicenseVerified !== undefined ||
      payload.imageAlt !== undefined;
    const clearImage = Boolean(payload.clearImage);
    const candidate = payload.candidate && typeof payload.candidate === "object" ? payload.candidate : null;
    const hasStatus = Boolean(status);
    const hasImageUrl = Boolean(imageUrl);
    const hasClearImage = clearImage;
    const hasCandidate = Boolean(candidate);

    if (!eventId || (!hasStatus && !hasImageUrl && !hasClearImage && !hasCandidate && !hasImageMetadata)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    if (hasImageUrl && hasClearImage) {
      return NextResponse.json({ error: "Provide imageUrl or clearImage, not both." }, { status: 400 });
    }
    if (hasStatus && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }
    if (hasImageUrl) {
      let parsedImageUrl: URL;
      try {
        parsedImageUrl = new URL(imageUrl);
      } catch {
        return NextResponse.json({ error: "Image URL must be a valid URL" }, { status: 400 });
      }
      if (parsedImageUrl.protocol !== "http:" && parsedImageUrl.protocol !== "https:") {
        return NextResponse.json({ error: "Image URL must use http or https" }, { status: 400 });
      }
    }
    const validateOptionalUrl = (value: string | null, label: string): NextResponse | null => {
      if (!value) return null;
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(value);
      } catch {
        return NextResponse.json({ error: `${label} must be a valid URL.` }, { status: 400 });
      }
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return NextResponse.json({ error: `${label} must use http or https.` }, { status: 400 });
      }
      return null;
    };
    const sourcePageError = validateOptionalUrl(imageSourcePageUrl, "Image source page URL");
    if (sourcePageError) return sourcePageError;
    const licenseUrlError = validateOptionalUrl(imageLicenseUrl, "Image license URL");
    if (licenseUrlError) return licenseUrlError;
    if (hasCandidate) {
      const title = String(candidate?.title || "").trim();
      const eventYear = Number(candidate?.eventYear);
      const eventMonth = candidate?.eventMonth == null || candidate?.eventMonth === 0 ? null : Number(candidate?.eventMonth);
      const eventDay = candidate?.eventDay == null || candidate?.eventDay === 0 ? null : Number(candidate?.eventDay);
      const description = String(candidate?.description || "").trim();
      if (!title) {
        return NextResponse.json({ error: "Candidate title is required." }, { status: 400 });
      }
      if (!Number.isFinite(eventYear) || eventYear < 1000 || eventYear > new Date().getFullYear()) {
        return NextResponse.json({ error: "Event year must be between 1000 and current year." }, { status: 400 });
      }
      if ((eventMonth == null) !== (eventDay == null)) {
        return NextResponse.json({ error: "Event month and day must be provided together." }, { status: 400 });
      }
      if (eventMonth != null && eventDay != null && !isValidMonthDay(eventMonth, eventDay)) {
        return NextResponse.json({ error: "Event month/day must be a real calendar date." }, { status: 400 });
      }
      if (!description) {
        return NextResponse.json({ error: "Description is required." }, { status: 400 });
      }
      const wikipediaUrl = String(candidate?.wikipediaUrl || "").trim();
      if (wikipediaUrl) {
        let parsedWikipediaUrl: URL;
        try {
          parsedWikipediaUrl = new URL(wikipediaUrl);
        } catch {
          return NextResponse.json({ error: "Wikipedia URL must be a valid URL." }, { status: 400 });
        }
        if (parsedWikipediaUrl.protocol !== "http:" && parsedWikipediaUrl.protocol !== "https:") {
          return NextResponse.json({ error: "Wikipedia URL must use http or https." }, { status: 400 });
        }
      }
    }

    const reviewedAt = hasStatus ? (status === "pending_review" ? null : new Date().toISOString()) : undefined;
    const supabase = getSupabaseYeardleAdmin();
    const updatePayload: Record<string, string | number | null> = {};
    if (hasStatus && status === "approved") {
      const { data: currentEvent, error: currentEventError } = await supabase
        .from("events")
        .select("image_url,image_source_page_url,image_license,image_author,image_attribution_text,image_license_verified_at")
        .eq("id", eventId)
        .maybeSingle<{
          image_url: string | null;
          image_source_page_url: string | null;
          image_license: string | null;
          image_author: string | null;
          image_attribution_text: string | null;
          image_license_verified_at: string | null;
        }>();
      if (currentEventError) {
        throw new Error(`Failed checking event image attribution: ${currentEventError.message}`);
      }
      const effectiveSourcePageUrl = imageSourcePageUrl ?? currentEvent?.image_source_page_url ?? null;
      const effectiveLicense = imageLicense ?? currentEvent?.image_license ?? null;
      const effectiveAuthor = imageAuthor ?? currentEvent?.image_author ?? null;
      const effectiveAttributionText = imageAttributionText ?? currentEvent?.image_attribution_text ?? null;
      const effectiveVerifiedAt =
        payload.imageLicenseVerified === true
          ? new Date().toISOString()
          : payload.imageLicenseVerified === false
            ? null
            : currentEvent?.image_license_verified_at ?? null;
      if (
        !currentEvent?.image_url ||
        !effectiveSourcePageUrl ||
        !effectiveLicense ||
        !effectiveAuthor ||
        !effectiveAttributionText ||
        !effectiveVerifiedAt
      ) {
        return NextResponse.json(
          { error: "Verify image source, author, license, and attribution before approving this Yeardle candidate." },
          { status: 400 },
        );
      }
    }
    if (hasStatus) {
      updatePayload.status = status;
      updatePayload.reviewed_at = reviewedAt ?? null;
    }
    if (hasImageUrl) {
      updatePayload.image_url = imageUrl;
      updatePayload.image_license_verified_at = null;
    }
    if (payload.imageAlt !== undefined) {
      updatePayload.image_alt = imageAlt || null;
    }
    if (payload.imageSourcePageUrl !== undefined) {
      updatePayload.image_source_page_url = imageSourcePageUrl || null;
    }
    if (payload.imageFileTitle !== undefined) {
      updatePayload.image_file_title = imageFileTitle || null;
    }
    if (payload.imageLicense !== undefined) {
      updatePayload.image_license = imageLicense || null;
    }
    if (payload.imageLicenseUrl !== undefined) {
      updatePayload.image_license_url = imageLicenseUrl || null;
    }
    if (payload.imageAuthor !== undefined) {
      updatePayload.image_author = imageAuthor || null;
    }
    if (payload.imageAttributionText !== undefined) {
      updatePayload.image_attribution_text = imageAttributionText || null;
    }
    if (payload.imageLicenseVerified !== undefined) {
      updatePayload.image_license_verified_at = payload.imageLicenseVerified ? new Date().toISOString() : null;
    }
    if (hasClearImage) {
      updatePayload.image_url = null;
      updatePayload.image_alt = null;
      updatePayload.image_source_page_url = null;
      updatePayload.image_file_title = null;
      updatePayload.image_license = null;
      updatePayload.image_license_url = null;
      updatePayload.image_author = null;
      updatePayload.image_attribution_text = null;
      updatePayload.image_license_verified_at = null;
    }
    if (hasCandidate) {
      updatePayload.title = String(candidate?.title || "").trim();
      updatePayload.event_year = Math.floor(Number(candidate?.eventYear));
      updatePayload.event_month = candidate?.eventMonth == null || candidate?.eventMonth === 0 ? null : Math.floor(Number(candidate?.eventMonth));
      updatePayload.event_day = candidate?.eventDay == null || candidate?.eventDay === 0 ? null : Math.floor(Number(candidate?.eventDay));
      updatePayload.hint_category = null;
      updatePayload.hint_region = null;
      updatePayload.hint_era = null;
      updatePayload.hint_description = String(candidate?.description || "").trim();
      updatePayload.wikipedia_url = String(candidate?.wikipediaUrl || "").trim() || null;
    }

    const warnings =
      hasStatus && status === "approved"
        ? (await Promise.all([getDuplicateWarning(supabase, eventId), getScheduleWarning(supabase, eventId)])).filter(Boolean)
        : [];
    const warning = warnings.length > 0 ? warnings.join("\n") : null;
    if (warning && payload.confirmDuplicate !== true) {
      return NextResponse.json({ duplicateWarning: warning }, { status: 409 });
    }

    const { error } = await supabase
      .from("events")
      .update(updatePayload)
      .eq("id", eventId);
    if (error) {
      throw new Error(`Failed updating event: ${error.message}`);
    }

    return NextResponse.json({ ok: true, warning });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { id?: string };
    const id = String(payload.id || "");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = getSupabaseYeardleAdmin();
    const { error: scheduleError } = await supabase.from("daily_schedule").delete().eq("event_id", id);
    if (scheduleError) {
      throw new Error(`Failed deleting schedule rows: ${scheduleError.message}`);
    }

    const { error: deleteError } = await supabase.from("events").delete().eq("id", id);
    if (deleteError) {
      throw new Error(`Failed deleting event: ${deleteError.message}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete event candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
