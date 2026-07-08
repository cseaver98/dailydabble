import { getYeardleSupabaseAdmin } from "./supabase";

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

type ScheduleRow = { puzzle_date: string; event_id: string };
type EventRow = {
  id: string;
  title: string;
  event_year: number;
  event_month?: number | null;
  event_day?: number | null;
  image_url: string;
  image_alt?: string | null;
  image_source_page_url?: string | null;
  image_license?: string | null;
  image_license_url?: string | null;
  image_author?: string | null;
  image_attribution_text?: string | null;
  wikipedia_url?: string | null;
  hint_description?: string | null;
  created_at?: string | null;
};

export type YeardlePuzzle = {
  puzzleId: string;
  puzzleDate: string;
  archiveGameNumber: number;
  eventTitle: string;
  eventYear: number;
  eventMonth: number | null | undefined;
  eventDay: number | null | undefined;
  imageUrl: string;
  imageAlt: string;
  imageSourcePageUrl: string | null | undefined;
  imageLicense: string | null | undefined;
  imageLicenseUrl: string | null | undefined;
  imageAuthor: string | null | undefined;
  imageAttributionText: string | null | undefined;
  wikipediaUrl: string | null | undefined;
  editorialContext: { description: string };
  maxGuesses: number;
};

const getArchiveGameNumber = async (date: string): Promise<number> => {
  const supabase = getYeardleSupabaseAdmin();
  const { count, error } = await supabase
    .from("daily_schedule")
    .select("*", { count: "exact", head: true })
    .lte("puzzle_date", date);

  if (error) {
    throw new Error(`Failed to count yeardle archive games: ${error.message}`);
  }

  return count ?? 0;
};

const mapPuzzle = async (scheduleRow: ScheduleRow, eventRow: EventRow): Promise<YeardlePuzzle> => {
  return {
    puzzleId: eventRow.id,
    puzzleDate: scheduleRow.puzzle_date,
    archiveGameNumber: await getArchiveGameNumber(scheduleRow.puzzle_date),
    eventTitle: eventRow.title,
    eventYear: eventRow.event_year,
    eventMonth: eventRow.event_month,
    eventDay: eventRow.event_day,
    imageUrl: eventRow.image_url,
    imageAlt: eventRow.image_alt || `Historical event image for ${eventRow.title}`,
    imageSourcePageUrl: eventRow.image_source_page_url,
    imageLicense: eventRow.image_license,
    imageLicenseUrl: eventRow.image_license_url,
    imageAuthor: eventRow.image_author,
    imageAttributionText: eventRow.image_attribution_text,
    wikipediaUrl: eventRow.wikipedia_url,
    editorialContext: {
      description: eventRow.hint_description || "No description provided.",
    },
    maxGuesses: 5,
  };
};

const getPuzzleByScheduleDate = async (date: string): Promise<YeardlePuzzle | null> => {
  const supabase = getYeardleSupabaseAdmin();

  const { data: scheduleRow, error: scheduleError } = await supabase
    .from("daily_schedule")
    .select("puzzle_date,event_id")
    .eq("puzzle_date", date)
    .maybeSingle<ScheduleRow>();

  if (scheduleError) {
    throw new Error(`Failed to load yeardle schedule: ${scheduleError.message}`);
  }

  if (!scheduleRow) {
    return null;
  }

  const { data: eventRow, error: eventError } = await supabase
    .from("events")
    .select("id,title,event_year,event_month,event_day,image_url,image_alt,image_source_page_url,image_license,image_license_url,image_author,image_attribution_text,wikipedia_url,hint_description")
    .eq("id", scheduleRow.event_id)
    .maybeSingle<EventRow>();

  if (eventError) {
    throw new Error(`Failed to load yeardle event: ${eventError.message}`);
  }

  if (!eventRow) {
    return null;
  }

  return mapPuzzle(scheduleRow, eventRow);
};

const autoScheduleApprovedPuzzleForDate = async (date: string): Promise<YeardlePuzzle | null> => {
  const supabase = getYeardleSupabaseAdmin();

  const { data: approvedRows, error: approvedError } = await supabase
    .from("events")
    .select("id,title,event_year,event_month,event_day,image_url,image_alt,image_source_page_url,image_license,image_license_url,image_author,image_attribution_text,wikipedia_url,hint_description,created_at")
    .eq("status", "approved")
    .not("image_license_verified_at", "is", null)
    .not("image_source_page_url", "is", null)
    .not("image_license", "is", null)
    .not("image_author", "is", null)
    .not("image_attribution_text", "is", null)
    .order("reviewed_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5000);

  if (approvedError) {
    throw new Error(`Failed to load approved yeardle events: ${approvedError.message}`);
  }

  const candidates = (Array.isArray(approvedRows) ? approvedRows : []) as EventRow[];
  const [, scheduledMonth, scheduledDay] = date.split("-").map((part) => Number(part));
  for (const candidate of candidates) {
    const hasEventMonthDay = typeof candidate.event_month === "number" && typeof candidate.event_day === "number";
    if (hasEventMonthDay && (candidate.event_month !== scheduledMonth || candidate.event_day !== scheduledDay)) {
      continue;
    }

    const { data: alreadyScheduled, error: scheduleLookupError } = await supabase
      .from("daily_schedule")
      .select("puzzle_date")
      .eq("event_id", candidate.id)
      .maybeSingle<{ puzzle_date: string }>();

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

    return mapPuzzle({ puzzle_date: date, event_id: candidate.id }, candidate);
  }

  return null;
};

export const assignTodayYeardlePuzzleFromQueue = async (): Promise<YeardlePuzzle | null> => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const existing = await getPuzzleByScheduleDate(today);
  if (existing) {
    return existing;
  }
  return autoScheduleApprovedPuzzleForDate(today);
};

export const getTodayYeardlePuzzle = async (): Promise<YeardlePuzzle | null> => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const scheduled = await getPuzzleByScheduleDate(today);
  if (scheduled) {
    return scheduled;
  }

  return autoScheduleApprovedPuzzleForDate(today);
};

export const getYeardlePuzzleByDate = async (date: string): Promise<YeardlePuzzle | null> => {
  if (!isDateString(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  return getPuzzleByScheduleDate(date);
};

export const listYeardleArchive = async (limit = 120): Promise<Array<{ puzzleDate: string }>> => {
  const supabase = getYeardleSupabaseAdmin();
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);

  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .lt("puzzle_date", today)
    .order("puzzle_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load yeardle archive: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({ puzzleDate: (row as { puzzle_date: string }).puzzle_date }));
};

export const submitYearGuess = async (puzzleId: string, guessYear: number) => {
  const supabase = getYeardleSupabaseAdmin();

  const { data: eventRow, error } = await supabase
    .from("events")
    .select("id,title,event_year")
    .eq("id", puzzleId)
    .maybeSingle<{ id: string; title: string; event_year: number }>();

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
