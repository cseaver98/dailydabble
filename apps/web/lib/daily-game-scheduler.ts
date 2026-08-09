import { getTodayVerblePuzzle } from "@/lib/verble/puzzle-repository";

type ScheduledPuzzle = {
  puzzleDate: string;
};

type ScheduleResult =
  | { gameSlug: string; status: "scheduled"; puzzleDate: string }
  | { gameSlug: string; status: "empty_queue" }
  | { gameSlug: string; status: "error"; error: string };

const schedulers: Array<{
  gameSlug: string;
  getTodayPuzzle: () => Promise<ScheduledPuzzle | null>;
}> = [
  { gameSlug: "verble", getTodayPuzzle: getTodayVerblePuzzle },
];

export const scheduleTodayGames = async (): Promise<ScheduleResult[]> =>
  Promise.all(
    schedulers.map(async ({ gameSlug, getTodayPuzzle }): Promise<ScheduleResult> => {
      try {
        const puzzle = await getTodayPuzzle();
        return puzzle
          ? { gameSlug, status: "scheduled", puzzleDate: puzzle.puzzleDate }
          : { gameSlug, status: "empty_queue" };
      } catch (error) {
        return {
          gameSlug,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown scheduling error",
        };
      }
    }),
  );
