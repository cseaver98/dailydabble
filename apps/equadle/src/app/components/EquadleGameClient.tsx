"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import MainNav from "./MainNav";

const FLIP_DURATION_MS = 260;
const FLIP_STAGGER_MS = 208;
const KEY_ROWS = [
  ["7", "8", "9", "/"],
  ["4", "5", "6", "*"],
  ["1", "2", "3", "-"],
  ["Enter", "0", "Backspace", "+"],
];
const KEY_STRENGTH: Record<string, number> = {
  empty: 0,
  absent: 1,
  present: 2,
  correct: 3,
};
type EquadleGameClientProps = {
  apiUrl: string;
  navLabel?: string;
  hideToday?: boolean;
  archiveHref?: string;
  storagePrefix?: string;
  completionPrefix?: string;
  lockDailyCompletion?: boolean;
};
type EquadlePuzzle = {
  puzzleId: string;
  puzzleDate: string;
  equationLength: number;
  equalsIndex: number;
  maxGuesses: number;
  answer?: string;
};
type Attempt = {
  guess: string;
  feedback: string[];
};

const sanitizeEquationInput = (value: string, maxLength: number) =>
  String(value || "")
    .replace(/\s+/g, "")
    .replace(/[^0-9+\-*/]/g, "")
    .slice(0, maxLength);

