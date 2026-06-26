import { getSportleSupabaseAdmin } from "./supabase";

const DEFAULT_TIMEZONE = process.env.TIMEZONE || "America/New_York";

const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeName = (value: string): string =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const levenshteinDistance = (left: string, right: string): number => {
  const a = String(left || "");
  const b = String(right || "");
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j]!;
    }
  }

  return prev[b.length]!;
};

const similarityScore = (left: string, right: string): number => {
  const a = String(left || "");
  const b = String(right || "");
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - (levenshteinDistance(a, b) / maxLen);
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

type ScheduleRow = { puzzle_date: string; athlete_id: string };
type AthleteRow = {
  id: string;
  sport: string;
  full_name: string;
  full_name_normalized?: string;
  aliases_normalized?: string[] | null;
  team_name?: string | null;
  team_logo_url?: string | null;
  years_with_team?: string | null;
  position?: string | null;
  key_stat_1?: string | null;
  key_stat_2?: string | null;
  headshot_url?: string | null;
};

const getArchiveGameNumber = async (date: string): Promise<number> => {
  const supabase = getSportleSupabaseAdmin();
  const { count, error } = await supabase
    .from("daily_schedule")
    .select("*", { count: "exact", head: true })
    .lte("puzzle_date", date);

  if (error) {
    throw new Error(`Failed to count Sportle archive games: ${error.message}`);
  }

  return count ?? 0;
};

export type SportlePuzzle = {
  puzzleId: string;
  puzzleDate: string;
  archiveGameNumber: number;
  sport: string;
  maxGuesses: number;
  clues: Array<{ label: string; value: string; logoUrl?: string | null; imageUrl?: string | null }>;
};

const mapPuzzle = async (scheduleRow: ScheduleRow, athleteRow: AthleteRow): Promise<SportlePuzzle> => ({
  puzzleId: athleteRow.id,
  puzzleDate: scheduleRow.puzzle_date,
  archiveGameNumber: await getArchiveGameNumber(scheduleRow.puzzle_date),
  sport: athleteRow.sport,
  maxGuesses: 6,
  clues: [
    {
      label: /\bpresent\b/i.test(String(athleteRow.years_with_team || "")) ? "Current Team" : "Former Team",
      value: athleteRow.team_name || "",
      logoUrl: athleteRow.team_logo_url || null,
    },
    {
      label: "Years played for that team",
      value: athleteRow.years_with_team || "Unknown",
    },
    {
      label: "Position",
      value: athleteRow.position || "Unknown",
    },
    {
      label: "Key stat #1",
      value: athleteRow.key_stat_1 || "Manual stat clue pending",
    },
    {
      label: "Key stat #2 / fact",
      value: athleteRow.key_stat_2 || "Manual accolade clue pending",
    },
    {
      label: "Headshot",
      value: athleteRow.full_name || "Athlete",
      imageUrl: athleteRow.headshot_url || null,
    },
  ],
});

const fetchScheduleRow = async (date: string): Promise<ScheduleRow | null> => {
  const supabase = getSportleSupabaseAdmin();
  const query = supabase
    .from("daily_schedule")
    .select("puzzle_date,athlete_id")
    .eq("puzzle_date", date)
    .order("puzzle_date", { ascending: false })
    .limit(1);

  const { data, error } = await query.maybeSingle<ScheduleRow>();
  if (error) {
    throw new Error(`Failed to load Sportle schedule: ${error.message}`);
  }
  return data;
};

const fetchPuzzleByScheduleRow = async (scheduleRow: ScheduleRow | null): Promise<SportlePuzzle | null> => {
  if (!scheduleRow) {
    return null;
  }

  const supabase = getSportleSupabaseAdmin();
  const { data: athleteRow, error: athleteError } = await supabase
    .from("athletes")
    .select("id,sport,full_name,team_name,team_logo_url,years_with_team,position,key_stat_1,key_stat_2,headshot_url")
    .eq("id", scheduleRow.athlete_id)
    .maybeSingle<AthleteRow>();

  if (athleteError) {
    throw new Error(`Failed to load Sportle athlete: ${athleteError.message}`);
  }

  if (!athleteRow) {
    return null;
  }

  return mapPuzzle(scheduleRow, athleteRow);
};

const autoScheduleApprovedPuzzleForDate = async (date: string) => {
  const supabase = getSportleSupabaseAdmin();

  const { data: approvedRows, error: approvedError } = await supabase
    .from("athletes")
    .select("id,sport,full_name,team_name,team_logo_url,years_with_team,position,key_stat_1,key_stat_2,headshot_url,reviewed_at,created_at")
    .eq("status", "approved")
    .eq("is_active", true)
    .order("reviewed_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5000);

  if (approvedError) {
    throw new Error(`Failed to load approved Sportle athletes: ${approvedError.message}`);
  }

  const candidates = (Array.isArray(approvedRows) ? approvedRows : []) as AthleteRow[];
  for (const candidate of candidates) {
    const { data: alreadyScheduled, error: scheduleLookupError } = await supabase
      .from("daily_schedule")
      .select("puzzle_date")
      .eq("athlete_id", candidate.id)
      .maybeSingle<{ puzzle_date: string }>();

    if (scheduleLookupError) {
      throw new Error(`Failed to check Sportle schedule usage: ${scheduleLookupError.message}`);
    }

    if (alreadyScheduled) {
      continue;
    }

    const { error: insertError } = await supabase.from("daily_schedule").insert({
      puzzle_date: date,
      athlete_id: candidate.id,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        const existing = await fetchPuzzleByScheduleRow(await fetchScheduleRow(date));
        if (existing) {
          return existing;
        }
        continue;
      }
      throw new Error(`Failed to auto-schedule Sportle puzzle: ${insertError.message}`);
    }

    return mapPuzzle({ puzzle_date: date, athlete_id: candidate.id }, candidate);
  }

  return null;
};

export const getTodaySportlePuzzle = async () => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const schedule = await fetchScheduleRow(today);
  const scheduled = await fetchPuzzleByScheduleRow(schedule);
  if (scheduled) {
    return scheduled;
  }

  return autoScheduleApprovedPuzzleForDate(today);
};

export const assignTodaySportlePuzzleFromQueue = async () => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const schedule = await fetchScheduleRow(today);
  const existing = await fetchPuzzleByScheduleRow(schedule);
  if (existing) {
    return existing;
  }
  return autoScheduleApprovedPuzzleForDate(today);
};

