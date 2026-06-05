"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import MainNav from "./MainNav";
import ArchiveLockGate from "../../components/ArchiveLockGate";
import { toPublicAppUrl } from "../../../lib/app-url";

const CLUE_TILE_COUNT = 6;
const CLUE_FLIP_DURATION_MS = 640;
const CLUE_FLIP_STAGGER_MS = 160;
type SportleGameClientProps = {
  apiUrl: string;
  navLabel?: string;
  hideToday?: boolean;
  archiveHref?: string;
  storagePrefix?: string;
  completionPrefix?: string;
  lockDailyCompletion?: boolean;
};
type Attempt = { guess: string; isCorrect?: boolean };
type SportlePuzzle = {
  puzzleId: string;
  puzzleDate: string;
  archiveGameNumber?: number;
  maxGuesses: number;
  clues: Array<{ label: string; value: string; logoUrl?: string | null; imageUrl?: string | null }>;
};

const getNextGameCountdown = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value || now.getUTCFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value || now.getUTCMonth() + 1);
  const day = Number(parts.find((part) => part.type === "day")?.value || now.getUTCDate());
  const nextMidnightUtc = Date.UTC(year, month - 1, day + 1, 4, 0, 0);
  const diffMs = Math.max(0, nextMidnightUtc - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
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

const normalizeGuessName = (value: string) => value.trim().toLowerCase();

export default function SportleGameClient({
  apiUrl,
  navLabel = "Sportle",
  hideToday = false,
  archiveHref = "/sportle/archive",
  storagePrefix = "sportle:v1:today",
  completionPrefix = "sportle:v1:completed",
  lockDailyCompletion = true,
}: SportleGameClientProps) {
  const isArchiveView = apiUrl.includes("/by-date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState<SportlePuzzle | null>(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [gameState, setGameState] = useState("playing");
  const [message, setMessage] = useState("");
  const [resolvedAnswer, setResolvedAnswer] = useState("");
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [nextGameCountdown, setNextGameCountdown] = useState("");
  const [archiveLock, setArchiveLock] = useState<{ title: string; description: string } | null>(null);
  const [animatingClueIndexes, setAnimatingClueIndexes] = useState<number[]>([]);
  const [visibleClueCount, setVisibleClueCount] = useState(0);
  const clueAnimationTimeoutRef = useRef<number | null>(null);
  const contextChipLabel = isArchiveView
    ? `ARCHIVE GAME #${puzzle?.archiveGameNumber ?? ""}`.trim()
    : "TODAY'S GAME";

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
          throw new Error(payload.error || "Failed to load Sportle puzzle");
        }

        if (!active) {
          return;
        }

        setPuzzle(payload);
        setArchiveLock(null);
        setGuess("");
        setAttempts([]);
        setGameState("playing");
        setMessage("");
        setResolvedAnswer("");
        setIsResultOpen(false);
        setIsHistoryOpen(false);
        setCopyStatus("");
        setAnimatingClueIndexes([]);
        setVisibleClueCount(0);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setArchiveLock(null);
        setError(loadError instanceof Error ? loadError.message : "Failed to load Sportle puzzle");
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
  }, [apiUrl]);

  useEffect(() => () => {
    if (clueAnimationTimeoutRef.current) {
      window.clearTimeout(clueAnimationTimeoutRef.current);
    }
  }, []);

  const progressKey = useMemo(() => {
    if (!puzzle?.puzzleId) {
      return null;
    }
    return `${storagePrefix}:${puzzle.puzzleId}`;
  }, [puzzle?.puzzleId, storagePrefix]);

  const completionKey = useMemo(() => {
    if (!puzzle?.puzzleId) {
      return null;
    }
    return `${completionPrefix}:${puzzle.puzzleId}`;
  }, [completionPrefix, puzzle?.puzzleId]);

  useEffect(() => {
    if (!progressKey) {
      return;
    }

    const raw = window.localStorage.getItem(progressKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const parsedState = parsed.gameState;
      if (!lockDailyCompletion && (parsedState === "won" || parsedState === "lost")) {
        window.localStorage.removeItem(progressKey);
        return;
      }
      setGuess(typeof parsed.guess === "string" ? parsed.guess : "");
      setAttempts(Array.isArray(parsed.attempts) ? parsed.attempts : []);
      setGameState(parsedState === "won" || parsedState === "lost" ? parsedState : "playing");
      setMessage(typeof parsed.message === "string" ? parsed.message : "");
      setResolvedAnswer(typeof parsed.resolvedAnswer === "string" ? parsed.resolvedAnswer : "");
      setIsHistoryOpen(false);
    } catch {
      window.localStorage.removeItem(progressKey);
    }
  }, [lockDailyCompletion, progressKey]);

  useEffect(() => {
    if (!completionKey || !lockDailyCompletion) {
      return;
    }

    const raw = window.localStorage.getItem(completionKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.puzzleId !== puzzle?.puzzleId) {
        return;
      }

      setAttempts(Array.isArray(parsed.attempts) ? parsed.attempts : []);
      setGameState(parsed.gameState === "won" || parsed.gameState === "lost" ? parsed.gameState : "playing");
      setMessage(typeof parsed.message === "string" ? parsed.message : "");
      setResolvedAnswer(typeof parsed.resolvedAnswer === "string" ? parsed.resolvedAnswer : "");
      setIsHistoryOpen(false);
    } catch {
      window.localStorage.removeItem(completionKey);
    }
  }, [completionKey, lockDailyCompletion, puzzle?.puzzleId]);

  useEffect(() => {
    if (!progressKey || !puzzle) {
      return;
    }

    window.localStorage.setItem(progressKey, JSON.stringify({ guess, attempts, gameState, message, resolvedAnswer }));
  }, [attempts, gameState, guess, message, progressKey, puzzle, resolvedAnswer]);

  useEffect(() => {
    if (gameState === "playing") {
      setIsResultOpen(false);
      return;
    }
    if (gameState === "won" && animatingClueIndexes.length > 0) {
      setIsResultOpen(false);
      return;
    }
    setIsResultOpen(true);
  }, [animatingClueIndexes.length, gameState]);

  const clues = Array.isArray(puzzle?.clues) ? (puzzle?.clues ?? []) : [];
  const targetVisibleClueCount =
    gameState === "won" ? clues.length : Math.min(clues.length, 1 + attempts.length);

  useEffect(() => {
    if (animatingClueIndexes.length > 0) {
      return;
    }
    setVisibleClueCount(targetVisibleClueCount);
  }, [animatingClueIndexes.length, targetVisibleClueCount]);

  useEffect(() => {
    if (!lockDailyCompletion || isArchiveView || gameState === "playing") {
      setNextGameCountdown("");
      return;
    }
    setNextGameCountdown(getNextGameCountdown());
    const intervalId = window.setInterval(() => setNextGameCountdown(getNextGameCountdown()), 1000);
    return () => window.clearInterval(intervalId);
  }, [gameState, isArchiveView, lockDailyCompletion]);

  const maxGuesses = Number.isFinite(puzzle?.maxGuesses) ? Number(puzzle?.maxGuesses) : 6;
  const isClueAnimationActive = animatingClueIndexes.length > 0;
  const queueClueFlip = (fromIndex: number, toIndexExclusive: number) => {
    const nextIndexes = Array.from(
      { length: Math.max(0, toIndexExclusive - fromIndex) },
      (_, offset) => fromIndex + offset,
    ).filter((index) => index < clues.length);

    if (nextIndexes.length === 0) {
      return;
    }

    if (clueAnimationTimeoutRef.current) {
      window.clearTimeout(clueAnimationTimeoutRef.current);
    }

    setVisibleClueCount(toIndexExclusive);
    setAnimatingClueIndexes(nextIndexes);
    clueAnimationTimeoutRef.current = window.setTimeout(() => {
      setAnimatingClueIndexes([]);
      clueAnimationTimeoutRef.current = null;
    }, CLUE_FLIP_DURATION_MS + CLUE_FLIP_STAGGER_MS * Math.max(0, nextIndexes.length - 1) + 80);
  };

  const clueTiles = Array.from({ length: CLUE_TILE_COUNT }, (_, index) => {
    const clue = clues[index] || null;
    const animationOrder = animatingClueIndexes.indexOf(index);
    return {
      index,
      clue,
      isRevealed: Boolean(clue) && index < visibleClueCount,
      isAnimating: animationOrder !== -1,
      animationDelay: animationOrder >= 0 ? animationOrder * CLUE_FLIP_STAGGER_MS : 0,
    };
  });
  const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const earlierAttempts = attempts.slice(0, -1).reverse();
  const isAttemptCorrect = (attempt: Attempt | null) => {
    if (!attempt) {
      return false;
    }
    if (typeof attempt.isCorrect === "boolean") {
      return attempt.isCorrect;
    }
    if (gameState !== "won" || !resolvedAnswer) {
      return false;
    }
    return normalizeGuessName(attempt.guess) === normalizeGuessName(resolvedAnswer);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!puzzle || gameState !== "playing") {
      return;
    }

    const guessName = guess.trim();
    if (!guessName) {
      setMessage("Select an athlete guess.");
      return;
    }

    try {
      const response = await fetch("/api/sportle/puzzle/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.puzzleId, guessName }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not submit guess");
      }

      const nextAttempts = [
        ...attempts,
        {
          guess: payload.guess,
          isCorrect: Boolean(payload.isCorrect),
        },
      ];
      const currentRevealedHintCount = visibleClueCount;

      setAttempts(nextAttempts);
      setGuess("");

      if (payload.isCorrect) {
        queueClueFlip(currentRevealedHintCount, clues.length);
        const finalMessage = `Correct. Athlete: ${payload.answerName}`;
        setGameState("won");
        setMessage(finalMessage);
        setResolvedAnswer(payload.answerName || "");
        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
              attempts: nextAttempts,
              gameState: "won",
              message: finalMessage,
              resolvedAnswer: payload.answerName || "",
            }),
          );
        }
        return;
      }

      queueClueFlip(currentRevealedHintCount, Math.min(clues.length, 1 + nextAttempts.length));

      if (nextAttempts.length >= maxGuesses) {
        const finalMessage = `Out of guesses. Athlete: ${payload.answerName}`;
        setGameState("lost");
        setMessage(finalMessage);
        setResolvedAnswer(payload.answerName || "");
        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
              attempts: nextAttempts,
              gameState: "lost",
              message: finalMessage,
              resolvedAnswer: payload.answerName || "",
            }),
          );
        }
        return;
      }

      setMessage("Incorrect. Another clue unlocked.");
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : "Could not submit guess");
    }
  };

  const resetArchivePuzzle = () => {
    if (!lockDailyCompletion) {
      setGuess("");
      setAttempts([]);
      setGameState("playing");
      setMessage("");
      setResolvedAnswer("");
      setIsResultOpen(false);
      setIsHistoryOpen(false);
      setCopyStatus("");
      return;
    }

    setMessage("Today’s puzzle is locked after completion. Try archive games.");
  };

  const effectiveAnswer = resolvedAnswer || "Unavailable";
  const performanceLabel = getPerformanceLabel(gameState === "won", attempts.length, maxGuesses);
  const headshotClue = clues.find((clue) => typeof clue?.imageUrl === "string" && clue.imageUrl);
  const answerImageUrl = typeof headshotClue?.imageUrl === "string" ? headshotClue.imageUrl : "";
  const shareText = [
    `Sportle ${isArchiveView ? `(Archive ${puzzle?.puzzleDate || ""})` : `(Today ${puzzle?.puzzleDate || ""})`}`.trim(),
    `${attempts.length}/${maxGuesses} tries`,
    `Answer: ${effectiveAnswer}`,
    toPublicAppUrl("/sportle"),
  ].join("\n");
  const handleShareResult = async () => {
    if (!shareText) {
      return;
    }
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Sportle", text: shareText });
        setCopyStatus("Shared");
        return;
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === "AbortError") {
          return;
        }
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyStatus("Copied to clipboard");
    } catch {
      setCopyStatus("Share failed");
    }
  };

  if (loading) {
    return (
      <div className="sportle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <section className="card sportle-card">
            <h1 className="page-title">Loading puzzle...</h1>
          </section>
        </main>
      </div>
    );
  }

  if (archiveLock) {
    return (
      <div className="sportle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <ArchiveLockGate archiveHref={archiveHref} title={archiveLock.title} description={archiveLock.description} />
        </main>
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="sportle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <DailydabbleUnavailable title="Sportle unavailable" message={error || "No puzzle available right now."} />
        </main>
      </div>
    );
  }

  return (
    <div className="sportle-shell">
      <MainNav label={navLabel} hideToday={hideToday} />

      <main className="container">
        <section className="card sportle-card">
          <div className="game-meta-row">
            <span className="chip">{contextChipLabel}</span>
            <span className="chip">Attempts: {attempts.length}/{maxGuesses}</span>
          </div>

          <div className="hints-wrap">
            <ul className="clues-grid">
              {clueTiles.map(({ index, clue, isRevealed, isAnimating, animationDelay }) => (
                <li
                  key={`clue-tile-${index}`}
                  className={`clue-tile ${isRevealed ? "is-revealed" : "is-locked"} ${isAnimating ? "reveal" : ""}`}
                  style={
                    isAnimating
                      ? ({
                          "--flip-delay": `${animationDelay}ms`,
                          "--flip-duration": `${CLUE_FLIP_DURATION_MS}ms`,
                        } as CSSProperties)
                      : undefined
                  }
                >
                  <div className="clue-tile-inner">
                    <div className="clue-tile-face clue-tile-front">
                      <span className="hint-label">Clue {index + 1}</span>
                      <span className="clue-lock-copy">Locked</span>
                    </div>
                    <div className="clue-tile-face clue-tile-back">
                      {clue ? (
                        <>
                          {index === 0 ? <span className="hint-label">TEAM</span> : clue.imageUrl ? null : <span className="hint-label">{clue.label}</span>}
                          {index === 0 && clue.logoUrl ? (
                            <div className="clue-team-row">
                              <img src={clue.logoUrl} alt={clue.value || "Team logo"} className="team-logo" />
                              <span>{clue.value}</span>
                            </div>
                          ) : clue.imageUrl ? (
                            <div className="clue-team-row clue-image-row">
                              <img src={clue.imageUrl} alt={clue.value || "Athlete headshot"} className="team-logo headshot-logo" />
                            </div>
                          ) : (
                            <span>{clue?.value}</span>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <form className="guess-form" onSubmit={onSubmit}>
            <input
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              className="guess-input"
              type="text"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Type an athlete name"
              aria-label="Guess athlete"
              disabled={gameState !== "playing"}
            />
            {gameState === "playing" ? (
              <button className="guess-submit-btn" type="submit" disabled={gameState !== "playing"}>
                Guess
              </button>
            ) : (
              <button
                className="guess-submit-btn"
                type="button"
                onClick={() => setIsResultOpen(true)}
                disabled={gameState === "won" && isClueAnimationActive}
              >
                Review result
              </button>
            )}
          </form>

          <p className="message" data-kind={gameState}>
            {message || "Start with clue 1. Wrong guesses unlock more clues."}
          </p>

          {lockDailyCompletion && !isArchiveView && gameState !== "playing" ? (
            <p className="next-game-copy">Next game in {nextGameCountdown || "--:--:--"}</p>
          ) : null}

          <div className="guess-history-wrap">
            <button
              type="button"
              className="guess-history-toggle"
              aria-expanded={isHistoryOpen}
              aria-controls="sportle-guess-history-panel"
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
                {isAttemptCorrect(latestAttempt) ? (
                  <strong className="guess-history-status-correct">Correct</strong>
                ) : (
                  <strong className="guess-history-status-wrong">Wrong</strong>
                )}
              </div>
            ) : (
              <div className="guess-history-latest">
                <span className="guess-history-guess">No guesses yet.</span>
              </div>
            )}
            {isHistoryOpen && earlierAttempts.length > 0 ? (
              <ul id="sportle-guess-history-panel" className="guess-history-list">
                {earlierAttempts.map((attempt, index) => (
                  <li key={`${attempt.guess}-${index}`} className="guess-history-item">
                    <span className="guess-history-guess">{attempt.guess}</span>
                    {isAttemptCorrect(attempt) ? (
                      <strong className="guess-history-status-correct">Correct</strong>
                    ) : (
                      <strong className="guess-history-status-wrong">Wrong</strong>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

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
            <p className="result-modal-copy">{performanceLabel}</p>
            {answerImageUrl ? <img src={answerImageUrl} alt={effectiveAnswer} className="result-modal-image" /> : null}
            <p className="result-modal-answer">{effectiveAnswer}</p>
            <div className="result-modal-actions">
              <button className="admin-btn-like" type="button" onClick={handleShareResult}>
                Share
              </button>
              <a className="admin-btn-like" href="/">DailyDabble</a>
              <a className="admin-btn-like primary" href={archiveHref}>Play Archive Games</a>
            </div>
            {copyStatus ? <p className="result-modal-copy">{copyStatus}</p> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