const buildFullGuess = (inputValue: string, equationLength: number, equalsIndex: number) => {
  const chars = [];
  let inputIndex = 0;
  const safeValue = String(inputValue || "");
  for (let index = 0; index < equationLength; index += 1) {
    if (index === equalsIndex) {
      chars.push("=");
      continue;
    }
    chars.push(safeValue[inputIndex] || "");
    inputIndex += 1;
  }
  return chars.join("");
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

export default function EquadleGameClient({
  apiUrl,
  navLabel = "Equadle",
  hideToday = false,
  archiveHref = "/archive",
  storagePrefix = "equadle:v1:today",
  completionPrefix = "equadle:v1:completed",
  lockDailyCompletion = true,
}: EquadleGameClientProps) {
  const isArchiveView = apiUrl.includes("/by-date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState<EquadlePuzzle | null>(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [gameState, setGameState] = useState("playing");
  const [message, setMessage] = useState("");
  const [resolvedAnswer, setResolvedAnswer] = useState("");
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [revealingRowIndex, setRevealingRowIndex] = useState<number | null>(null);
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
          throw new Error(payload.error || "Failed to load Equadle puzzle");
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
        setRevealingRowIndex(null);
        setCopyStatus("");
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load Equadle puzzle");
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

    window.localStorage.setItem(
      progressKey,
      JSON.stringify({ guess, attempts, gameState, message, resolvedAnswer }),
    );
  }, [attempts, gameState, guess, message, progressKey, puzzle, resolvedAnswer]);

  useEffect(() => {
    if (gameState === "playing") {
      setIsResultOpen(false);
      return;
    }

    if (revealingRowIndex === null) {
      setIsResultOpen(true);
      return;
    }

    const revealLength = Number.isFinite(puzzle?.equationLength) ? Number(puzzle?.equationLength) : 8;
    const revealTotalMs = Math.max(0, (revealLength - 1) * FLIP_STAGGER_MS + FLIP_DURATION_MS);
    const timeoutId = window.setTimeout(() => setIsResultOpen(true), revealTotalMs);
    return () => window.clearTimeout(timeoutId);
  }, [gameState, puzzle?.equationLength, revealingRowIndex]);

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
  const equationLength = Number.isFinite(puzzle?.equationLength) ? Number(puzzle?.equationLength) : 8;
  const equalsIndex = Number.isFinite(puzzle?.equalsIndex)
    ? Number(puzzle?.equalsIndex)
    : 4;
  const guessInputLength = Math.max(1, equationLength - 1);

  const boardRows = useMemo(() => {
    const rows = attempts.map((attempt) =>
      attempt.guess.split("").map((char, index) => ({
        char,
        state: attempt.feedback[index] || "absent",
      })),
    );

    if (gameState === "playing") {
      const draft = [];
      let guessCursor = 0;
      for (let index = 0; index < equationLength; index += 1) {
        if (index === equalsIndex) {
          draft.push({ char: "=", state: "locked" });
          continue;
        }
        const nextChar = guess[guessCursor] || "";
        draft.push({ char: nextChar, state: nextChar ? "draft" : "empty" });
        guessCursor += 1;
      }

      rows.push(draft);
    }

    while (rows.length < maxGuesses) {
      const emptyRow = [];
      for (let index = 0; index < equationLength; index += 1) {
        emptyRow.push(index === equalsIndex ? { char: "=", state: "locked" } : { char: "", state: "empty" });
      }
      rows.push(emptyRow);
    }

    return rows;
  }, [attempts, equationLength, equalsIndex, gameState, guess, maxGuesses]);

  const keyStates = useMemo(() => {
    const states = new Map();
    for (const attempt of attempts) {
      const chars = String(attempt?.guess || "").split("");
      const feedback = Array.isArray(attempt?.feedback) ? attempt.feedback : [];
      for (let index = 0; index < chars.length; index += 1) {
        const key = chars[index];
        const nextState = feedback[index] || "absent";
        const currentState = states.get(key) || "empty";
        if ((KEY_STRENGTH[nextState] || 0) > (KEY_STRENGTH[currentState] || 0)) {
          states.set(key, nextState);
        }
      }
    }
    return states;
  }, [attempts]);

  const canSubmitGuess = gameState === "playing" && guess.length === guessInputLength;
  const canDeleteGuess = gameState === "playing" && guess.length > 0;

  const appendGuessChar = (char: string) => {
    if (gameState !== "playing") {
      return;
    }
    setGuess((current) => sanitizeEquationInput(`${current}${char}`, guessInputLength));
  };

  const removeGuessChar = () => {
    if (gameState !== "playing") {
      return;
    }
    setGuess((current) => current.slice(0, -1));
  };

  const onSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();

    if (!puzzle || gameState !== "playing") {
      return;
    }

    const guessEquation = buildFullGuess(guess.trim(), equationLength, equalsIndex);
    try {
      const response = await fetch("/api/puzzle/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.puzzleId, guessEquation }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Guess must be a valid equation");
      }

      const nextAttempts = [
        ...attempts,
        {
          guess: payload.guess,
          feedback: Array.isArray(payload.feedback) ? payload.feedback : [],
        },
      ];

      setAttempts(nextAttempts);
      setRevealingRowIndex(nextAttempts.length - 1);
      setGuess("");

      if (payload.isCorrect) {
        setGameState("won");
        setMessage("");
        setResolvedAnswer(payload.answer || "");
        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
              attempts: nextAttempts,
              gameState: "won",
              message: "",
              resolvedAnswer: payload.answer || "",
            }),
          );
        }
        return;
      }

      if (nextAttempts.length >= maxGuesses) {
        setGameState("lost");
        setMessage("");
        setResolvedAnswer(payload.answer || "");
        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
              attempts: nextAttempts,
              gameState: "lost",
              message: "",
              resolvedAnswer: payload.answer || "",
            }),
          );
        }
        return;
      }

    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : "Guess must be a valid equation");
    }
  };

  useEffect(() => {
    if (gameState !== "playing") {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (key === "Enter") {
        event.preventDefault();
        if (canSubmitGuess) {
          void onSubmit(event);
        }
        return;
      }
      if (key === "Backspace" || key === "Delete") {
        event.preventDefault();
        removeGuessChar();
        return;
      }
      if (/^[0-9+\-*/]$/.test(key)) {
        event.preventDefault();
        appendGuessChar(key);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSubmitGuess, gameState, onSubmit]);

  const resetArchivePuzzle = () => {
    if (!lockDailyCompletion) {
      setGuess("");
      setAttempts([]);
      setGameState("playing");
      setMessage("");
      setResolvedAnswer("");
      setIsResultOpen(false);
      setRevealingRowIndex(null);
      setCopyStatus("");
      return;
    }

    setMessage("");
  };

  const effectiveAnswer = resolvedAnswer || puzzle?.answer || "Unavailable";
  const performanceLabel = getPerformanceLabel(gameState === "won", attempts.length, maxGuesses);
  const shareText = [
    `Equadle ${isArchiveView ? `(Archive ${puzzle?.puzzleDate || ""})` : `(Today ${puzzle?.puzzleDate || ""})`}`.trim(),
    `${attempts.length}/${maxGuesses} tries`,
    `Answer: ${effectiveAnswer}`,
  ].join("\n");
  const handleShareResult = async () => {
    if (!shareText) {
      return;
    }
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Equadle", text: shareText });
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
          <section className="card equadle-card">
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
          <DailydabbleUnavailable title="Equadle unavailable" message={error || "No puzzle available right now."} />
        </main>
      </>
    );
  }

  return (
    <>
      <MainNav label={navLabel} hideToday={hideToday} />

      <main className="container">
        <section className="card equadle-card">
          <div className="game-meta-row">
            <span className="chip">{contextChipLabel}</span>
            <span className="chip">Attempts: {attempts.length}/{maxGuesses}</span>
          </div>

          <p className="rule-copy">
            Use digits and + - * /. Guess must be a true {equationLength}-character equation. PEMDAS rules apply.
          </p>

          <div className="board">
            {boardRows.map((row, rowIndex) => (
              <div
                key={`row-${rowIndex}`}
                className="board-row"
                style={{ gridTemplateColumns: `repeat(${equationLength}, minmax(0, 1fr))` }}
              >
                {row.map((cell, colIndex) => (
                  <div
                    key={`cell-${rowIndex}-${colIndex}`}
                    className={`board-cell ${cell.state} ${
                      revealingRowIndex === rowIndex && (cell.state === "correct" || cell.state === "present" || cell.state === "absent")
                        ? "reveal"
                        : ""
                    }`}
                    style={
                      revealingRowIndex === rowIndex
                        ? ({
                            "--flip-delay": `${colIndex * FLIP_STAGGER_MS}ms`,
                            "--flip-duration": `${FLIP_DURATION_MS}ms`,
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    {cell.char || " "}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="equadle-keyboard" aria-label="Equation keyboard">
            {KEY_ROWS.map((row, rowIndex) => (
              <div key={`kb-row-${rowIndex}`} className="equadle-keyboard-row">
                {row.map((keyLabel) => (
                  keyLabel === "Enter" ? (
                    <button
                      key={keyLabel}
                      type="button"
                      className="equadle-key wide enter-key"
                      onClick={(event) => {
                        if (!canSubmitGuess) return;
                        void onSubmit(event);
                      }}
                      disabled={!canSubmitGuess}
                    >
                      Enter
                    </button>
                  ) : keyLabel === "Backspace" ? (
                    <button
                      key={keyLabel}
                      type="button"
                      className="equadle-key"
                      onClick={() => removeGuessChar()}
                      disabled={!canDeleteGuess}
                      aria-label="Backspace"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="equadle-backspace-icon">
                        <path
                          d="M20 5H9L3 12l6 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="m10 9 6 6m0-6-6 6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  ) : (
                    <button
                      key={keyLabel}
                      type="button"
                      className="equadle-key"
                      data-state={keyStates.get(keyLabel) || "empty"}
                      onClick={() => appendGuessChar(keyLabel)}
                      disabled={gameState !== "playing"}
                      aria-label={`Type ${keyLabel}`}
                    >
                      {keyLabel}
                    </button>
                  )
                ))}
              </div>
            ))}
          </div>

          {gameState === "playing" && message ? <p className="message" data-kind={gameState}>{message}</p> : null}

          {lockDailyCompletion && !isArchiveView && gameState !== "playing" ? (
            <p className="next-game-copy">Next game in {nextGameCountdown || "--:--:--"}</p>
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
            <p className="result-modal-copy">{performanceLabel}</p>
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
