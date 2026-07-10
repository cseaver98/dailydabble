"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import { toPublicAppUrl } from "../../../lib/app-url";
import { recordGameCompletionQuietly } from "../../../lib/record-game-completion";
import { buildResultPayload } from "../../../lib/result-payload";
import { buildGameShareText, shareResultText } from "../../../lib/share-results";
import { fetchStoredGameResult, getResultPayloadAnswer, getResultPayloadAttempts } from "../../../lib/stored-game-result";
import { useNextGameCountdown } from "../../../lib/use-next-game-countdown";
import ArchiveLockGate from "../../components/ArchiveLockGate";
import AsyncImage from "../../components/AsyncImage";
import HowToPlayDialog from "../../components/HowToPlayDialog";
import LoadingLabel from "../../components/LoadingLabel";
import ResultDialogActions from "../../components/ResultDialogActions";
import MainNav from "./MainNav";
import EditorialDrawer from "./EditorialDrawer";

type MoviedleGameClientProps = {
  apiUrl: string;
  navLabel?: string;
  hideToday?: boolean;
  archiveHref?: string;
  storagePrefix?: string;
  completionPrefix?: string;
  lockDailyCompletion?: boolean;
};
type Suggestion = { id: string; title: string };
type Attempt = { guess: string; isCorrect: boolean; normalizedGuess?: string };
type MoviedleGameState = "playing" | "won" | "lost";
type RevealedDetails = {
  title?: string;
  releaseYear?: number;
  director?: string | null;
  leadActors?: string[];
  summary?: string | null;
} | null;
type MoviedlePuzzle = {
  puzzleId: string;
  puzzleDate: string;
  archiveGameNumber?: number;
  maxGuesses: number;
  stillImages: Array<{ url: string; alt: string }>;
  editorialContext?: { summary?: string | null; director?: string | null; leadActors?: string[] } | null;
};
type RestoredMoviedleState = {
  guess: string;
  attempts: Attempt[];
  gameState: MoviedleGameState;
  message: string;
  revealedAnswer: string;
  revealedDetails: RevealedDetails;
  isResultOpen: boolean;
};

const normalizeGuess = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const getDefaultRestoredMoviedleState = (): RestoredMoviedleState => ({
  guess: "",
  attempts: [],
  gameState: "playing",
  message: "",
  revealedAnswer: "",
  revealedDetails: null,
  isResultOpen: false,
});
const normalizeRevealedDetails = (value: unknown): RevealedDetails =>
  value && typeof value === "object" ? (value as NonNullable<RevealedDetails>) : null;
const restoreMoviedleState = ({
  puzzleId,
  progressKey,
  completionKey,
  lockDailyCompletion,
}: {
  puzzleId: string;
  progressKey: string;
  completionKey: string;
  lockDailyCompletion: boolean;
}): RestoredMoviedleState => {
  const parseStored = (raw: string, key: string): RestoredMoviedleState => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.puzzleId && parsed.puzzleId !== puzzleId) {
        return getDefaultRestoredMoviedleState();
      }
      const parsedState = parsed.gameState;
      const gameState = parsedState === "won" || parsedState === "lost" ? parsedState : "playing";
      return {
        guess: typeof parsed.guess === "string" ? parsed.guess : "",
        attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
        gameState,
        message: typeof parsed.message === "string" ? parsed.message : "",
        revealedAnswer: typeof parsed.revealedAnswer === "string" ? parsed.revealedAnswer : "",
        revealedDetails: normalizeRevealedDetails(parsed.revealedDetails),
        isResultOpen: gameState !== "playing",
      };
    } catch {
      window.localStorage.removeItem(key);
      return getDefaultRestoredMoviedleState();
    }
  };

  if (lockDailyCompletion) {
    const completionRaw = window.localStorage.getItem(completionKey);
    if (completionRaw) {
      return parseStored(completionRaw, completionKey);
    }
  }

  const raw = window.localStorage.getItem(progressKey);
  if (!raw) {
    return getDefaultRestoredMoviedleState();
  }

  const restored = parseStored(raw, progressKey);
  if (!lockDailyCompletion && restored.gameState !== "playing") {
    window.localStorage.removeItem(progressKey);
    return getDefaultRestoredMoviedleState();
  }
  return restored;
};

