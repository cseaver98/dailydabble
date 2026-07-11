import { games } from "@/lib/games";
import { getTodayPuzzleDate } from "@/lib/puzzle-date";
import { getSubscriptionAccess } from "@/lib/subscriptions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  calculateBestCompletionStreak,
  calculateCurrentCompletionStreak,
  calculateDailyTrophyDates,
  calculateFavoriteGame,
  dedupeDailyCompletions,
} from "@/lib/daily-completion-stats";

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
  favoriteGame: {
    gameSlug: string;
    gameName: string;
    totalCompletions: number;
    lastCompletedAt: string;
  } | null;
  trophies: {
    total: number;
    currentMonth: number;
    bestMonth: {
      month: string;
      count: number;
    } | null;
    dates: string[];
  };
  entitlements: {
    advancedStats: boolean;
  };
};

const roundRate = (value: number) => Math.round(value * 1000) / 1000;
const roundAverage = (value: number) => Math.round(value * 100) / 100;

const summarizeGame = (gameSlug: string, gameName: string, rows: GameResultRow[], today: string): GameStats => {
  const dailyRows = dedupeDailyCompletions(rows, new Set([gameSlug]));
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
    currentStreak: calculateCurrentCompletionStreak(dailyRows.map((row) => row.puzzle_date), today),
    lastPlayedAt,
  };
};

export async function getAccountStats(userId: string): Promise<AccountStats> {
  const subscriptionAccess = await getSubscriptionAccess(userId);
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

  const today = getTodayPuzzleDate();
  const gameStats = games.map((game) => summarizeGame(game.slug, game.name, statsByGame.get(game.slug) ?? [], today));
  const dailyRows = dedupeDailyCompletions(rows, new Set(games.map((game) => game.slug)));
  const archiveRows = rows.filter((row) => row.is_archive);
  const played = dailyRows.length;
  const wins = dailyRows.filter((row) => row.is_win).length;
  const dailyPlayed = dailyRows.length;
  const guesses = dailyRows.map((row) => row.guesses_used);
  const completedTodayCount = new Set(
    rows
      .filter((row) => !row.is_archive && row.puzzle_date === today)
      .map((row) => row.game_slug),
  ).size;
  const trophyDates = calculateDailyTrophyDates(dailyRows, new Set(games.map((game) => game.slug)));
  const currentMonth = today.slice(0, 7);
  const trophiesByMonth = trophyDates.reduce((months, date) => {
    const month = date.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + 1);
    return months;
  }, new Map<string, number>());
  const bestMonth = [...trophiesByMonth.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0] ?? null;

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
      currentDailyDabbleStreak: calculateCurrentCompletionStreak(dailyRows.map((row) => row.puzzle_date), today),
      bestDailyDabbleStreak: calculateBestCompletionStreak(dailyRows.map((row) => row.puzzle_date), today),
      completedTodayCount,
      totalGamesToday: games.length,
    },
    games: gameStats,
    favoriteGame: calculateFavoriteGame(dailyRows, games),
    trophies: {
      total: trophyDates.length,
      currentMonth: trophiesByMonth.get(currentMonth) ?? 0,
      bestMonth: bestMonth ? { month: bestMonth[0], count: bestMonth[1] } : null,
      dates: trophyDates,
    },
    entitlements: {
      advancedStats: subscriptionAccess.canAccessPremiumStats,
    },
  };
}
