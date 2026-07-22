import { getMoviedleSupabaseAdmin } from "./supabase";

const DEFAULT_TIMEZONE = process.env.TIMEZONE || "America/New_York";

const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeTitle = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

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

type ScheduleRow = { puzzle_date: string; movie_id: string };
type MovieRow = {
  id: string;
  title: string;
  title_normalized?: string | null;
  aliases_normalized?: string[] | null;
  still_urls?: string[] | null;
  director?: string | null;
  summary?: string | null;
  lead_actors?: string[] | null;
  release_year?: number | null;
  reviewed_at?: string | null;
  created_at?: string | null;
};

export type MoviedlePuzzle = {
  puzzleId: string;
  puzzleDate: string;
  archiveGameNumber: number;
  editorialContext: {
    summary: string | null;
    director: string | null;
    leadActors: string[];
  };
  maxGuesses: number;
  stillImages: Array<{ url: string; alt: string }>;
};

const getArchiveGameNumber = async (date: string): Promise<number> => {
  const supabase = getMoviedleSupabaseAdmin();
  const { count, error } = await supabase
    .from("daily_schedule")
    .select("*", { count: "exact", head: true })
    .lte("puzzle_date", date);

  if (error) {
    throw new Error(`Failed to count moviedle archive games: ${error.message}`);
  }

  return count ?? 0;
};

const mapPuzzle = async (scheduleRow: ScheduleRow, movieRow: MovieRow): Promise<MoviedlePuzzle> => {
  const stillUrls = Array.isArray(movieRow.still_urls) ? movieRow.still_urls.filter(Boolean).slice(0, 6) : [];
  const stillImages = stillUrls.map((url, index) => ({
    url,
    alt: `Movie still ${index + 1}`,
  }));
  const archiveGameNumber = await getArchiveGameNumber(scheduleRow.puzzle_date);

  return {
    puzzleId: movieRow.id,
    puzzleDate: scheduleRow.puzzle_date,
    archiveGameNumber,
    editorialContext: {
      summary: movieRow.summary || null,
      director: movieRow.director || null,
      leadActors: Array.isArray(movieRow.lead_actors) ? movieRow.lead_actors.filter(Boolean).slice(0, 8) : [],
    },
    maxGuesses: 6,
    stillImages,
  };
};

const mapAnswerDetails = (movieRow: MovieRow) => ({
  title: movieRow.title || null,
  releaseYear: Number.isFinite(movieRow.release_year) ? Number(movieRow.release_year) : null,
  director: movieRow.director || null,
  summary: movieRow.summary || null,
  leadActors: Array.isArray(movieRow.lead_actors) ? movieRow.lead_actors.filter(Boolean).slice(0, 8) : [],
});

const getPuzzleByScheduleDate = async (date: string): Promise<MoviedlePuzzle | null> => {
  const supabase = getMoviedleSupabaseAdmin();

  const { data: scheduleRow, error: scheduleError } = await supabase
    .from("daily_schedule")
    .select("puzzle_date,movie_id")
    .eq("puzzle_date", date)
    .maybeSingle<ScheduleRow>();

  if (scheduleError) {
    throw new Error(`Failed to load moviedle schedule: ${scheduleError.message}`);
  }

  if (!scheduleRow) {
    return null;
  }

  const { data: movieRow, error: movieError } = await supabase
    .from("movies")
    .select("id,title,still_urls,director,summary,lead_actors")
    .eq("id", scheduleRow.movie_id)
    .maybeSingle<MovieRow>();

  if (movieError) {
    throw new Error(`Failed to load moviedle movie: ${movieError.message}`);
  }

  if (!movieRow) {
    return null;
  }

  return mapPuzzle(scheduleRow, movieRow);
};

