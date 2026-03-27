import { getEquadleSupabaseAdmin } from "./supabase";

const DEFAULT_TIMEZONE = process.env.PUZZLE_TIMEZONE || "America/New_York";

const isDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

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

const mapPuzzle = (scheduleRow, puzzleRow) => ({
  puzzleId: puzzleRow.id,
  puzzleDate: scheduleRow.puzzle_date,
  equationLength: Number(puzzleRow.equation_length) || 9,
  maxGuesses: 6,
});

const getPuzzleByScheduleDate = async (date) => {
  const supabase = getEquadleSupabaseAdmin();

  const { data: scheduleRow, error: scheduleError } = await supabase
    .from("daily_schedule")
    .select("puzzle_date,puzzle_id")
    .eq("puzzle_date", date)
    .maybeSingle();

  if (scheduleError) {
    throw new Error(`Failed to load Equadle schedule: ${scheduleError.message}`);
  }

  if (!scheduleRow) {
    return null;
  }

  const { data: puzzleRow, error: puzzleError } = await supabase
    .from("puzzles")
    .select("id,equation,equation_length")
    .eq("id", scheduleRow.puzzle_id)
    .maybeSingle();

  if (puzzleError) {
    throw new Error(`Failed to load Equadle puzzle: ${puzzleError.message}`);
  }

  if (!puzzleRow) {
    return null;
  }

  return mapPuzzle(scheduleRow, puzzleRow);
};

export const getTodayEquadlePuzzle = async () => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  return getPuzzleByScheduleDate(today);
};

export const getEquadlePuzzleByDate = async (date) => {
  if (!isDateString(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  return getPuzzleByScheduleDate(date);
};

export const listEquadleArchive = async (limit = 120) => {
  const supabase = getEquadleSupabaseAdmin();
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);

  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .lte("puzzle_date", today)
    .order("puzzle_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load Equadle archive: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({ puzzleDate: row.puzzle_date }));
};

export const getEquadleAnswer = async (puzzleId) => {
  const supabase = getEquadleSupabaseAdmin();

  const { data, error } = await supabase
    .from("puzzles")
    .select("id,equation,equation_length")
    .eq("id", puzzleId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Equadle answer: ${error.message}`);
  }

  return data;
};
