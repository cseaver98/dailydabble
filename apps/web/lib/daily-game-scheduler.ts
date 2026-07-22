import { getTodayPuzzle as getTodayAgegaplePuzzle } from "@/lib/agegaple/puzzle-repository";
import { getTodayDoodlePuzzle } from "@/lib/doodle/puzzle-repository";
import { getTodayEquadlePuzzle } from "@/lib/equadle/puzzle-repository";
import { getTodayMoviedlePuzzle } from "@/lib/moviedle/puzzle-repository";
import { getTodaySportlePuzzle } from "@/lib/sportle/puzzle-repository";
import { getTodayVerblePuzzle } from "@/lib/verble/puzzle-repository";
import { getTodayYeardlePuzzle } from "@/lib/yeardle/puzzle-repository";

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
  { gameSlug: "agegaple", getTodayPuzzle: getTodayAgegaplePuzzle },
  { gameSlug: "doodle", getTodayPuzzle: getTodayDoodlePuzzle },
  { gameSlug: "moviedle", getTodayPuzzle: getTodayMoviedlePuzzle },
  { gameSlug: "yeardle", getTodayPuzzle: getTodayYeardlePuzzle },
  { gameSlug: "sportle", getTodayPuzzle: getTodaySportlePuzzle },
  { gameSlug: "equadle", getTodayPuzzle: getTodayEquadlePuzzle },
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
