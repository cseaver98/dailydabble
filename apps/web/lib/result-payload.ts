type ResultPayloadInput = {
  attempts?: unknown[];
  answer?: Record<string, unknown>;
  final?: Record<string, unknown>;
  isWin: boolean;
  guessesUsed: number;
  maxGuesses: number;
  submittedGuesses?: number;
  stats?: Record<string, unknown>;
};

export const buildResultPayload = ({
  attempts,
  answer = {},
  final = {},
  isWin,
  guessesUsed,
  maxGuesses,
  submittedGuesses = guessesUsed,
  stats = {},
}: ResultPayloadInput) => ({
  version: 1,
  attempts: attempts ?? [],
  answer,
  final,
  stats: {
    guessesUsed,
    maxGuesses,
    submittedGuesses,
    wrongGuesses: isWin ? Math.max(0, guessesUsed - 1) : guessesUsed,
    ...stats,
  },
});
