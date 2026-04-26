import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServerKey, getSupabaseUrl } from "@/lib/supabase/env";

export const runtime = "nodejs";

const validStatuses = ["pending_review", "approved"] as const;
type CandidateStatus = (typeof validStatuses)[number];
type CandidateFilter = CandidateStatus | "finished" | "all";
const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const getToday = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

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

    if (!["all", "pending_review", "approved", "finished"].includes(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const supabase = getSupabaseYeardleAdmin();
    const { data: eventRows, error: eventsError } = await supabase
      .from("events")
      .select("id,title,event_year,image_url,hint_category,hint_region,hint_era,hint_person,status,created_at")
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
        image_url: string;
        hint_category: string | null;
        hint_region: string | null;
        hint_era: string | null;
        hint_person: string | null;
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
      return {
        ...row,
        scheduleCount: dates.length,
        lastScheduledDate: dates[0] || null,
        nextScheduledDate,
        isFinished,
      };
    });

    const filtered = hydrated.filter((row) => {
      if (status === "pending_review") return row.status === "pending_review";
      if (status === "approved") return row.status === "approved" && !row.isFinished;
      if (status === "finished") return row.isFinished;
      return true;
    });
    const offset = (page - 1) * pageSize;
    const items = filtered.slice(offset, offset + pageSize);

    const pending = hydrated.filter((row) => row.status === "pending_review").length;
    const approved = hydrated.filter((row) => row.status === "approved").length;
    const finished = hydrated.filter((row) => row.isFinished).length;
    const approvedUnused = hydrated.filter((row) => row.status === "approved" && !row.isFinished).length;

    return NextResponse.json({
      ok: true,
      items,
      total: filtered.length,
      page,
      pageSize,
      queueHealth: {
        runwayDays: approvedUnused,
        approved,
        pending,
        finished,
        total: hydrated.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Yeardle candidates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { eventId?: string; puzzleDate?: string };
    const eventId = String(payload.eventId || "");
    const puzzleDate = String(payload.puzzleDate || "");
    if (!eventId || !isDateString(puzzleDate)) {
      return NextResponse.json({ error: "eventId and puzzleDate (YYYY-MM-DD) are required" }, { status: 400 });
    }

    const supabase = getSupabaseYeardleAdmin();
    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .select("id,status")
      .eq("id", eventId)
      .maybeSingle();
    if (eventError) {
      throw new Error(`Failed validating event before scheduling: ${eventError.message}`);
    }
    if (!eventRow) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    if (eventRow.status !== "approved") {
      return NextResponse.json({ error: "Only approved events can be scheduled." }, { status: 400 });
    }

    const { error } = await supabase
      .from("daily_schedule")
      .upsert({ puzzle_date: puzzleDate, event_id: eventId }, { onConflict: "puzzle_date" });
    if (error) {
      throw new Error(`Failed scheduling event: ${error.message}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to schedule event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { eventId?: string; status?: CandidateStatus };
    const eventId = String(payload.eventId || "");
    const status = String(payload.status || "") as CandidateStatus;
    if (!eventId || !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const reviewedAt = status === "pending_review" ? null : new Date().toISOString();
    const supabase = getSupabaseYeardleAdmin();
    const { error } = await supabase
      .from("events")
      .update({ status, reviewed_at: reviewedAt })
      .eq("id", eventId);
    if (error) {
      throw new Error(`Failed updating event status: ${error.message}`);
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
