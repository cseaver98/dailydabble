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

type WikipediaSummary = {
  description?: string | null;
  extract?: string | null;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
};

const inferPosition = (text: string, sport: string): string => {
  const value = text.toLowerCase();
  if (sport === "nba" || sport === "soccer") {
    if (value.includes("point guard")) return "Point guard";
    if (value.includes("shooting guard")) return "Shooting guard";
    if (value.includes("small forward")) return "Small forward";
    if (value.includes("power forward")) return "Power forward";
    if (value.includes("center")) return "Center";
    if (value.includes("forward")) return "Forward";
    if (value.includes("guard")) return "Guard";
  }
  if (sport === "nfl") {
    if (value.includes("quarterback")) return "Quarterback";
    if (value.includes("wide receiver")) return "Wide receiver";
    if (value.includes("running back")) return "Running back";
    if (value.includes("tight end")) return "Tight end";
    if (value.includes("linebacker")) return "Linebacker";
    if (value.includes("cornerback")) return "Cornerback";
    if (value.includes("safety")) return "Safety";
  }
  if (sport === "mlb") {
    if (value.includes("pitcher")) return "Pitcher";
    if (value.includes("catcher")) return "Catcher";
    if (value.includes("outfielder")) return "Outfielder";
    if (value.includes("infielder")) return "Infielder";
  }
  if (sport === "nhl") {
    if (value.includes("goaltender") || value.includes("goalie")) return "Goaltender";
    if (value.includes("defenceman") || value.includes("defenseman")) return "Defenseman";
    if (value.includes("center")) return "Center";
    if (value.includes("winger")) return "Winger";
  }
  return "Manual update needed";
};

const inferTeam = (text: string): string => {
  const match =
    text.match(/\bfor the ([A-Z][A-Za-z0-9 .'-]{2,60}?)(?: of| in| who| and|,|\.|\)|$)/) ||
    text.match(/\bplayed for the ([A-Z][A-Za-z0-9 .'-]{2,60}?)(?: of| in| who| and|,|\.|\)|$)/);
  return match?.[1]?.trim() || "Manual update needed";
};

const parseWikipediaArticleTitleFromUrl = (rawUrl: string): string | null => {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.endsWith("wikipedia.org")) return null;
    if (!parsed.pathname.startsWith("/wiki/")) return null;
    const rawTitle = parsed.pathname.replace(/^\/wiki\//, "").trim();
    if (!rawTitle) return null;
    return decodeURIComponent(rawTitle).replace(/_/g, " ");
  } catch {
    return null;
  }
};

const fetchWikipediaSummary = async (title: string): Promise<WikipediaSummary | null> => {
  const response = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    {
      headers: { "Api-User-Agent": "DailyDabble Sportle Admin/1.0" },
      cache: "no-store",
    },
  );
  if (!response.ok) return null;
  return (await response.json()) as WikipediaSummary;
};

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
        "id,sport,full_name,aliases,team_name,team_logo_url,years_with_team,position,key_stat_1,key_stat_2,wikipedia_url,headshot_url,is_active,status,created_at",
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
        team_logo_url: string | null;
        years_with_team: string | null;
        position: string | null;
        key_stat_1: string | null;
        key_stat_2: string | null;
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
        approvedUnused,
        scheduled,
        pending,
        finished,
        total: hydrated.length,
        lowQueueThreshold,
        isLow: approvedUnused < lowQueueThreshold,
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
      wikipediaUrl?: string;
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

    if (action === "import-wikipedia-url") {
      const sport = String(payload.sport || "nba").toLowerCase();
      const wikipediaUrl = String(payload.wikipediaUrl || "").trim();
      if (!supportedSports.has(sport)) {
        return NextResponse.json({ error: "Unsupported sport" }, { status: 400 });
      }
      if (!wikipediaUrl) {
        return NextResponse.json({ error: "wikipediaUrl is required" }, { status: 400 });
      }

      const pageTitle = parseWikipediaArticleTitleFromUrl(wikipediaUrl);
      if (!pageTitle) {
        return NextResponse.json({ error: "Provide a valid Wikipedia athlete URL." }, { status: 400 });
      }

      const summary = await fetchWikipediaSummary(pageTitle);
      const description = String(summary?.description || "").trim();
      const extract = String(summary?.extract || "").trim();
      if (!description && !extract) {
        return NextResponse.json({ error: "Could not fetch athlete details from that Wikipedia page." }, { status: 400 });
      }

      const fullName = pageTitle.replace(/\s+\(.+\)\s*$/, "").trim();
      const normalized = normalizeName(fullName);
      const sourceKey = `${sport}-${normalized.replace(/\s+/g, "-")}`;
      const keyStat2 = description || "Professional athlete";

      const { data, error } = await supabase
        .from("athletes")
        .upsert(
          {
            sport,
            source_key: sourceKey,
            full_name: fullName,
            full_name_normalized: normalized,
            aliases: [] as string[],
            aliases_normalized: [] as string[],
            team_name: inferTeam(extract || description),
            years_with_team: "Manual update needed",
            position: inferPosition(`${description}. ${extract}`, sport),
            key_stat_1: "Manual stat clue pending",
            key_stat_2: keyStat2,
            wikipedia_url: summary?.content_urls?.desktop?.page || wikipediaUrl,
            headshot_url: summary?.thumbnail?.source || null,
            is_active: true,
            status: "pending_review",
          },
          { onConflict: "source_key" },
        )
        .select("id,sport,full_name,team_name,position,key_stat_1,key_stat_2,wikipedia_url,headshot_url,status")
        .single();

      if (error) {
        throw new Error(`Failed to import athlete: ${error.message}`);
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
