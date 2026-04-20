import { NextResponse } from "next/server";
import { getMoviedleSupabaseAdmin } from "@/lib/supabase/moviedle";

export const runtime = "nodejs";

const validStatuses = ["pending_review", "approved"] as const;
type CandidateStatus = (typeof validStatuses)[number];
type CandidateFilter = CandidateStatus | "finished" | "all";

const isStatus = (value: string): value is CandidateStatus =>
  validStatuses.includes(value as CandidateStatus);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const statusParam = String(url.searchParams.get("status") || "pending_review");
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get("pageSize") || "10")));

    const status = statusParam as CandidateFilter;
    if (status !== "all" && status !== "finished" && !isStatus(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const supabase = getMoviedleSupabaseAdmin();
    const offset = (page - 1) * pageSize;
    const needsDerivedFilter = status === "finished" || status === "approved";
    let totalCount = 0;

    if (!needsDerivedFilter) {
      let countQuery = supabase.from("movies").select("id", { count: "exact", head: true });
      if (status === "pending_review") {
        countQuery = countQuery.eq("status", status);
      }
      const { count, error: countError } = await countQuery;
      if (countError) {
        throw new Error(`Failed counting movie candidates: ${countError.message}`);
      }
      totalCount = count || 0;
    }

    let dataQuery = supabase
      .from("movies")
      .select("id,title,release_year,summary,lead_actors,still_urls,status,source,review_notes,reviewed_at,created_at,imdb_votes")
      .order("created_at", { ascending: false });
    if (status === "pending_review" || status === "approved") {
      dataQuery = dataQuery.eq("status", status);
    }
    if (!needsDerivedFilter) {
      dataQuery = dataQuery.range(offset, offset + pageSize - 1);
    }

    const { data, error } = await dataQuery;
    if (error) {
      throw new Error(`Failed loading movie candidates: ${error.message}`);
    }

    const rows = Array.isArray(data) ? data : [];
    const movieIds = rows.map((row) => row.id);

    let scheduleRows: { movie_id: string; puzzle_date: string }[] = [];
    if (movieIds.length > 0) {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("daily_schedule")
        .select("movie_id,puzzle_date")
        .in("movie_id", movieIds);
      if (scheduleError) {
        throw new Error(`Failed loading schedule usage: ${scheduleError.message}`);
      }
      scheduleRows = (scheduleData as { movie_id: string; puzzle_date: string }[] | null) ?? [];
    }

    const usageByMovieId = new Map<string, string[]>();
    for (const row of scheduleRows) {
      const existing = usageByMovieId.get(row.movie_id) ?? [];
      existing.push(row.puzzle_date);
      usageByMovieId.set(row.movie_id, existing);
    }

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

    const hydrated = rows.map((row) => {
        const dates = (usageByMovieId.get(row.id) ?? []).sort((a, b) => b.localeCompare(a));
        const nextScheduledDate =
          dates
            .filter((date) => date >= today)
            .sort((a, b) => a.localeCompare(b))[0] ?? null;
        const isFinished = dates.some((date) => date <= today);
        return {
          ...row,
          stillCount: Array.isArray(row.still_urls) ? row.still_urls.filter(Boolean).length : 0,
          scheduleCount: dates.length,
          lastScheduledDate: dates[0] || null,
          nextScheduledDate,
          isScheduledToday: dates.includes(today),
          isFinished,
        };
      });

    const filtered = hydrated.filter((row) => {
      if (status === "pending_review") return row.status === "pending_review";
      if (status === "approved") return row.status === "approved" && !row.isFinished;
      if (status === "finished") return row.isFinished;
      return true;
    });
    const items = needsDerivedFilter ? filtered.slice(offset, offset + pageSize) : filtered;

    const [{ data: allMovies, error: allMoviesError }, { data: allSchedule, error: allScheduleError }] = await Promise.all([
      supabase.from("movies").select("id,status"),
      supabase.from("daily_schedule").select("movie_id,puzzle_date"),
    ]);
    if (allMoviesError) {
      throw new Error(`Failed loading queue health movies: ${allMoviesError.message}`);
    }
    if (allScheduleError) {
      throw new Error(`Failed loading queue health schedules: ${allScheduleError.message}`);
    }
    const finishedIds = new Set(
      ((allSchedule as Array<{ movie_id: string; puzzle_date: string }> | null) ?? [])
        .filter((row) => row.puzzle_date <= today)
        .map((row) => row.movie_id),
    );
    let pending = 0;
    let approved = 0;
    let finished = 0;
    for (const row of ((allMovies as Array<{ id: string; status: string }> | null) ?? [])) {
      if (row.status === "pending_review") pending += 1;
      if (row.status === "approved") approved += 1;
      if (finishedIds.has(row.id)) finished += 1;
    }
    const approvedUnused = ((allMovies as Array<{ id: string; status: string }> | null) ?? []).filter(
      (row) => row.status === "approved" && !finishedIds.has(row.id),
    ).length;

    return NextResponse.json({
      items,
      total: needsDerivedFilter ? filtered.length : totalCount,
      page,
      pageSize,
      status,
      queueHealth: {
        runwayDays: approvedUnused,
        approved,
        approvedUnused,
        pending,
        finished,
        total: ((allMovies as Array<{ id: string; status: string }> | null) ?? []).length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load candidates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const id = String(payload?.id || "");
    const status = String(payload?.status || "");

    if (!id || !isStatus(status)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = getMoviedleSupabaseAdmin();
    if (status === "approved") {
      const { data, error } = await supabase
        .from("movies")
        .select("id,still_urls")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        throw new Error(`Failed to validate candidate before approval: ${error.message}`);
      }
      const stills = Array.isArray(data?.still_urls) ? data.still_urls.filter(Boolean) : [];
      if (stills.length < 1) {
        return NextResponse.json({ error: "Add at least one still image before approving." }, { status: 400 });
      }
    }

    const reviewedAt = status === "pending_review" ? null : new Date().toISOString();
    const { error: updateError } = await supabase
      .from("movies")
      .update({ status, reviewed_at: reviewedAt })
      .eq("id", id);
    if (updateError) {
      throw new Error(`Failed to update candidate status: ${updateError.message}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const id = String(payload?.id || "");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = getMoviedleSupabaseAdmin();
    const { error: scheduleError } = await supabase.from("daily_schedule").delete().eq("movie_id", id);
    if (scheduleError) {
      throw new Error(`Failed deleting movie schedule rows: ${scheduleError.message}`);
    }
    const { error: deleteError } = await supabase.from("movies").delete().eq("id", id);
    if (deleteError) {
      throw new Error(`Failed deleting movie candidate: ${deleteError.message}`);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
