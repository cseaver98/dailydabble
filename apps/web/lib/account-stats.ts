import { games } from "@/lib/games";
import { getTodayPuzzleDate } from "@/lib/puzzle-date";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type GameResultRow = {
  id: string;
  game_slug: string;
  puzzle_date: string;
  is_archive: boolean;
  is_win: boolean;
  guesses_used: number;
  max_guesses: number;
  completed_at: string;
};

export type GameStats = {
  gameSlug: string;
  gameName: string;
  played: number;
  dailyPlayed: number;
  archivePlayed: number;
  wins: number;
  losses: number;
  winRate: number | null;
  averageGuesses: number | null;
  bestGuesses: number | null;
  currentStreak: number;
  lastPlayedAt: string | null;
};

export type AccountStats = {
  generatedAt: string;
  userId: string;
  overall: {
    played: number;
    dailyPlayed: number;
    archivePlayed: number;
    wins: number;
    losses: number;
    winRate: number | null;
    averageGuesses: number | null;
    currentDailyDabbleStreak: number;
    bestDailyDabbleStreak: number;
    completedTodayCount: number;
    totalGamesToday: number;
  };
  games: GameStats[];
  entitlements: {
    advancedStats: boolean;
  };
};

const roundRate = (value: number) => Math.round(value * 1000) / 1000;
const roundAverage = (value: number) => Math.round(value * 100) / 100;

const previousDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() - 1);
  return next.toISOString().slice(0, 10);
};

const calculateWinStreak = (dailyRows: GameResultRow[]) => {
  const resultByDate = new Map(dailyRows.map((row) => [row.puzzle_date, row]));
  if (!resultByDate.size) {
    return 0;
  }

  let date = getTodayPuzzleDate();
  if (!resultByDate.has(date)) {
    date = previousDate(date);
  }

  let streak = 0;
  while (true) {
    const result = resultByDate.get(date);
    if (!result?.is_win) {
      return streak;
    }
    streak += 1;
    date = previousDate(date);
  }
};

const calculateDailyDabbleStreak = (rows: GameResultRow[]) => {
  const requiredGameSlugs = new Set(games.map((game) => game.slug));
  const completedGamesByDate = new Map<string, Set<string>>();

  for (const row of rows) {
    if (row.is_archive) continue;
    const completedGames = completedGamesByDate.get(row.puzzle_date) ?? new Set<string>();
    completedGames.add(row.game_slug);
    completedGamesByDate.set(row.puzzle_date, completedGames);
  }

  const isCompleteDate = (date: string) => {
    const completedGames = completedGamesByDate.get(date);
    if (!completedGames) return false;
    return [...requiredGameSlugs].every((slug) => completedGames.has(slug));
  };

  let date = getTodayPuzzleDate();
  if (!isCompleteDate(date)) {
    date = previousDate(date);
  }

  let streak = 0;
  while (isCompleteDate(date)) {
    streak += 1;
    date = previousDate(date);
  }

  return streak;
};

const calculateBestDailyDabbleStreak = (rows: GameResultRow[]) => {
  const requiredGameSlugs = new Set(games.map((game) => game.slug));
  const completedGamesByDate = new Map<string, Set<string>>();

  for (const row of rows) {
    if (row.is_archive) continue;
    const completedGames = completedGamesByDate.get(row.puzzle_date) ?? new Set<string>();
    completedGames.add(row.game_slug);
    completedGamesByDate.set(row.puzzle_date, completedGames);
  }

  const completeDates = [...completedGamesByDate.entries()]
    .filter(([, completedGames]) => [...requiredGameSlugs].every((slug) => completedGames.has(slug)))
    .map(([date]) => date)
    .sort();

  let bestStreak = 0;
  let currentStreak = 0;
  let previousCompleteDate: string | null = null;

  for (const date of completeDates) {
    currentStreak = previousCompleteDate && previousDate(date) === previousCompleteDate ? currentStreak + 1 : 1;
    bestStreak = Math.max(bestStreak, currentStreak);
    previousCompleteDate = date;
  }

  return bestStreak;
};

const summarizeGame = (gameSlug: string, gameName: string, rows: GameResultRow[]): GameStats => {
  const dailyRows = rows.filter((row) => !row.is_archive);
  const archiveRows = rows.filter((row) => row.is_archive);
  const played = dailyRows.length;
  const wins = dailyRows.filter((row) => row.is_win).length;
  const losses = played - wins;
  const guesses = dailyRows.map((row) => row.guesses_used);
  const lastPlayedAt = rows.reduce<string | null>((latest, row) => {
    if (!latest || row.completed_at > latest) {
      return row.completed_at;
    }
    return latest;
  }, null);

  return {
    gameSlug,
    gameName,
    played,
    dailyPlayed: dailyRows.length,
    archivePlayed: archiveRows.length,
    wins,
    losses,
    winRate: played ? roundRate(wins / played) : null,
    averageGuesses: guesses.length ? roundAverage(guesses.reduce((sum, value) => sum + value, 0) / guesses.length) : null,
    bestGuesses: guesses.length ? Math.min(...guesses) : null,
    currentStreak: calculateWinStreak(dailyRows),
    lastPlayedAt,
  };
};

export async function getAccountStats(userId: string): Promise<AccountStats> {
  const { data, error } = await getSupabaseAdmin()
    .schema("core")
    .from("game_results")
    .select("id,game_slug,puzzle_date,is_archive,is_win,guesses_used,max_guesses,completed_at")
    .eq("user_id", userId)
    .order("puzzle_date", { ascending: false })
    .order("completed_at", { ascending: false })
    .returns<GameResultRow[]>();

  if (error) {
    throw new Error(`Failed to load account stats: ${error.message}`);
  }

  const rows = data ?? [];
  const statsByGame = new Map<string, GameResultRow[]>();
  for (const row of rows) {
    const gameRows = statsByGame.get(row.game_slug) ?? [];
    gameRows.push(row);
    statsByGame.set(row.game_slug, gameRows);
  }

  const gameStats = games.map((game) => summarizeGame(game.slug, game.name, statsByGame.get(game.slug) ?? []));
  const dailyRows = rows.filter((row) => !row.is_archive);
  const archiveRows = rows.filter((row) => row.is_archive);
  const played = dailyRows.length;
  const wins = dailyRows.filter((row) => row.is_win).length;
  const dailyPlayed = dailyRows.length;
  const guesses = dailyRows.map((row) => row.guesses_used);
  const today = getTodayPuzzleDate();
  const completedTodayCount = new Set(
    rows
      .filter((row) => !row.is_archive && row.puzzle_date === today)
      .map((row) => row.game_slug),
  ).size;

  return {
    generatedAt: new Date().toISOString(),
    userId,
    overall: {
      played,
      dailyPlayed,
      archivePlayed: archiveRows.length,
      wins,
      losses: played - wins,
      winRate: played ? roundRate(wins / played) : null,
      averageGuesses: guesses.length ? roundAverage(guesses.reduce((sum, value) => sum + value, 0) / guesses.length) : null,
      currentDailyDabbleStreak: calculateDailyDabbleStreak(rows),
      bestDailyDabbleStreak: calculateBestDailyDabbleStreak(rows),
      completedTodayCount,
      totalGamesToday: games.length,
    },
    games: gameStats,
    entitlements: {
      advancedStats: false,
    },
  };
}
