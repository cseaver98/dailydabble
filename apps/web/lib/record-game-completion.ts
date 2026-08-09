import { trackEventOnce } from "@/lib/analytics-client";

export type RecordGameCompletionInput = {
  gameSlug: string;
  puzzleId: string;
  puzzleDate: string;
  isArchive?: boolean;
  isWin: boolean;
  guessesUsed: number;
  maxGuesses: number;
  resultPayload?: Record<string, unknown>;
};

const dispatchTodayCompletionRecorded = (input: RecordGameCompletionInput) => {
  if (typeof window === "undefined" || input.isArchive) return;

  window.dispatchEvent(
    new CustomEvent("dailydabble:today-completion-recorded", {
      detail: {
        gameSlug: input.gameSlug,
        puzzleDate: input.puzzleDate,
      },
    }),
  );
};

export const recordGameCompletion = async (input: RecordGameCompletionInput) => {
  const response = await fetch("/api/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload.error === "string" ? payload.error : "Failed to record game completion";
    throw new Error(message);
  }

  dispatchTodayCompletionRecorded(input);
  trackEventOnce(`completed:${input.gameSlug}:${input.puzzleDate}:${Boolean(input.isArchive)}`, {
    eventName: "game_completed",
    gameSlug: input.gameSlug,
    puzzleDate: input.puzzleDate,
    isArchive: Boolean(input.isArchive),
    metadata: {
      didWin: input.isWin,
      guessesUsed: input.guessesUsed,
      maxGuesses: input.maxGuesses,
    },
  });

};

export const recordGameCompletionQuietly = (input: RecordGameCompletionInput) => {
  void recordGameCompletion(input).catch((error) => {
    console.warn(error instanceof Error ? error.message : "Failed to record game completion");
  });
};
