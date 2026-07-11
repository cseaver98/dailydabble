export type DailyCompletion = {
  game_slug: string;
  puzzle_date: string;
  is_archive: boolean;
  completed_at: string;
};

type GameDefinition = {
  slug: string;
  name: string;
};

export const previousPuzzleDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day));
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
};

export const dedupeDailyCompletions = <T extends DailyCompletion>(rows: T[], validGameSlugs: Set<string>): T[] => {
  const distinctRows = new Map<string, T>();

  for (const row of rows) {
    if (row.is_archive || !validGameSlugs.has(row.game_slug)) continue;
    const key = `${row.game_slug}:${row.puzzle_date}`;
    const existing = distinctRows.get(key);
    if (!existing || row.completed_at > existing.completed_at) {
      distinctRows.set(key, row);
    }
  }

  return [...distinctRows.values()];
};

export const buildCompletedGamesByDate = (rows: DailyCompletion[]) => {
  const completedGamesByDate = new Map<string, Set<string>>();

  for (const row of rows) {
    const completedGames = completedGamesByDate.get(row.puzzle_date) ?? new Set<string>();
    completedGames.add(row.game_slug);
    completedGamesByDate.set(row.puzzle_date, completedGames);
  }

  return completedGamesByDate;
};

export const calculateDailyTrophyDates = (rows: DailyCompletion[], requiredGameSlugs: Set<string>) => {
  const completedGamesByDate = buildCompletedGamesByDate(rows);

  return [...completedGamesByDate.entries()]
    .filter(([, completedGames]) => [...requiredGameSlugs].every((slug) => completedGames.has(slug)))
    .map(([date]) => date)
    .sort((a, b) => b.localeCompare(a));
};

export const calculateCurrentCompletionStreak = (dates: Iterable<string>, today: string) => {
  const completedDates = new Set(dates);
  if (!completedDates.size) return 0;

  let date = completedDates.has(today) ? today : previousPuzzleDate(today);
  let streak = 0;

  while (completedDates.has(date)) {
    streak += 1;
    date = previousPuzzleDate(date);
  }

  return streak;
};

export const calculateBestCompletionStreak = (dates: Iterable<string>, today: string) => {
  const completedDates = [...new Set(dates)].filter((date) => date <= today).sort();
  let bestStreak = 0;
  let currentStreak = 0;
  let priorDate: string | null = null;

  for (const date of completedDates) {
    currentStreak = priorDate && previousPuzzleDate(date) === priorDate ? currentStreak + 1 : 1;
    bestStreak = Math.max(bestStreak, currentStreak);
    priorDate = date;
  }

  return bestStreak;
};

export const calculateFavoriteGame = (
  rows: DailyCompletion[],
  gameDefinitions: GameDefinition[],
) => {
  return gameDefinitions
    .map((game) => {
      const gameRows = rows.filter((row) => row.game_slug === game.slug);
      const lastCompletedAt = gameRows.reduce(
        (latest, row) => (row.completed_at > latest ? row.completed_at : latest),
        "",
      );
      return {
        gameSlug: game.slug,
        gameName: game.name,
        totalCompletions: gameRows.length,
        lastCompletedAt,
      };
    })
    .filter((game) => game.totalCompletions > 0)
    .sort((a, b) =>
      b.totalCompletions - a.totalCompletions ||
      b.lastCompletedAt.localeCompare(a.lastCompletedAt) ||
      a.gameName.localeCompare(b.gameName),
    )[0] ?? null;
};
