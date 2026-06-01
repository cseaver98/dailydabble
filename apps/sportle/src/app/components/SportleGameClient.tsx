"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import MainNav from "./MainNav";

const CLUE_TILE_COUNT = 6;
type SportleGameClientProps = {
  apiUrl: string;
  navLabel?: string;
  hideToday?: boolean;
  archiveHref?: string;
  storagePrefix?: string;
  completionPrefix?: string;
  lockDailyCompletion?: boolean;
};
type Attempt = { guess: string };
type SportlePuzzle = {
  puzzleId: string;
  puzzleDate: string;
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

export default function SportleGameClient({
  apiUrl,
  navLabel = "Sportle",
  hideToday = false,
  archiveHref = "/archive",
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
  const [copyStatus, setCopyStatus] = useState("");
  const [nextGameCountdown, setNextGameCountdown] = useState("");
  const contextChipLabel = isArchiveView ? "ARCHIVE GAME" : "TODAY'S GAME";

  useEffect(() => {
    let active = true;

    const loadPuzzle = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(apiUrl, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 404) {
            if (active) {
              setPuzzle(null);
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
        setGuess("");
        setAttempts([]);
        setGameState("playing");
        setMessage("");
        setResolvedAnswer("");
        setIsResultOpen(false);
        setCopyStatus("");
      } catch (loadError) {
        if (!active) {
          return;
        }
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
    setIsResultOpen(true);
  }, [gameState]);

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
  const clues = Array.isArray(puzzle?.clues) ? (puzzle?.clues ?? []) : [];
  const revealedHintCount = Math.min(clues.length, 1 + attempts.length);
  const clueTiles = Array.from({ length: CLUE_TILE_COUNT }, (_, index) => {
    const clue = clues[index] || null;
    return {
      index,
      clue,
      isRevealed: Boolean(clue) && index < revealedHintCount,
    };
  });

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
      const response = await fetch("/api/puzzle/submit", {
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
        },
      ];

      setAttempts(nextAttempts);
      setGuess("");

      if (payload.isCorrect) {
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
      <>
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <section className="card sportle-card">
            <h1 className="page-title">Loading puzzle...</h1>
          </section>
        </main>
      </>
    );
  }

  if (error || !puzzle) {
    return (
      <>
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <DailydabbleUnavailable title="Sportle unavailable" message={error || "No puzzle available right now."} />
        </main>
      </>
    );
  }

  return (
    <>
      <MainNav label={navLabel} hideToday={hideToday} />

      <main className="container">
        <section className="card sportle-card">
          <div className="game-meta-row">
            <span className="chip">{contextChipLabel}</span>
            <span className="chip">Attempts: {attempts.length}/{maxGuesses}</span>
          </div>

          <div className="hints-wrap">
            <p className="guess-history-title">Clues</p>
            <ul className="clues-grid">
              {clueTiles.map(({ index, clue, isRevealed }) => (
                <li key={`clue-tile-${index}`} className={`clue-tile ${isRevealed ? "is-revealed" : "is-locked"}`}>
                  {isRevealed && clue ? (
                    <>
                      {clue.imageUrl || index === 0 ? null : <span className="hint-label">{clue.label}</span>}
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
                        <span>{clue.value}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="hint-label">Clue {index + 1}</span>
                      <span className="clue-lock-copy">Locked</span>
                    </>
                  )}
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
              <button className="guess-submit-btn" type="button" onClick={() => setIsResultOpen(true)}>
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
            <p className="guess-history-title">Guesses</p>
            <ul className="guess-history-list">
              {attempts.length === 0 ? <li className="guess-history-item">No guesses yet.</li> : null}
              {attempts.map((attempt, index) => (
                <li key={`${attempt.guess}-${index}`} className="guess-history-item">
                  <span>{attempt.guess}</span>
                  <span>#{index + 1}</span>
                </li>
              ))}
            </ul>
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
              <a className="admin-btn-like" href="https://dailydabble.app">DailyDabble</a>
              <a className="admin-btn-like primary" href={archiveHref}>Play Archive Games</a>
            </div>
            {copyStatus ? <p className="result-modal-copy">{copyStatus}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
