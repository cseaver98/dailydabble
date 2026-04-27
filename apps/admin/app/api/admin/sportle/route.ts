import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServerKey, getSupabaseUrl } from "@/lib/supabase/env";

export const runtime = "nodejs";

const supportedSports = new Set(["nba", "nfl", "mlb", "soccer", "nhl"]);
const validStatuses = ["pending_review", "approved"] as const;
type CandidateStatus = (typeof validStatuses)[number];
type CandidateFilter = CandidateStatus | "finished" | "today" | "all";

const normalizeName = (value: string): string =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normalizeAliases = (aliases: string[]): string[] =>
  aliases
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((item) => normalizeName(item))
    .filter(Boolean);

const getToday = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

const getSupabaseSportleAdmin = () =>
  createClient(getSupabaseUrl(), getSupabaseServerKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: "sportle",
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

    const supabase = getSupabaseSportleAdmin();

    const { data: athletesData, error: athletesError } = await supabase
      .from("athletes")
      .select(
        "id,sport,full_name,aliases,team_name,years_with_team,position,key_stat_1,key_stat_2,final_clue,wikipedia_url,headshot_url,is_active,status,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(5000);

    if (athletesError) {
      throw new Error(`Failed to load Sportle athletes: ${athletesError.message}`);
    }

    const rows =
      (athletesData as Array<{
        id: string;
        sport: string;
        full_name: string;
        aliases: string[];
        team_name: string | null;
        years_with_team: string | null;
        position: string | null;
        key_stat_1: string | null;
        key_stat_2: string | null;
        final_clue: string | null;
        wikipedia_url: string | null;
        headshot_url: string | null;
        is_active: boolean;
        status: CandidateStatus;
        created_at: string;
      }> | null) ?? [];

    const athleteIds = rows.map((row) => row.id);
    let scheduleRows: Array<{ athlete_id: string; puzzle_date: string }> = [];
    if (athleteIds.length > 0) {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("daily_schedule")
        .select("athlete_id,puzzle_date")
        .in("athlete_id", athleteIds);
      if (scheduleError) {
        throw new Error(`Failed to load Sportle schedule: ${scheduleError.message}`);
      }
      scheduleRows = (scheduleData as Array<{ athlete_id: string; puzzle_date: string }> | null) ?? [];
    }

    const byAthleteId = new Map<string, string[]>();
    for (const row of scheduleRows) {
      const current = byAthleteId.get(row.athlete_id) ?? [];
      current.push(row.puzzle_date);
      byAthleteId.set(row.athlete_id, current);
    }

    const today = getToday();
    const hydrated = rows.map((row) => {
      const dates = (byAthleteId.get(row.id) ?? []).sort((a, b) => b.localeCompare(a));
      const isFinished = dates.some((date) => date <= today);
      const nextScheduledDate = dates.filter((date) => date >= today).sort((a, b) => a.localeCompare(b))[0] || null;
      return {
        ...row,
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
      if (status === "today") return row.isScheduledToday;
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
        approvedUnused,
        pending,
        finished,
        total: hydrated.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Sportle admin data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      action?: string;
      sport?: string;
      fullName?: string;
      sourceKey?: string;
    };

    const action = payload.action ?? "add-athlete";
    const supabase = getSupabaseSportleAdmin();

    if (action === "add-athlete") {
      const sport = String(payload.sport || "nba").toLowerCase();
      const fullName = String(payload.fullName || "").trim();
      const sourceKey = String(payload.sourceKey || "").trim() || null;

      if (!supportedSports.has(sport)) {
        return NextResponse.json({ error: "Unsupported sport" }, { status: 400 });
      }
      if (!fullName) {
        return NextResponse.json({ error: "fullName is required" }, { status: 400 });
      }

      const normalized = normalizeName(fullName);
      const { data, error } = await supabase
        .from("athletes")
        .insert({
          sport,
          source_key: sourceKey,
          full_name: fullName,
          full_name_normalized: normalized,
          key_stat_1: "Manual stat clue pending",
          key_stat_2: "Manual accolade clue pending",
          final_clue: "Manual identifying clue pending",
          is_active: true,
          status: "pending_review",
        })
        .select("id,sport,full_name,created_at,status")
        .single();

      if (error) {
        throw new Error(`Failed to add athlete: ${error.message}`);
      }

      return NextResponse.json({ ok: true, item: data });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update Sportle admin data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      athleteId?: string;
      status?: CandidateStatus;
      sport?: string;
      fullName?: string;
      aliases?: string[];
      teamName?: string;
      teamLogoUrl?: string;
      yearsWithTeam?: string;
      position?: string;
      keyStat1?: string;
      keyStat2?: string;
      finalClue?: string;
      wikipediaUrl?: string;
      headshotUrl?: string;
      isActive?: boolean;
    };

    const athleteId = String(payload.athleteId || "");
    if (!athleteId) {
      return NextResponse.json({ error: "athleteId is required" }, { status: 400 });
    }

    const supabase = getSupabaseSportleAdmin();

    if (payload.status) {
      const status = String(payload.status) as CandidateStatus;
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      const reviewedAt = status === "pending_review" ? null : new Date().toISOString();
      const { error } = await supabase
        .from("athletes")
        .update({ status, reviewed_at: reviewedAt })
        .eq("id", athleteId);
      if (error) {
        throw new Error(`Failed to update athlete status: ${error.message}`);
      }
      return NextResponse.json({ ok: true });
    }

    const fullName = String(payload.fullName || "").trim();
    const sport = String(payload.sport || "").toLowerCase();
    if (!fullName || !supportedSports.has(sport)) {
      return NextResponse.json({ error: "Missing fullName or unsupported sport" }, { status: 400 });
    }

    const aliases = Array.isArray(payload.aliases) ? payload.aliases : [];
    const aliasesClean = aliases.map((item) => String(item || "").trim()).filter(Boolean);
    const aliasesNormalized = normalizeAliases(aliasesClean);

    const updateRow = {
      sport,
      full_name: fullName,
      full_name_normalized: normalizeName(fullName),
      aliases: aliasesClean,
      aliases_normalized: aliasesNormalized,
      team_name: String(payload.teamName || "").trim() || null,
      team_logo_url: String(payload.teamLogoUrl || "").trim() || null,
      years_with_team: String(payload.yearsWithTeam || "").trim() || null,
      position: String(payload.position || "").trim() || null,
      key_stat_1: String(payload.keyStat1 || "").trim() || null,
      key_stat_2: String(payload.keyStat2 || "").trim() || null,
      final_clue: String(payload.finalClue || "").trim() || null,
      wikipedia_url: String(payload.wikipediaUrl || "").trim() || null,
      headshot_url: String(payload.headshotUrl || "").trim() || null,
      is_active: payload.isActive !== false,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("athletes")
      .update(updateRow)
      .eq("id", athleteId);

    if (error) {
      throw new Error(`Failed to update athlete: ${error.message}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update athlete";
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

    const supabase = getSupabaseSportleAdmin();
    const { error: scheduleError } = await supabase.from("daily_schedule").delete().eq("athlete_id", id);
    if (scheduleError) {
      throw new Error(`Failed deleting schedule rows: ${scheduleError.message}`);
    }
    const { error: deleteError } = await supabase.from("athletes").delete().eq("id", id);
    if (deleteError) {
      throw new Error(`Failed deleting athlete: ${deleteError.message}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete athlete candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
