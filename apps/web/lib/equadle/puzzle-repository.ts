import { getEquadleSupabaseAdmin } from "./supabase";

const DEFAULT_TIMEZONE = process.env.TIMEZONE || "America/New_York";

const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

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

type ScheduleRow = {
  puzzle_date: string;
  puzzle_id: string;
};

type PuzzleRow = {
  id: string;
  equation: string;
  equation_length: number | null;
  reviewed_at?: string | null;
  created_at?: string | null;
};

export type EquadlePuzzle = {
  puzzleId: string;
  puzzleDate: string;
  archiveGameNumber: number;
  equationLength: number;
  equalsIndex: number;
  target: string;
  maxGuesses: number;
};

const getArchiveGameNumber = async (date: string): Promise<number> => {
  const supabase = getEquadleSupabaseAdmin();
  const { count, error } = await supabase
    .from("daily_schedule")
    .select("*", { count: "exact", head: true })
    .lte("puzzle_date", date);

  if (error) {
    throw new Error(`Failed to count Equadle archive games: ${error.message}`);
  }

  return count ?? 0;
};

const mapPuzzle = async (scheduleRow: ScheduleRow, puzzleRow: PuzzleRow): Promise<EquadlePuzzle> => {
  const equation = String(puzzleRow.equation || "");
  const equalsIndex = Math.max(0, equation.indexOf("="));

  return {
    puzzleId: puzzleRow.id,
    puzzleDate: scheduleRow.puzzle_date,
    archiveGameNumber: await getArchiveGameNumber(scheduleRow.puzzle_date),
    equationLength: Number(puzzleRow.equation_length) || 9,
    equalsIndex,
    target: equation.slice(equalsIndex + 1),
    maxGuesses: 6,
  };
};

const getPuzzleByScheduleDate = async (date: string): Promise<EquadlePuzzle | null> => {
  const supabase = getEquadleSupabaseAdmin();

  const { data: scheduleRow, error: scheduleError } = await supabase
    .from("daily_schedule")
    .select("puzzle_date,puzzle_id")
    .eq("puzzle_date", date)
    .maybeSingle<ScheduleRow>();

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
    .maybeSingle<PuzzleRow>();

  if (puzzleError) {
    throw new Error(`Failed to load Equadle puzzle: ${puzzleError.message}`);
  }

  if (!puzzleRow) {
    return null;
  }

  return mapPuzzle(scheduleRow, puzzleRow);
};

const autoScheduleApprovedPuzzleForDate = async (date: string): Promise<EquadlePuzzle | null> => {
  const supabase = getEquadleSupabaseAdmin();

  const { data: approvedRows, error: approvedError } = await supabase
    .from("puzzles")
    .select("id,equation,equation_length,reviewed_at,created_at")
    .eq("status", "approved")
    .order("reviewed_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5000);

  if (approvedError) {
    throw new Error(`Failed to load approved Equadle puzzles: ${approvedError.message}`);
  }

  const candidates = (Array.isArray(approvedRows) ? approvedRows : []) as PuzzleRow[];
  for (const candidate of candidates) {
    const { data: alreadyScheduled, error: scheduleLookupError } = await supabase
      .from("daily_schedule")
      .select("puzzle_date")
      .eq("puzzle_id", candidate.id)
      .maybeSingle<{ puzzle_date: string }>();

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

export const getTodayEquadlePuzzle = async (): Promise<EquadlePuzzle | null> => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const scheduled = await getPuzzleByScheduleDate(today);
  if (scheduled) {
    return scheduled;
  }

  return autoScheduleApprovedPuzzleForDate(today);
};

export const assignTodayEquadlePuzzleFromQueue = async (): Promise<EquadlePuzzle | null> => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const existing = await getPuzzleByScheduleDate(today);
  if (existing) {
    return existing;
  }
  return autoScheduleApprovedPuzzleForDate(today);
};

export const getEquadlePuzzleByDate = async (date: string): Promise<EquadlePuzzle | null> => {
  if (!isDateString(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  return getPuzzleByScheduleDate(date);
};

export const listEquadleArchive = async (limit = 120): Promise<Array<{ puzzleDate: string }>> => {
  const supabase = getEquadleSupabaseAdmin();
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);

  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .lt("puzzle_date", today)
    .order("puzzle_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load Equadle archive: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({ puzzleDate: (row as { puzzle_date: string }).puzzle_date }));
};

export const getEquadleAnswer = async (puzzleId: string): Promise<PuzzleRow | null> => {
  const supabase = getEquadleSupabaseAdmin();

  const { data, error } = await supabase
    .from("puzzles")
    .select("id,equation,equation_length")
    .eq("id", puzzleId)
    .maybeSingle<PuzzleRow>();

  if (error) {
    throw new Error(`Failed to load Equadle answer: ${error.message}`);
  }

  return data;
};
