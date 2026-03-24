import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServerKey, getSupabaseUrl } from "@/lib/supabase/env";

export const runtime = "nodejs";

const supportedSports = new Set(["nba", "nfl", "mlb", "soccer", "nhl"]);
const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

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

export async function GET() {
  try {
    const supabase = getSupabaseSportleAdmin();

    const [athletesResult, scheduleResult] = await Promise.all([
      supabase
        .from("athletes")
        .select(
          "id,sport,source_key,full_name,full_name_normalized,aliases,aliases_normalized,team_name,team_logo_url,years_with_team,position,key_stat_1,key_stat_2,final_clue,wikipedia_url,headshot_url,is_active,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(400),
      supabase
        .from("daily_schedule")
        .select("puzzle_date,athlete_id,created_at")
        .order("puzzle_date", { ascending: false })
        .limit(400),
    ]);

    if (athletesResult.error) {
      throw new Error(`Failed to load Sportle athletes: ${athletesResult.error.message}`);
    }

    if (scheduleResult.error) {
      throw new Error(`Failed to load Sportle schedule: ${scheduleResult.error.message}`);
    }

    return NextResponse.json({
      ok: true,
      athletes: athletesResult.data ?? [],
      schedule: scheduleResult.data ?? [],
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
      puzzleDate?: string;
      athleteId?: string;
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
        })
        .select("id,sport,full_name,created_at")
        .single();

      if (error) {
        throw new Error(`Failed to add athlete: ${error.message}`);
      }

      return NextResponse.json({ ok: true, item: data });
    }

    if (action === "assign-date") {
      const athleteId = String(payload.athleteId || "");
      const puzzleDate = String(payload.puzzleDate || "");
      if (!athleteId || !isDateString(puzzleDate)) {
        return NextResponse.json({ error: "Missing athleteId or invalid puzzleDate" }, { status: 400 });
      }

      const { error } = await supabase
        .from("daily_schedule")
        .upsert({ puzzle_date: puzzleDate, athlete_id: athleteId }, { onConflict: "puzzle_date" });

      if (error) {
        throw new Error(`Failed to assign date: ${error.message}`);
      }

      return NextResponse.json({ ok: true });
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
    const fullName = String(payload.fullName || "").trim();
    const sport = String(payload.sport || "").toLowerCase();
    if (!athleteId || !fullName || !supportedSports.has(sport)) {
      return NextResponse.json({ error: "Missing athleteId/fullName or unsupported sport" }, { status: 400 });
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

    const supabase = getSupabaseSportleAdmin();
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
