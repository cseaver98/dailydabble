import { getDoodleSupabaseAdmin } from "./supabase";

const DEFAULT_TIMEZONE = process.env.PUZZLE_TIMEZONE || "America/New_York";

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

const isDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const buildClues = (answer, stageCount) => {
  const hints = [];
  for (let index = 0; index < stageCount; index += 1) {
    const clueNumber = index + 1;
    if (index === stageCount - 1) {
      hints.push(`Clue ${clueNumber}: Final reveal. Think of \"${answer[0]?.toUpperCase() || "?"}\".`);
    } else if (index === 0) {
      hints.push(`Clue ${clueNumber}: First strokes are visible.`);
    } else {
      hints.push(`Clue ${clueNumber}: More of the doodle has been revealed.`);
    }
  }
  return hints;
};

const mapPuzzle = (scheduleRow, puzzleRow) => {
  const stageCount = Number.isFinite(puzzleRow.stage_count) ? Number(puzzleRow.stage_count) : 5;
  return {
    puzzleId: puzzleRow.id,
    puzzleDate: scheduleRow.puzzle_date,
    slug: puzzleRow.slug,
    answer: puzzleRow.answer,
    aliases: Array.isArray(puzzleRow.aliases) ? puzzleRow.aliases : [],
    viewBox: puzzleRow.view_box || "0 0 512 512",
    stageCount,
    stages: Array.isArray(puzzleRow.stages) ? puzzleRow.stages : [],
    clues: buildClues(puzzleRow.answer, stageCount),
  };
};

const getPuzzleByScheduleDate = async (date) => {
  const supabase = getDoodleSupabaseAdmin();

  const { data: scheduleRow, error: scheduleError } = await supabase
    .from("daily_schedule")
    .select("puzzle_date,puzzle_id")
    .eq("puzzle_date", date)
    .maybeSingle();

  if (scheduleError) {
    throw new Error(`Failed to load doodle schedule: ${scheduleError.message}`);
  }

  if (!scheduleRow) {
    return null;
  }

  const { data: puzzleRow, error: puzzleError } = await supabase
    .from("puzzles")
    .select("id,slug,answer,aliases,view_box,stage_count,stages")
    .eq("id", scheduleRow.puzzle_id)
    .maybeSingle();

  if (puzzleError) {
    throw new Error(`Failed to load doodle puzzle: ${puzzleError.message}`);
  }

  if (!puzzleRow) {
    return null;
  }

  return mapPuzzle(scheduleRow, puzzleRow);
};

const autoScheduleApprovedPuzzleForDate = async (date) => {
  const supabase = getDoodleSupabaseAdmin();

  const { data: approvedRows, error: approvedError } = await supabase
    .from("puzzles")
    .select("id,slug,answer,aliases,view_box,stage_count,stages,created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(250);

  if (approvedError) {
    throw new Error(`Failed to load approved doodle puzzles: ${approvedError.message}`);
  }

  const candidates = Array.isArray(approvedRows) ? approvedRows : [];
  for (const candidate of candidates) {
    const { data: alreadyScheduled, error: scheduleLookupError } = await supabase
      .from("daily_schedule")
      .select("puzzle_date")
      .eq("puzzle_id", candidate.id)
      .maybeSingle();

    if (scheduleLookupError) {
      throw new Error(`Failed to check doodle schedule usage: ${scheduleLookupError.message}`);
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
      throw new Error(`Failed to auto-schedule doodle puzzle: ${insertError.message}`);
    }

    await supabase
      .from("puzzles")
      .update({ status: "used" })
      .eq("id", candidate.id)
      .eq("status", "approved");

    return mapPuzzle(
      { puzzle_date: date, puzzle_id: candidate.id },
      candidate,
    );
  }

  return null;
};

export const getTodayDoodlePuzzle = async () => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const scheduled = await getPuzzleByScheduleDate(today);
  if (scheduled) {
    return scheduled;
  }

  return autoScheduleApprovedPuzzleForDate(today);
};

export const getDoodlePuzzleByDate = async (date) => {
  if (!isDateString(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }

  return getPuzzleByScheduleDate(date);
};

export const listDoodleArchive = async (limit = 90) => {
  const supabase = getDoodleSupabaseAdmin();
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);

  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .lt("puzzle_date", today)
    .order("puzzle_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load doodle archive: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({
    puzzleDate: row.puzzle_date,
  }));
};
