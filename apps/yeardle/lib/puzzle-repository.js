import { getYeardleSupabaseAdmin } from "./supabase";

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

const mapPuzzle = (scheduleRow, eventRow) => {
  const hints = [
    { label: "Category", value: eventRow.hint_category || "Unknown" },
    { label: "Region", value: eventRow.hint_region || "Unknown" },
    { label: "Era", value: eventRow.hint_era || "Unknown" },
    { label: "Key person", value: eventRow.hint_person || "Unknown" },
    { label: "Description", value: eventRow.hint_description || "No description provided." },
  ];

  return {
    puzzleId: eventRow.id,
    puzzleDate: scheduleRow.puzzle_date,
    eventTitle: eventRow.title,
    imageUrl: eventRow.image_url,
    imageAlt: eventRow.image_alt || `Historical event image for ${eventRow.title}`,
    wikipediaUrl: eventRow.wikipedia_url,
    hints,
    maxGuesses: 5,
  };
};

const getPuzzleByScheduleDate = async (date) => {
  const supabase = getYeardleSupabaseAdmin();

  const { data: scheduleRow, error: scheduleError } = await supabase
    .from("daily_schedule")
    .select("puzzle_date,event_id")
    .eq("puzzle_date", date)
    .maybeSingle();

  if (scheduleError) {
    throw new Error(`Failed to load yeardle schedule: ${scheduleError.message}`);
  }

  if (!scheduleRow) {
    return null;
  }

  const { data: eventRow, error: eventError } = await supabase
    .from("events")
    .select(
      "id,title,event_year,image_url,image_alt,wikipedia_url,hint_category,hint_region,hint_era,hint_person,hint_description",
    )
    .eq("id", scheduleRow.event_id)
    .maybeSingle();

  if (eventError) {
    throw new Error(`Failed to load yeardle event: ${eventError.message}`);
  }

  if (!eventRow) {
    return null;
  }

  return mapPuzzle(scheduleRow, eventRow);
};

const autoScheduleApprovedPuzzleForDate = async (date) => {
  const supabase = getYeardleSupabaseAdmin();

  const { data: approvedRows, error: approvedError } = await supabase
    .from("events")
    .select(
      "id,title,event_year,image_url,image_alt,wikipedia_url,hint_category,hint_region,hint_era,hint_person,hint_description,created_at",
    )
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(5000);

  if (approvedError) {
    throw new Error(`Failed to load approved yeardle events: ${approvedError.message}`);
  }

  const candidates = Array.isArray(approvedRows) ? approvedRows : [];
  for (const candidate of candidates) {
    const { data: alreadyScheduled, error: scheduleLookupError } = await supabase
      .from("daily_schedule")
      .select("puzzle_date")
      .eq("event_id", candidate.id)
      .maybeSingle();

    if (scheduleLookupError) {
      throw new Error(`Failed to check yeardle schedule usage: ${scheduleLookupError.message}`);
    }

    if (alreadyScheduled) {
      continue;
    }

    const { error: insertError } = await supabase.from("daily_schedule").insert({
      puzzle_date: date,
      event_id: candidate.id,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        const existing = await getPuzzleByScheduleDate(date);
        if (existing) {
          return existing;
        }
        continue;
      }
      throw new Error(`Failed to auto-schedule yeardle puzzle: ${insertError.message}`);
    }

    return mapPuzzle(
      { puzzle_date: date, event_id: candidate.id },
      candidate,
    );
  }

  return null;
};

export const getTodayYeardlePuzzle = async () => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const scheduled = await getPuzzleByScheduleDate(today);
  if (scheduled) {
    return scheduled;
  }

  return autoScheduleApprovedPuzzleForDate(today);
};

export const getYeardlePuzzleByDate = async (date) => {
  if (!isDateString(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  return getPuzzleByScheduleDate(date);
};

export const listYeardleArchive = async (limit = 120) => {
  const supabase = getYeardleSupabaseAdmin();
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);

  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .lte("puzzle_date", today)
    .order("puzzle_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load yeardle archive: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({ puzzleDate: row.puzzle_date }));
};

export const submitYearGuess = async (puzzleId, guessYear) => {
  const supabase = getYeardleSupabaseAdmin();

  const { data: eventRow, error } = await supabase
    .from("events")
    .select("id,title,event_year")
    .eq("id", puzzleId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load answer: ${error.message}`);
  }

  if (!eventRow) {
    return null;
  }

  const answer = Number(eventRow.event_year);
  const guess = Number(guessYear);
  const isCorrect = answer === guess;

  return {
    puzzleId: eventRow.id,
    guessYear: guess,
    answerYear: answer,
    isCorrect,
    direction: isCorrect ? "correct" : guess < answer ? "later" : "earlier",
    eventTitle: eventRow.title,
  };
};
