"use client";

export type StoredGameResult = {
  gameSlug: string;
  puzzleId: string;
  puzzleDate: string;
  isArchive: boolean;
  isWin: boolean;
  guessesUsed: number;
  maxGuesses: number;
  resultPayload: Record<string, unknown>;
  completedAt: string;
};

export const fetchStoredGameResult = async ({
  gameSlug,
  puzzleId,
  puzzleDate,
  isArchive,
}: {
  gameSlug: string;
  puzzleId: string;
  puzzleDate: string;
  isArchive: boolean;
}): Promise<StoredGameResult | null> => {
  const params = new URLSearchParams({
    gameSlug,
    puzzleId,
    puzzleDate,
    isArchive: String(isArchive),
  });
  const response = await fetch(`/api/completions/result?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => ({ result: null }))) as {
    result?: StoredGameResult | null;
  };
  return payload.result ?? null;
};

export const getResultPayloadAttempts = (result: StoredGameResult | null): unknown[] => {
  const attempts = result?.resultPayload?.attempts;
  return Array.isArray(attempts) ? attempts : [];
};

export const getResultPayloadAnswer = (result: StoredGameResult | null): Record<string, unknown> => {
  const answer = result?.resultPayload?.answer;
  return answer && typeof answer === "object" && !Array.isArray(answer) ? answer as Record<string, unknown> : {};
};
