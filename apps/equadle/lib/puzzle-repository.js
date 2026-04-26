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

const autoScheduleApprovedPuzzleForDate = async (date) => {
  const supabase = getEquadleSupabaseAdmin();

  const { data: approvedRows, error: approvedError } = await supabase
    .from("puzzles")
    .select("id,equation,equation_length,created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(5000);

  if (approvedError) {
    throw new Error(`Failed to load approved Equadle puzzles: ${approvedError.message}`);
  }

  const candidates = Array.isArray(approvedRows) ? approvedRows : [];
  for (const candidate of candidates) {
    const { data: alreadyScheduled, error: scheduleLookupError } = await supabase
      .from("daily_schedule")
      .select("puzzle_date")
      .eq("puzzle_id", candidate.id)
      .maybeSingle();

    if (scheduleLookupError) {
      throw new Error(`Failed to check Equadle schedule usage: ${scheduleLookupError.message}`);
    }

    if (alreadyScheduled) {
      continue;
    }

    const { error: insertError } = await supabase.from("daily_schedule").insert({
      puzzle_date: date,
      puzzle_id: candidate.id,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        const existing = await getPuzzleByScheduleDate(date);
        if (existing) {
          return existing;
        }
        continue;
      }
      throw new Error(`Failed to auto-schedule Equadle puzzle: ${insertError.message}`);
    }

    return mapPuzzle(
      { puzzle_date: date, puzzle_id: candidate.id },
      candidate,
    );
  }

  return null;
};

export const getTodayEquadlePuzzle = async () => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const scheduled = await getPuzzleByScheduleDate(today);
  if (scheduled) {
    return scheduled;
  }

  return autoScheduleApprovedPuzzleForDate(today);
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