const autoScheduleApprovedPuzzleForDate = async (date: string): Promise<MoviedlePuzzle | null> => {
  const supabase = getMoviedleSupabaseAdmin();

  const { data: approvedRows, error: approvedError } = await supabase
    .from("movies")
    .select("id,title,still_urls,director,summary,lead_actors,reviewed_at,created_at")
    .eq("status", "approved")
    .order("reviewed_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5000);

  if (approvedError) {
    throw new Error(`Failed to load approved moviedle movies: ${approvedError.message}`);
  }

  const candidates = ((Array.isArray(approvedRows) ? approvedRows : []) as MovieRow[]).filter(
    (candidate) => Array.isArray(candidate.still_urls) && candidate.still_urls.filter(Boolean).length === 6,
  );
  for (const candidate of candidates) {
    const { data: alreadyScheduled, error: scheduleLookupError } = await supabase
      .from("daily_schedule")
      .select("puzzle_date")
      .eq("movie_id", candidate.id)
      .maybeSingle<{ puzzle_date: string }>();

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

    return mapPuzzle({ puzzle_date: date, movie_id: candidate.id }, candidate);
  }

  return null;
};

export const getTodayMoviedlePuzzle = async (): Promise<MoviedlePuzzle | null> => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const scheduled = await getPuzzleByScheduleDate(today);
  if (scheduled) {
    return scheduled;
  }

  return autoScheduleApprovedPuzzleForDate(today);
};

export const assignTodayMoviedlePuzzleFromQueue = async (): Promise<MoviedlePuzzle | null> => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const existing = await getPuzzleByScheduleDate(today);
  if (existing) {
    return existing;
  }
  return autoScheduleApprovedPuzzleForDate(today);
};

export const getMoviedlePuzzleByDate = async (date: string): Promise<MoviedlePuzzle | null> => {
  if (!isDateString(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  return getPuzzleByScheduleDate(date);
};

export const listMoviedleArchive = async (limit = 120): Promise<Array<{ puzzleDate: string }>> => {
  const supabase = getMoviedleSupabaseAdmin();
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);

  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .lt("puzzle_date", today)
    .order("puzzle_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load moviedle archive: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({ puzzleDate: (row as { puzzle_date: string }).puzzle_date }));
};

export const submitMovieGuess = async (puzzleId: string, guessTitle: string, guessCount: number) => {
  const supabase = getMoviedleSupabaseAdmin();

  const { data: movieRow, error } = await supabase
    .from("movies")
    .select("id,title,title_normalized,aliases_normalized,release_year,director,summary,lead_actors")
    .eq("id", puzzleId)
    .maybeSingle<MovieRow>();

  if (error) {
    throw new Error(`Failed to load answer: ${error.message}`);
  }

  if (!movieRow) {
    return null;
  }

  const normalizedGuess = normalizeTitle(guessTitle);
  const aliases = Array.isArray(movieRow.aliases_normalized) ? movieRow.aliases_normalized : [];
  const isCorrect = normalizedGuess === movieRow.title_normalized || aliases.includes(normalizedGuess);
  const shouldReveal = isCorrect || guessCount >= 5;

  return {
    puzzleId: movieRow.id,
    isCorrect,
    answerTitle: shouldReveal ? movieRow.title : null,
    answerDetails: shouldReveal ? mapAnswerDetails(movieRow) : null,
  };
};

type CreateMoviedlePuzzleInput = {
  title: string;
  aliases?: string[];
  puzzleDate: string;
  stillUrls?: string[];
  releaseYear?: number | string | null;
  summary?: string | null;
  leadActors?: string[];
};

export const createMoviedlePuzzle = async ({
  title,
  aliases,
  puzzleDate,
  stillUrls,
  releaseYear,
  summary,
  leadActors,
}: CreateMoviedlePuzzleInput) => {
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

  if (cleanStillUrls.length !== 6) {
    throw new Error("Exactly six still image URLs are required");
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
    .maybeSingle<{ id: string }>();

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

export const searchMoviedleTitles = async (query: string, limit = 8) => {
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
    const aNorm = String((a as { title_normalized?: string }).title_normalized || "");
    const bNorm = String((b as { title_normalized?: string }).title_normalized || "");
    const aStarts = aNorm.startsWith(normalized);
    const bStarts = bNorm.startsWith(normalized);
    if (aStarts !== bStarts) {
      return aStarts ? -1 : 1;
    }
    return String((a as { title?: string }).title || "").localeCompare(String((b as { title?: string }).title || ""));
  });

  return rows.slice(0, max).map((row) => ({
    id: (row as { id: string }).id,
    title: (row as { title: string }).title,
  }));
};
