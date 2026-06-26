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
      .select("id,title,event_year,event_month,event_day,image_url,hint_person,hint_description,wikipedia_url,status,created_at")
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
        hint_person: string | null;
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
    const lowQueueThreshold = Number(process.env.ADMIN_QUEUE_LOW_THRESHOLD ?? 7);

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
      clearImage?: boolean;
      candidate?: {
        title?: string;
        eventYear?: number;
        eventMonth?: number | null;
        eventDay?: number | null;
        keyFigures?: string;
        description?: string;
        wikipediaUrl?: string;
      };
    };
    const eventId = String(payload.eventId || "");
    const status = String(payload.status || "").trim() as CandidateStatus;
    const imageUrl = String(payload.imageUrl || "").trim();
    const clearImage = Boolean(payload.clearImage);
    const candidate = payload.candidate && typeof payload.candidate === "object" ? payload.candidate : null;
    const hasStatus = Boolean(status);
    const hasImageUrl = Boolean(imageUrl);
    const hasClearImage = clearImage;
    const hasCandidate = Boolean(candidate);

    if (!eventId || (!hasStatus && !hasImageUrl && !hasClearImage && !hasCandidate)) {
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
    if (hasStatus) {
      updatePayload.status = status;
      updatePayload.reviewed_at = reviewedAt ?? null;
    }
    if (hasImageUrl) {
      updatePayload.image_url = imageUrl;
    }
    if (hasClearImage) {
      updatePayload.image_url = null;
    }
    if (hasCandidate) {
      updatePayload.title = String(candidate?.title || "").trim();
      updatePayload.event_year = Math.floor(Number(candidate?.eventYear));
      updatePayload.event_month = candidate?.eventMonth == null || candidate?.eventMonth === 0 ? null : Math.floor(Number(candidate?.eventMonth));
      updatePayload.event_day = candidate?.eventDay == null || candidate?.eventDay === 0 ? null : Math.floor(Number(candidate?.eventDay));
      updatePayload.hint_category = null;
      updatePayload.hint_region = null;
      updatePayload.hint_era = null;
      updatePayload.hint_person = String(candidate?.keyFigures || "").trim() || null;
      updatePayload.hint_description = String(candidate?.description || "").trim();
      updatePayload.wikipedia_url = String(candidate?.wikipediaUrl || "").trim() || null;
    }

    const { error } = await supabase
      .from("events")
      .update(updatePayload)
      .eq("id", eventId);
    if (error) {
      throw new Error(`Failed updating event: ${error.message}`);
    }

    return NextResponse.json({ ok: true });
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
