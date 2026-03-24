import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServerKey, getSupabaseUrl } from "@/lib/supabase/env";

export const runtime = "nodejs";

const supportedSports = new Set(["nba", "nfl", "mlb", "soccer", "nhl"]);
const validBatchSizes = new Set([1, 3, 5, 7, 10, 14]);
const DEFAULT_TIMEZONE = process.env.PUZZLE_TIMEZONE || "America/New_York";

const categoryBySport: Record<string, string> = {
  nba: "Category:NBA_players",
  nfl: "Category:National_Football_League_players",
  mlb: "Category:Major_League_Baseball_players",
  soccer: "Category:Association_footballers",
  nhl: "Category:National_Hockey_League_players",
};

type CategoryMember = {
  title?: string;
};

type CategoryResponse = {
  query?: {
    categorymembers?: CategoryMember[];
  };
};

type WikipediaSummary = {
  extract?: string | null;
  description?: string | null;
  thumbnail?: {
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

const normalizeName = (value: string): string =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const toSourceKey = (sport: string, value: string): string =>
  `${sport}-${normalizeName(value).replace(/\s+/g, "-")}`;

const randomShuffle = <T>(items: T[]): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
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
  }
  if (sport === "mlb") {
    if (value.includes("pitcher")) return "Pitcher";
    if (value.includes("catcher")) return "Catcher";
    if (value.includes("outfielder")) return "Outfielder";
  }
  if (sport === "nhl" && value.includes("goaltender")) return "Goaltender";
  return "Manual update needed";
};

const inferTeam = (text: string): string => {
  const match =
    text.match(/\bfor the ([A-Z][A-Za-z0-9 .'-]{2,60}?)(?: of| in| who| and|,|\.|\)|$)/) ||
    text.match(/\bplayed for the ([A-Z][A-Za-z0-9 .'-]{2,60}?)(?: of| in| who| and|,|\.|\)|$)/);
  return match?.[1]?.trim() || "Manual update needed";
};

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

const fetchCategoryMembers = async (sport: string): Promise<string[]> => {
  const category = categoryBySport[sport];
  if (!category) {
    return [];
  }

  const endpoint =
    `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(category)}&cmtype=page&cmlimit=200&format=json`;
  const response = await fetch(endpoint, {
    headers: {
      "Api-User-Agent": "DailyDabble Sportle Admin/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Wikipedia category API failed (${response.status})`);
  }

  const payload = (await response.json()) as CategoryResponse;
  const members = Array.isArray(payload.query?.categorymembers) ? payload.query?.categorymembers : [];
  return members
    .map((item) => String(item.title || "").trim())
    .filter((item) => item.length > 0 && !item.toLowerCase().startsWith("list of"));
};

const fetchSummary = async (title: string): Promise<WikipediaSummary | null> => {
  const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
    headers: {
      "Api-User-Agent": "DailyDabble Sportle Admin/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as WikipediaSummary;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      sport?: string;
      batchSize?: number;
      startDate?: string;
    };

    const sport = String(payload.sport || "nba").toLowerCase();
    const batchSize = Number(payload.batchSize ?? 5);
    const initialDate =
      payload.startDate && isDateString(payload.startDate)
        ? payload.startDate
        : getDateInTimeZone(DEFAULT_TIMEZONE);

    if (!supportedSports.has(sport)) {
      return NextResponse.json({ error: "Unsupported sport" }, { status: 400 });
    }
    if (!validBatchSizes.has(batchSize)) {
      return NextResponse.json({ error: "Invalid batch size" }, { status: 400 });
    }

    const supabase = getSupabaseSportleAdmin();
    const memberTitles = await fetchCategoryMembers(sport);
    const shuffled = randomShuffle(memberTitles);

    const inserted: Array<{ id: string; full_name: string; sport: string }> = [];
    const scheduled: Array<{ date: string; athleteId: string; athleteName: string }> = [];

    for (const title of shuffled) {
      if (inserted.length >= batchSize) {
        break;
      }

      const summary = await fetchSummary(title);
      const description = String(summary?.description || "").trim();
      const extract = String(summary?.extract || "").trim();
      if (!description && !extract) {
        continue;
      }

      const fullName = title.replace(/\s+\(.+\)\s*$/, "").trim();
      const sourceKey = toSourceKey(sport, fullName);

      const upsertRow = {
        sport,
        source_key: sourceKey,
        full_name: fullName,
        full_name_normalized: normalizeName(fullName),
        aliases: [] as string[],
        aliases_normalized: [] as string[],
        team_name: inferTeam(extract || description),
        team_logo_url: null,
        years_with_team: "Manual update needed",
        position: inferPosition(`${description}. ${extract}`, sport),
        key_stat_1: "Manual stat clue pending",
        key_stat_2: description || "Professional athlete",
        final_clue: extract ? extract.slice(0, 180) : "Manual identifying clue pending",
        wikipedia_url: summary?.content_urls?.desktop?.page || null,
        headshot_url: summary?.thumbnail?.source || null,
        is_active: true,
      };

      const { data, error } = await supabase
        .from("athletes")
        .upsert(upsertRow, { onConflict: "source_key" })
        .select("id,full_name,sport")
        .single();

      if (error) {
        continue;
      }

      inserted.push(data);
    }

    let dayOffset = 0;
    for (const athlete of inserted) {
      while (dayOffset < 366) {
        const date = addDays(initialDate, dayOffset);
        dayOffset += 1;

        const { data: existing, error: existingError } = await supabase
          .from("daily_schedule")
          .select("puzzle_date")
          .eq("puzzle_date", date)
          .maybeSingle();

        if (existingError) {
          throw new Error(`Failed checking schedule for ${date}: ${existingError.message}`);
        }

        if (existing) {
          continue;
        }

        const { error: scheduleError } = await supabase
          .from("daily_schedule")
          .insert({ puzzle_date: date, athlete_id: athlete.id });

        if (scheduleError) {
          throw new Error(`Failed scheduling ${athlete.full_name}: ${scheduleError.message}`);
        }

        scheduled.push({ date, athleteId: athlete.id, athleteName: athlete.full_name });
        break;
      }
    }

    return NextResponse.json({
      ok: true,
      summary: {
        sport,
        requestedCount: batchSize,
        insertedCount: inserted.length,
        scheduledCount: scheduled.length,
        scheduled,
      },
      output:
        "Seeded athlete candidates from Wikipedia categories. Review and refine clues in the Sportle admin tab before publishing widely.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sportle seed failed";
    return NextResponse.json({ error: "Sportle seed failed", details: message }, { status: 500 });
  }
}
