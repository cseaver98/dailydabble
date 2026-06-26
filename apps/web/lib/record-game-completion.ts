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

type CompletionResponse = {
  reminderPrompt?: {
    puzzleDate?: string;
  } | null;
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

  const payload = (await response.json().catch(() => ({}))) as CompletionResponse;
  if (payload.reminderPrompt?.puzzleDate && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("dailydabble:daily-reminder-prompt", {
        detail: { puzzleDate: payload.reminderPrompt.puzzleDate },
      }),
    );
  }
};

export const recordGameCompletionQuietly = (input: RecordGameCompletionInput) => {
  void recordGameCompletion(input).catch((error) => {
    console.warn(error instanceof Error ? error.message : "Failed to record game completion");
  });
};
