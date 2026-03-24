import { getMoviedleSupabaseAdmin } from "./supabase";

const DEFAULT_TIMEZONE = process.env.PUZZLE_TIMEZONE || "America/New_York";

const isDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeTitle = (value) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

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

const mapPuzzle = (scheduleRow, movieRow) => {
  const stillUrls = Array.isArray(movieRow.still_urls) ? movieRow.still_urls.filter(Boolean).slice(0, 6) : [];
  const stillImages = stillUrls.map((url, index) => ({
    url,
    alt: `Movie still ${index + 1}`,
  }));

  return {
    puzzleId: movieRow.id,
    puzzleDate: scheduleRow.puzzle_date,
    maxGuesses: 5,
    stillImages,
  };
};

const getPuzzleByScheduleDate = async (date) => {
  const supabase = getMoviedleSupabaseAdmin();

  const { data: scheduleRow, error: scheduleError } = await supabase
    .from("daily_schedule")
    .select("puzzle_date,movie_id")
    .eq("puzzle_date", date)
    .maybeSingle();

  if (scheduleError) {
    throw new Error(`Failed to load moviedle schedule: ${scheduleError.message}`);
  }

  if (!scheduleRow) {
    return null;
  }

  const { data: movieRow, error: movieError } = await supabase
    .from("movies")
    .select("id,title,still_urls")
    .eq("id", scheduleRow.movie_id)
    .maybeSingle();

  if (movieError) {
    throw new Error(`Failed to load moviedle movie: ${movieError.message}`);
  }

  if (!movieRow) {
    return null;
  }

  return mapPuzzle(scheduleRow, movieRow);
};

const getLatestPuzzleOnOrBefore = async (date) => {
  const supabase = getMoviedleSupabaseAdmin();

  const { data: scheduleRow, error: scheduleError } = await supabase
    .from("daily_schedule")
    .select("puzzle_date,movie_id")
    .lte("puzzle_date", date)
    .order("puzzle_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (scheduleError) {
    throw new Error(`Failed to load fallback moviedle schedule: ${scheduleError.message}`);
  }

  if (!scheduleRow) {
    return null;
  }

  const { data: movieRow, error: movieError } = await supabase
    .from("movies")
    .select("id,title,still_urls")
    .eq("id", scheduleRow.movie_id)
    .maybeSingle();

  if (movieError) {
    throw new Error(`Failed to load fallback moviedle movie: ${movieError.message}`);
  }

  if (!movieRow) {
    return null;
  }

  return mapPuzzle(scheduleRow, movieRow);
};

export const getTodayMoviedlePuzzle = async () => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const exact = await getPuzzleByScheduleDate(today);
  if (exact) {
    return exact;
  }
  return getLatestPuzzleOnOrBefore(today);
};

export const getMoviedlePuzzleByDate = async (date) => {
  if (!isDateString(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  return getPuzzleByScheduleDate(date);
};

export const listMoviedleArchive = async (limit = 120) => {
  const supabase = getMoviedleSupabaseAdmin();
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);

  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .lte("puzzle_date", today)
    .order("puzzle_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load moviedle archive: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({ puzzleDate: row.puzzle_date }));
};

export const submitMovieGuess = async (puzzleId, guessTitle, guessCount) => {
  const supabase = getMoviedleSupabaseAdmin();

  const { data: movieRow, error } = await supabase
    .from("movies")
    .select("id,title,title_normalized,aliases_normalized")
    .eq("id", puzzleId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load answer: ${error.message}`);
  }

  if (!movieRow) {
    return null;
  }

  const normalizedGuess = normalizeTitle(guessTitle);
  const aliases = Array.isArray(movieRow.aliases_normalized) ? movieRow.aliases_normalized : [];
  const isCorrect = normalizedGuess === movieRow.title_normalized || aliases.includes(normalizedGuess);
  const shouldReveal = isCorrect || guessCount >= 4;

  return {
    puzzleId: movieRow.id,
    isCorrect,
    answerTitle: shouldReveal ? movieRow.title : null,
  };
};

export const createMoviedlePuzzle = async ({ title, aliases, puzzleDate, stillUrls }) => {
  const supabase = getMoviedleSupabaseAdmin();

  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) {
    throw new Error("Movie title is required");
  }

  const aliasList = Array.isArray(aliases)
    ? aliases
        .map((alias) => String(alias || "").trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];

  const normalizedAliases = aliasList
    .map((alias) => normalizeTitle(alias))
    .filter((alias) => alias && alias !== normalizedTitle);

  const cleanStillUrls = Array.isArray(stillUrls)
    ? stillUrls.map((url) => String(url || "").trim()).filter(Boolean).slice(0, 6)
    : [];

  if (cleanStillUrls.length < 1) {
    throw new Error("At least one still image URL is required");
  }

  if (!isDateString(puzzleDate)) {
    throw new Error("puzzleDate must be YYYY-MM-DD");
  }

  const { data: movieRow, error: movieError } = await supabase
    .from("movies")
    .insert({
      title: title.trim(),
      title_normalized: normalizedTitle,
      aliases: aliasList,
      aliases_normalized: normalizedAliases,
      still_urls: cleanStillUrls,
    })
    .select("id")
    .maybeSingle();

  if (movieError) {
    throw new Error(`Failed to create movie: ${movieError.message}`);
  }

  if (!movieRow) {
    throw new Error("Failed to create movie record");
  }

  const { error: scheduleError } = await supabase
    .from("daily_schedule")
    .upsert({ puzzle_date: puzzleDate, movie_id: movieRow.id }, { onConflict: "puzzle_date" });

  if (scheduleError) {
    throw new Error(`Failed to schedule puzzle: ${scheduleError.message}`);
  }

  return { movieId: movieRow.id, puzzleDate };
};
