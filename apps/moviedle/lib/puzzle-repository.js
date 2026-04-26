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

const mapAnswerDetails = (movieRow) => ({
  title: movieRow.title || null,
  releaseYear: Number.isFinite(movieRow.release_year) ? Number(movieRow.release_year) : null,
  summary: movieRow.summary || null,
  leadActors: Array.isArray(movieRow.lead_actors) ? movieRow.lead_actors.filter(Boolean).slice(0, 8) : [],
});

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

const autoScheduleApprovedPuzzleForDate = async (date) => {
  const supabase = getMoviedleSupabaseAdmin();

  const { data: approvedRows, error: approvedError } = await supabase
    .from("movies")
    .select("id,title,still_urls,created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(5000);

  if (approvedError) {
    throw new Error(`Failed to load approved moviedle movies: ${approvedError.message}`);
  }

  const candidates = Array.isArray(approvedRows) ? approvedRows : [];
  for (const candidate of candidates) {
    const { data: alreadyScheduled, error: scheduleLookupError } = await supabase
      .from("daily_schedule")
      .select("puzzle_date")
      .eq("movie_id", candidate.id)
      .maybeSingle();

    if (scheduleLookupError) {
      throw new Error(`Failed to check moviedle schedule usage: ${scheduleLookupError.message}`);
    }

    if (alreadyScheduled) {
      continue;
    }

    const { error: insertError } = await supabase.from("daily_schedule").insert({
      puzzle_date: date,
      movie_id: candidate.id,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        const existing = await getPuzzleByScheduleDate(date);
        if (existing) {
          return existing;
        }
        continue;
      }
      throw new Error(`Failed to auto-schedule moviedle puzzle: ${insertError.message}`);
    }

    return mapPuzzle(
      { puzzle_date: date, movie_id: candidate.id },
      candidate,
    );
  }

  return null;
};

export const getTodayMoviedlePuzzle = async () => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const scheduled = await getPuzzleByScheduleDate(today);
  if (scheduled) {
    return scheduled;
  }

  return autoScheduleApprovedPuzzleForDate(today);
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
    .select("id,title,title_normalized,aliases_normalized,release_year,summary,lead_actors")
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
    answerDetails: shouldReveal ? mapAnswerDetails(movieRow) : null,
  };
};

export const createMoviedlePuzzle = async ({ title, aliases, puzzleDate, stillUrls, releaseYear, summary, leadActors }) => {
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

  const parsedReleaseYear =
    Number.isFinite(Number(releaseYear)) && Number(releaseYear) >= 1888 && Number(releaseYear) <= 2100
      ? Math.floor(Number(releaseYear))
      : null;
  const cleanSummary = typeof summary === "string" ? summary.trim().slice(0, 4000) : null;
  const cleanLeadActors = Array.isArray(leadActors)
    ? leadActors
        .map((actor) => String(actor || "").trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const { data: movieRow, error: movieError } = await supabase
    .from("movies")
    .insert({
      title: title.trim(),
      title_normalized: normalizedTitle,
      aliases: aliasList,
      aliases_normalized: normalizedAliases,
      still_urls: cleanStillUrls,
      release_year: parsedReleaseYear,
      summary: cleanSummary || null,
      lead_actors: cleanLeadActors,
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

export const searchMoviedleTitles = async (query, limit = 8) => {
  const supabase = getMoviedleSupabaseAdmin();
  const normalized = normalizeTitle(String(query || ""));
  if (!normalized || normalized.length < 2) {
    return [];
  }

  const max = Number.isFinite(Number(limit)) ? Math.min(Math.max(1, Number(limit)), 12) : 8;
  const { data, error } = await supabase
    .from("movie_titles")
    .select("id,title,title_normalized")
    .ilike("title_normalized", `%${normalized}%`)
    .order("title", { ascending: true })
    .limit(Math.min(60, max * 4));

  if (error) {
    throw new Error(`Failed to search movie titles: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  rows.sort((a, b) => {
    const aNorm = String(a.title_normalized || "");
    const bNorm = String(b.title_normalized || "");
    const aStarts = aNorm.startsWith(normalized);
    const bStarts = bNorm.startsWith(normalized);
    if (aStarts !== bStarts) {
      return aStarts ? -1 : 1;
    }
    return String(a.title || "").localeCompare(String(b.title || ""));
  });

  return rows.slice(0, max).map((row) => ({
    id: row.id,
    title: row.title,
  }));
};
