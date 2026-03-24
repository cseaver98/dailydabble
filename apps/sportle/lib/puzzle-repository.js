import { getSportleSupabaseAdmin } from "./supabase";

const DEFAULT_TIMEZONE = process.env.PUZZLE_TIMEZONE || "America/New_York";

const isDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeName = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const getDateInTimeZone = (timeZone) => {
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

const mapPuzzle = (scheduleRow, athleteRow) => ({
  puzzleId: athleteRow.id,
  puzzleDate: scheduleRow.puzzle_date,
  sport: athleteRow.sport,
  maxGuesses: 6,
  clues: [
    {
      label: "Team identity",
      value: athleteRow.team_name || "Team not revealed",
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
      label: "Key stat #2 / accolade",
      value: athleteRow.key_stat_2 || "Manual accolade clue pending",
    },
    {
      label: "Additional clue",
      value: athleteRow.final_clue || "Manual identifying clue pending",
    },
  ],
});

const fetchScheduleRow = async (date, exact = true) => {
  const supabase = getSportleSupabaseAdmin();
  let query = supabase
    .from("daily_schedule")
    .select("puzzle_date,athlete_id")
    .order("puzzle_date", { ascending: false })
    .limit(1);

  if (exact) {
    query = query.eq("puzzle_date", date);
  } else {
    query = query.lte("puzzle_date", date);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Failed to load Sportle schedule: ${error.message}`);
  }
  return data;
};

const fetchPuzzleByScheduleRow = async (scheduleRow) => {
  if (!scheduleRow) {
    return null;
  }

  const supabase = getSportleSupabaseAdmin();
  const { data: athleteRow, error: athleteError } = await supabase
    .from("athletes")
    .select("id,sport,full_name,team_name,team_logo_url,years_with_team,position,key_stat_1,key_stat_2,final_clue")
    .eq("id", scheduleRow.athlete_id)
    .maybeSingle();

  if (athleteError) {
    throw new Error(`Failed to load Sportle athlete: ${athleteError.message}`);
  }

  if (!athleteRow) {
    return null;
  }

  return mapPuzzle(scheduleRow, athleteRow);
};

export const getTodaySportlePuzzle = async () => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const exact = await fetchScheduleRow(today, true);
  if (exact) {
    return fetchPuzzleByScheduleRow(exact);
  }

  const fallback = await fetchScheduleRow(today, false);
  return fetchPuzzleByScheduleRow(fallback);
};

export const getSportlePuzzleByDate = async (date) => {
  if (!isDateString(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }

  const schedule = await fetchScheduleRow(date, true);
  return fetchPuzzleByScheduleRow(schedule);
};

export const listSportleArchive = async (limit = 120) => {
  const supabase = getSportleSupabaseAdmin();
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);

  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .lte("puzzle_date", today)
    .order("puzzle_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load Sportle archive: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({ puzzleDate: row.puzzle_date }));
};

export const getSportleAnswer = async (puzzleId) => {
  const supabase = getSportleSupabaseAdmin();

  const { data, error } = await supabase
    .from("athletes")
    .select("id,sport,full_name,full_name_normalized,aliases_normalized")
    .eq("id", puzzleId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Sportle answer: ${error.message}`);
  }

  return data;
};

export const findSportleGuessAthlete = async (guessName, sport) => {
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

  const rows = Array.isArray(data) ? data : [];
  const match = rows.find((row) => {
    if (row.full_name_normalized === normalized) {
      return true;
    }

    const aliases = Array.isArray(row.aliases_normalized) ? row.aliases_normalized : [];
    return aliases.includes(normalized);
  });

  return match || null;
};

export const searchSportleAthletes = async ({ sport = "nba", query = "", limit = 12 } = {}) => {
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
    id: row.id,
    fullName: row.full_name,
    sport: row.sport,
  }));
};