export const getSportlePuzzleByDate = async (date: string) => {
  if (!isDateString(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }

  const schedule = await fetchScheduleRow(date);
  return fetchPuzzleByScheduleRow(schedule);
};

export const listSportleArchive = async (limit = 120): Promise<Array<{ puzzleDate: string }>> => {
  const supabase = getSportleSupabaseAdmin();
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);

  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .lt("puzzle_date", today)
    .order("puzzle_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load Sportle archive: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({ puzzleDate: (row as { puzzle_date: string }).puzzle_date }));
};

export const getSportleAnswer = async (puzzleId: string): Promise<AthleteRow | null> => {
  const supabase = getSportleSupabaseAdmin();

  const { data, error } = await supabase
    .from("athletes")
    .select("id,sport,full_name,full_name_normalized,aliases_normalized")
    .eq("id", puzzleId)
    .maybeSingle<AthleteRow>();

  if (error) {
    throw new Error(`Failed to load Sportle answer: ${error.message}`);
  }

  return data;
};

export const findSportleGuessAthlete = async (guessName: string, sport: string): Promise<AthleteRow | null> => {
  const normalized = normalizeName(guessName);
  if (!normalized) {
    return null;
  }

  const supabase = getSportleSupabaseAdmin();
  const { data, error } = await supabase
    .from("athletes")
    .select("id,full_name,full_name_normalized,aliases_normalized,sport")
    .eq("sport", sport)
    .eq("is_active", true)
    .limit(1200);

  if (error) {
    throw new Error(`Failed to validate Sportle guess: ${error.message}`);
  }

  const rows = (Array.isArray(data) ? data : []) as AthleteRow[];
  const exactMatch = rows.find((row) => {
    if (row.full_name_normalized === normalized) {
      return true;
    }

    const aliases = Array.isArray(row.aliases_normalized) ? row.aliases_normalized : [];
    return aliases.includes(normalized);
  });
  if (exactMatch) {
    return exactMatch;
  }

  const tokenCount = normalized.split(" ").filter(Boolean).length;
  if (tokenCount < 2) {
    return null;
  }

  const threshold = 0.9;
  let best: { row: AthleteRow; score: number } | null = null;
  let runnerUp: { row: AthleteRow; score: number } | null = null;

  for (const row of rows) {
    const aliasCandidates = Array.isArray(row.aliases_normalized) ? row.aliases_normalized : [];
    const candidates = [row.full_name_normalized, ...aliasCandidates].filter(
      (value): value is string => typeof value === "string" && value.trim().split(/\s+/).length >= 2,
    );
    if (candidates.length === 0) {
      continue;
    }

    let rowBestScore = 0;
    for (const candidate of candidates) {
      const score = similarityScore(normalized, candidate);
      if (score > rowBestScore) {
        rowBestScore = score;
      }
    }

    if (rowBestScore < threshold) {
      continue;
    }

    if (!best || rowBestScore > best.score) {
      runnerUp = best;
      best = { row, score: rowBestScore };
    } else if (!runnerUp || rowBestScore > runnerUp.score) {
      runnerUp = { row, score: rowBestScore };
    }
  }

  if (!best) {
    return null;
  }

  if (runnerUp && Math.abs(best.score - runnerUp.score) < 0.01) {
    return null;
  }

  return best.row;
};

export const searchSportleAthletes = async ({
  sport = "nba",
  query = "",
  limit = 12,
}: {
  sport?: string;
  query?: string;
  limit?: number;
} = {}) => {
  const supabase = getSportleSupabaseAdmin();
  const safeLimit = Math.max(1, Math.min(30, Number(limit) || 12));

  let dbQuery = supabase
    .from("athletes")
    .select("id,full_name,sport")
    .eq("sport", sport)
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .limit(safeLimit);

  const trimmed = String(query || "").trim();
  if (trimmed) {
    dbQuery = dbQuery.ilike("full_name", `%${trimmed}%`);
  }

  const { data, error } = await dbQuery;
  if (error) {
    throw new Error(`Failed to search athletes: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({
    id: (row as { id: string }).id,
    fullName: (row as { full_name: string }).full_name,
    sport: (row as { sport: string }).sport,
  }));
};
