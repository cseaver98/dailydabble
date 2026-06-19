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
};

export const recordGameCompletionQuietly = (input: RecordGameCompletionInput) => {
  void recordGameCompletion(input).catch((error) => {
    console.warn(error instanceof Error ? error.message : "Failed to record game completion");
  });
};