const getPerformanceLabel = (didWin: boolean, attemptsUsed: number, maxGuesses: number) => {
  if (!didWin) {
    return "Better luck next time.";
  }
  if (attemptsUsed <= 1) {
    return "Amazing!";
  }
  if (attemptsUsed === 2) {
    return "Nice!";
  }
  if (attemptsUsed === 3) {
    return "Great!";
  }
  if (attemptsUsed === 4) {
    return "Good!";
  }
  if (maxGuesses >= 6 && attemptsUsed === 5) {
    return "Not bad!";
  }
  return "Phew, close!";
};

export default function MoviedleGameClient({
  apiUrl,
  navLabel = "Moviedle",
  hideToday = false,
  archiveHref = "/moviedle/archive",
  storagePrefix = "moviedle:v1:today",
  completionPrefix = "moviedle:v1:completed",
  lockDailyCompletion = true,
}: MoviedleGameClientProps) {
  const isArchiveView = apiUrl.includes("/by-date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState<MoviedlePuzzle | null>(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [gameState, setGameState] = useState<MoviedleGameState>("playing");
  const [message, setMessage] = useState("");
  const [revealedAnswer, setRevealedAnswer] = useState("");
  const [revealedDetails, setRevealedDetails] = useState<RevealedDetails>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [lockedSuggestionQuery, setLockedSuggestionQuery] = useState("");
  const [selectedStillIndex, setSelectedStillIndex] = useState(0);
  const [resultStillIndex, setResultStillIndex] = useState(0);
  const [archiveLock, setArchiveLock] = useState<{ title: string; description: string; mode?: "password" | "subscription" } | null>(null);
  const contextChipLabel = isArchiveView
    ? `ARCHIVE GAME #${puzzle?.archiveGameNumber ?? ""}`.trim()
    : "TODAY'S GAME";
  const shouldShowNextGameCountdown = lockDailyCompletion && !isArchiveView && gameState !== "playing";
  const nextGameCountdown = useNextGameCountdown(shouldShowNextGameCountdown);
  const statusChipLabel = shouldShowNextGameCountdown
    ? `Next game in ${nextGameCountdown || "--:--:--"}`
    : contextChipLabel;

  useEffect(() => {
    let active = true;

    const loadPuzzle = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(apiUrl, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 423) {
          if (active) {
            setPuzzle(null);
            setArchiveLock({
              title: typeof payload.lockTitle === "string" ? payload.lockTitle : "Archive Game #1 is locked",
              description: typeof payload.lockDescription === "string" ? payload.lockDescription : "Enter the shared password to open this retired archive game.",
              mode: payload.lockMode === "subscription" ? "subscription" : "password",
            });
            setError("");
          }
          return;
        }
        if (!response.ok) {
          if (response.status === 404) {
            if (active) {
              setPuzzle(null);
              setArchiveLock(null);
              setError("");
            }
            return;
          }
          throw new Error(payload.error || "Failed to load Moviedle puzzle");
        }

        if (!active) {
          return;
        }

        const progressKey = `${storagePrefix}:${payload.puzzleId}`;
        const completionKey = `${completionPrefix}:${payload.puzzleId}`;
        const storedResult = await fetchStoredGameResult({
          gameSlug: "moviedle",
          puzzleId: payload.puzzleId,
          puzzleDate: payload.puzzleDate,
          isArchive: isArchiveView,
        });
        if (storedResult) {
          const answer = getResultPayloadAnswer(storedResult);
          const title = typeof answer.title === "string" ? answer.title : "Unavailable";
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: payload.puzzleId,
              guess: "",
              attempts: getResultPayloadAttempts(storedResult),
              gameState: storedResult.isWin ? "won" : "lost",
              message: storedResult.isWin ? `Correct! It was ${title}.` : `Out of guesses. The movie was ${title}.`,
              revealedAnswer: title,
              revealedDetails: normalizeRevealedDetails(answer.details),
            }),
          );
        }

        const restoredState = restoreMoviedleState({
          puzzleId: payload.puzzleId,
          progressKey,
          completionKey,
          lockDailyCompletion,
        });
        setPuzzle(payload);
        setArchiveLock(null);
        setGuess(restoredState.guess);
        setAttempts(restoredState.attempts);
        setGameState(restoredState.gameState);
        setMessage(restoredState.message);
        setRevealedAnswer(restoredState.revealedAnswer);
        setRevealedDetails(restoredState.revealedDetails);
        setIsResultOpen(restoredState.isResultOpen);
        setIsHowToPlayOpen(false);
        setIsHistoryOpen(false);
        setCopyStatus("");
        setLockedSuggestionQuery("");
        setSelectedStillIndex(restoredState.gameState === "playing" ? Math.max(0, restoredState.attempts.length) : 0);
        setResultStillIndex(0);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setArchiveLock(null);
        setError(loadError instanceof Error ? loadError.message : "Failed to load Moviedle puzzle");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadPuzzle();

    return () => {
      active = false;
    };
  }, [apiUrl, completionPrefix, lockDailyCompletion, storagePrefix]);

  useEffect(() => {
    if (typeof window === "undefined" || !Array.isArray(puzzle?.stillImages) || puzzle.stillImages.length === 0) {
      return;
    }

    const preloaders = puzzle.stillImages
      .map((still) => still?.url)
      .filter((url): url is string => Boolean(url))
      .map((url) => {
        const image = new window.Image();
        image.decoding = "async";
        image.src = url;
        return image;
      });

    return () => {
      preloaders.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [puzzle?.puzzleId, puzzle?.stillImages]);

  const progressKey = useMemo(() => {
    if (!puzzle?.puzzleId) {
      return null;
    }
    return `${storagePrefix}:${puzzle.puzzleId}`;
  }, [puzzle, storagePrefix]);

  const completionKey = useMemo(() => {
    if (!puzzle?.puzzleId) {
      return null;
    }
    return `${completionPrefix}:${puzzle.puzzleId}`;
  }, [completionPrefix, puzzle]);

  useEffect(() => {
    if (!progressKey || !puzzle) {
      return;
    }

    const payload = { guess, attempts, gameState, message, revealedAnswer, revealedDetails };
    window.localStorage.setItem(progressKey, JSON.stringify(payload));
  }, [attempts, gameState, guess, message, progressKey, puzzle, revealedAnswer, revealedDetails]);

  useEffect(() => {
    let active = true;
    if (gameState !== "playing") {
      return () => {};
    }

    const trimmed = guess.trim();
    const normalizedQuery = normalizeGuess(trimmed);
    if (trimmed.length < 2) {
      return () => {};
    }
    if (normalizedQuery && normalizedQuery === lockedSuggestionQuery) {
      return () => {};
    }

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/moviedle/puzzle/suggest?q=${encodeURIComponent(trimmed)}&limit=8`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load suggestions");
        }
        if (!active) {
          return;
        }
        setSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
      } catch {
        if (active) {
          setSuggestions([]);
        }
      }
    }, 120);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [gameState, guess, lockedSuggestionQuery]);

  const maxGuesses = Number.isFinite(puzzle?.maxGuesses) ? Number(puzzle?.maxGuesses) : 5;
  const stills = Array.isArray(puzzle?.stillImages) ? (puzzle?.stillImages ?? []) : [];
  const revealedStillCount = gameState === "playing"
    ? Math.max(1, Math.min(stills.length || 1, 1 + attempts.length))
    : Math.max(1, stills.length || 1);
  const visibleStills = stills.slice(0, revealedStillCount);
  const boundedStillIndex = Math.min(Math.max(selectedStillIndex, 0), Math.max(visibleStills.length - 1, 0));
  const visibleStill = visibleStills[boundedStillIndex] || null;
  const canNavigateStills = visibleStills.length > 1;
  const boundedResultStillIndex = Math.min(Math.max(resultStillIndex, 0), Math.max(visibleStills.length - 1, 0));
  const resultStill = visibleStills[boundedResultStillIndex] || null;
  const canNavigateResultStills = visibleStills.length > 1;
  const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const earlierAttempts = attempts.slice(0, -1).reverse();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!puzzle || gameState !== "playing") {
      return;
    }

    const trimmed = guess.trim();
    if (!trimmed) {
      setMessage("Enter a movie title.");
      return;
    }

    try {
      const response = await fetch("/api/moviedle/puzzle/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzleId: puzzle.puzzleId,
          guessTitle: trimmed,
          guessCount: attempts.length,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to submit guess");
      }

      const nextAttempts = [
        ...attempts,
        {
          guess: trimmed,
          normalizedGuess: normalizeGuess(trimmed),
          isCorrect: Boolean(payload.isCorrect),
        },
      ];

      setAttempts(nextAttempts);
      setSuggestions([]);

      if (payload.isCorrect) {
        const title = payload.answerTitle || "the movie";
        const finalMessage = `Correct! It was ${title}.`;
        setGameState("won");
        setRevealedAnswer(title);
        setRevealedDetails(normalizeRevealedDetails(payload.answerDetails));
        setMessage(finalMessage);
        setSelectedStillIndex(0);
        setResultStillIndex(0);
        setIsResultOpen(true);
        recordGameCompletionQuietly({
          gameSlug: "moviedle",
          puzzleId: puzzle.puzzleId,
          puzzleDate: puzzle.puzzleDate,
          isArchive: isArchiveView,
          isWin: true,
          guessesUsed: nextAttempts.length,
          maxGuesses,
          resultPayload: buildResultPayload({
            attempts: nextAttempts,
            answer: { title, details: normalizeRevealedDetails(payload.answerDetails) },
            final: { guess: trimmed, normalizedGuess: normalizeGuess(trimmed), isCorrect: true },
            isWin: true,
            guessesUsed: nextAttempts.length,
            maxGuesses,
          }),
        });

        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
              guess: trimmed,
              attempts: nextAttempts,
              gameState: "won",
              message: finalMessage,
              revealedAnswer: title,
              revealedDetails: normalizeRevealedDetails(payload.answerDetails),
            }),
          );
        }
        return;
      }

      if (nextAttempts.length >= maxGuesses) {
        const title = payload.answerTitle || "Unavailable";
        const finalMessage = `Out of guesses. The movie was ${title}.`;
        setGameState("lost");
        setRevealedAnswer(title);
        setRevealedDetails(normalizeRevealedDetails(payload.answerDetails));
        setMessage(finalMessage);
        setSelectedStillIndex(0);
        setResultStillIndex(0);
        setIsResultOpen(true);
        recordGameCompletionQuietly({
          gameSlug: "moviedle",
          puzzleId: puzzle.puzzleId,
          puzzleDate: puzzle.puzzleDate,
          isArchive: isArchiveView,
          isWin: false,
          guessesUsed: nextAttempts.length,
          maxGuesses,
          resultPayload: buildResultPayload({
            attempts: nextAttempts,
            answer: { title, details: normalizeRevealedDetails(payload.answerDetails) },
            final: { guess: trimmed, normalizedGuess: normalizeGuess(trimmed), isCorrect: false },
            isWin: false,
            guessesUsed: nextAttempts.length,
            maxGuesses,
          }),
        });

        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
              guess: trimmed,
              attempts: nextAttempts,
              gameState: "lost",
              message: finalMessage,
              revealedAnswer: title,
              revealedDetails: normalizeRevealedDetails(payload.answerDetails),
            }),
          );
        }
        return;
      }

      setMessage("Not quite. Another still has been revealed.");
      setSelectedStillIndex(Math.max(0, Math.min(stills.length - 1, nextAttempts.length)));
      setGuess("");
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : "Could not submit guess.");
    }
  };

  const shareText = buildGameShareText({
    gameName: "Moviedle",
    isArchiveView,
    puzzleDate: puzzle?.puzzleDate,
    didWin: gameState === "won",
    guessesUsed: attempts.length,
    maxGuesses,
    url: toPublicAppUrl("/moviedle"),
  });
  const performanceLabel = getPerformanceLabel(gameState === "won", attempts.length, maxGuesses);
  const handleShareResult = async () => {
    const shareResult = await shareResultText("Moviedle", shareText);
    if (shareResult === "shared") setCopyStatus("Shared");
    if (shareResult === "copied") setCopyStatus("Copied to clipboard");
    if (shareResult === "failed") setCopyStatus("Share failed");
  };

  if (loading) {
    return (
      <div className="moviedle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <section className="card moviedle-card">
            <h1 className="page-title"><LoadingLabel text="Loading puzzle" /></h1>
          </section>
        </main>
      </div>
    );
  }

  if (archiveLock) {
    return (
      <div className="moviedle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <ArchiveLockGate archiveHref={archiveHref} title={archiveLock.title} description={archiveLock.description} mode={archiveLock.mode} />
        </main>
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="moviedle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <DailydabbleUnavailable title="Moviedle unavailable" message={error || "No puzzle available right now."} />
        </main>
      </div>
    );
  }

  return (
    <div className="moviedle-shell">
      <MainNav label={navLabel} hideToday={hideToday} />

      <main className="container">
        <section className="card moviedle-card">
          <div className="game-meta-row">
            <span className="chip">{statusChipLabel}</span>
            <span className="chip">Guesses {attempts.length}/{maxGuesses}</span>
            <button className="how-to-play-btn" type="button" onClick={() => setIsHowToPlayOpen(true)}>
              ? How to play
            </button>
          </div>

          <figure className="still-figure">
            {visibleStill ? (
              <AsyncImage
                src={visibleStill.url}
                alt={visibleStill.alt || "Movie still"}
                className="still-image"
                wrapperClassName="still-image-frame"
                overlayClassName="bg-[#f6fffd]/88 text-[color:var(--brand-strong)]"
              />
            ) : (
              <p className="page-subtle">No still image available.</p>
            )}
            {canNavigateStills ? (
              <>
                <button
                  type="button"
                  className="still-nav-btn still-nav-btn-prev"
                  onClick={() => setSelectedStillIndex((current) => Math.max(0, current - 1))}
                  aria-label="Previous still"
                  disabled={boundedStillIndex <= 0}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="still-nav-btn still-nav-btn-next"
                  onClick={() => setSelectedStillIndex((current) => Math.min(visibleStills.length - 1, current + 1))}
                  aria-label="Next still"
                  disabled={boundedStillIndex >= visibleStills.length - 1}
                >
                  →
                </button>
              </>
            ) : null}
          </figure>

          <EditorialDrawer editorialContext={puzzle?.editorialContext} revealHint={gameState !== "playing"} />

          <form className="guess-form" onSubmit={handleSubmit}>
            <input
              value={guess}
	              onChange={(event) => {
	                const nextValue = event.target.value;
	                setGuess(nextValue);
	                if (nextValue.trim().length < 2) {
	                  setSuggestions([]);
	                }
	                if (lockedSuggestionQuery && normalizeGuess(nextValue.trim()) !== lockedSuggestionQuery) {
	                  setLockedSuggestionQuery("");
	                }
              }}
              className="guess-input"
              type="text"
              placeholder="Guess the movie title"
              aria-label="Guess the movie title"
              disabled={gameState !== "playing"}
              autoCapitalize="words"
            />
            {gameState === "playing" ? (
              <button className="guess-submit-btn" type="submit" disabled={gameState !== "playing"}>
                Guess
              </button>
            ) : (
              <button className="guess-submit-btn" type="button" onClick={() => setIsResultOpen(true)}>
                Review result
              </button>
            )}
          </form>
          {gameState === "playing" && suggestions.length > 0 ? (
            <div className="suggestions-wrap" role="listbox" aria-label="Movie title suggestions">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="suggestion-item"
                  onClick={() => {
                    setGuess(item.title);
                    setLockedSuggestionQuery(normalizeGuess(item.title));
                    setSuggestions([]);
                  }}
                >
                  {item.title}
                </button>
              ))}
            </div>
          ) : null}

          {gameState === "playing" ? (
            <p className="message" data-kind={gameState}>
              {message || "Guess the movie. Wrong guesses reveal additional stills."}
            </p>
          ) : null}
          {attempts.length > 0 ? (
            <div className="guess-history-wrap">
              <button
                type="button"
                className="guess-history-toggle"
                aria-expanded={isHistoryOpen}
                aria-controls="moviedle-guess-history-panel"
                onClick={() => setIsHistoryOpen((value) => !value)}
              >
                <span className="guess-history-title">Guess History</span>
                <span className="guess-history-toggle-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 14 12 8l6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
              {latestAttempt ? (
                <div className="guess-history-latest">
                  <span className="guess-history-guess">{latestAttempt.guess}</span>
                  {latestAttempt.isCorrect ? (
                    <strong className="guess-history-status-correct">Correct</strong>
                  ) : (
                    <strong className="guess-history-status-wrong">Wrong</strong>
                  )}
                </div>
              ) : null}
              {isHistoryOpen && earlierAttempts.length > 0 ? (
                <ul id="moviedle-guess-history-panel" className="guess-history-list">
                  {earlierAttempts.map((attempt, index) => (
                    <li key={`${attempt.normalizedGuess}-${index}`} className="guess-history-item">
                      <span className="guess-history-guess">{attempt.guess}</span>
                      {attempt.isCorrect ? (
                        <strong className="guess-history-status-correct">Correct</strong>
                      ) : (
                        <strong className="guess-history-status-wrong">Wrong</strong>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

        </section>
      </main>

      {isResultOpen && gameState !== "playing" ? (
        <div className="result-modal-backdrop" onClick={() => setIsResultOpen(false)}>
          <section className="result-modal-panel" onClick={(event) => event.stopPropagation()}>
            <button
              className="result-modal-close"
              type="button"
              onClick={() => setIsResultOpen(false)}
              aria-label="Close result dialog"
            >
              ×
            </button>
            <h2 className="result-modal-title">Result</h2>
            {lockDailyCompletion && !isArchiveView ? (
              <p className="result-modal-timer">Next game in {nextGameCountdown || "--:--:--"}</p>
            ) : null}
            <div className="result-modal-summary">
              <p className="result-modal-copy result-modal-subtitle">{performanceLabel}</p>
              <p className="result-modal-copy result-modal-stat-line">
                Guesses used:{" "}
                <span className="result-modal-stat-value">{attempts.length}/{maxGuesses}</span>
              </p>
            </div>
            {resultStill ? (
              <div className="result-modal-image-wrap">
                <AsyncImage
                  src={resultStill.url}
                  alt={resultStill.alt || "Movie still"}
                  className="result-modal-image"
                  overlayClassName="bg-[color:var(--surface-low)]/88 text-[color:var(--brand-strong)]"
                />
                {canNavigateResultStills ? (
                  <>
                    <button
                      type="button"
                      className="still-nav-btn still-nav-btn-prev"
                      onClick={() => setResultStillIndex((current) => Math.max(0, current - 1))}
                      aria-label="Previous still"
                      disabled={boundedResultStillIndex <= 0}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="still-nav-btn still-nav-btn-next"
                      onClick={() => setResultStillIndex((current) => Math.min(visibleStills.length - 1, current + 1))}
                      aria-label="Next still"
                      disabled={boundedResultStillIndex >= visibleStills.length - 1}
                    >
                      →
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
            <p className="result-modal-answer">{revealedAnswer || revealedDetails?.title || "Unknown title"}</p>
            {Number.isFinite(revealedDetails?.releaseYear) ? (
              <p className="result-modal-copy"><strong>Year:</strong> {revealedDetails?.releaseYear}</p>
            ) : null}
            {revealedDetails?.director ? (
              <p className="result-modal-copy"><strong>Director:</strong> {revealedDetails?.director}</p>
            ) : null}
            {Array.isArray(revealedDetails?.leadActors) && revealedDetails.leadActors.length > 0 ? (
              <p className="result-modal-copy">
                <strong>Lead actors:</strong> {revealedDetails?.leadActors?.join(", ")}
              </p>
            ) : null}
            {revealedDetails?.summary ? (
              <p className="result-modal-copy"><strong>Summary:</strong> {revealedDetails?.summary}</p>
            ) : null}
            <ResultDialogActions currentGameSlug="moviedle" onShare={handleShareResult} />
            {copyStatus ? <p className="result-modal-copy">{copyStatus}</p> : null}
          </section>
        </div>
      ) : null}

      {isHowToPlayOpen ? (
        <HowToPlayDialog
          title="How to play Moviedle"
          subtitle="Guess the movie from stills."
          steps={[
            "Each wrong guess reveals another movie still.",
            "Use the suggestions to pick the exact movie title.",
            "Reveal the editorial content for a hint and to learn more about the movie.",
            `Find the movie in ${maxGuesses} guesses.`,
          ]}
          buttonClassName="admin-btn-like primary"
          onClose={() => setIsHowToPlayOpen(false)}
        />
      ) : null}
    </div>
  );
}
