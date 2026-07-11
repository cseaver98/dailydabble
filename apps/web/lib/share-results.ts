import { trackEvent } from "@/lib/analytics-client";

type BuildShareTextOptions = {
  gameName: string;
  isArchiveView: boolean;
  puzzleDate?: string;
  didWin: boolean;
  guessesUsed: number;
  maxGuesses: number;
  visualRows?: string[];
  url: string;
};

type ShareResult = "shared" | "copied" | "failed" | "aborted";

export const buildGameShareText = ({
  gameName,
  isArchiveView,
  puzzleDate,
  didWin,
  guessesUsed,
  maxGuesses,
  visualRows = [],
  url,
}: BuildShareTextOptions) => {
  const title = `DailyDabble — ${gameName}${isArchiveView ? " Archive" : ""}`;
  const safeGuessesUsed = didWin ? guessesUsed : maxGuesses;
  const resultLine = didWin
    ? `Solved in ${safeGuessesUsed}/${maxGuesses} guesses`
    : `Missed in ${maxGuesses}/${maxGuesses} guesses`;

  return [
    title,
    puzzleDate || "",
    resultLine,
    ...visualRows.filter(Boolean),
    "",
    url,
  ].join("\n");
};

const trackSuccessfulShare = (method: "native" | "clipboard", text: string) => {
  const urlMatch = text.match(/https?:\/\/[^\s]+/g)?.at(-1);
  let gameSlug: string | undefined;
  let isArchive = false;

  if (urlMatch) {
    try {
      const url = new URL(urlMatch);
      gameSlug = url.pathname.split("/").filter(Boolean)[0];
      isArchive = url.pathname.includes("/archive");
    } catch {
      // The share still succeeded even if its URL cannot be parsed.
    }
  }

  trackEvent({ eventName: "result_shared", gameSlug, isArchive, metadata: { method } });
};

export const shareResultText = async (_title: string, text: string): Promise<ShareResult> => {
  if (!text) {
    return "failed";
  }

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      trackSuccessfulShare("native", text);
      return "shared";
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        return "aborted";
      }
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    trackSuccessfulShare("clipboard", text);
    return "copied";
  } catch {
    return "failed";
  }
};
