"use client";

import { useEffect, useMemo, useState } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import MainNav from "./MainNav";

const EMPTY_ROW = Array.from({ length: 9 }, () => ({ char: "", state: "empty" }));
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

export default function EquadleGameClient({
  apiUrl,
  navLabel = "Equadle",
  hideToday = false,
  archiveHref = "/archive",
  storagePrefix = "equadle:v1:today",
  completionPrefix = "equadle:v1:completed",
  lockDailyCompletion = true,
}) {
  const isArchiveView = apiUrl.includes("/by-date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [gameState, setGameState] = useState("playing");
  const [message, setMessage] = useState("");
  const [resolvedAnswer, setResolvedAnswer] = useState("");
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [nextGameCountdown, setNextGameCountdown] = useState("");
  const fallbackDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const contextDateLabel = `${isArchiveView ? "Archive game" : "Today's game"}: ${puzzle?.puzzleDate || fallbackDate}`;

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

  const maxGuesses = Number.isFinite(puzzle?.maxGuesses) ? Number(puzzle.maxGuesses) : 6;
  const equationLength = Number.isFinite(puzzle?.equationLength) ? Number(puzzle.equationLength) : 9;

  const boardRows = useMemo(() => {
    const rows = attempts.map((attempt) =>
      attempt.guess.split("").map((char, index) => ({
        char,
        state: attempt.feedback[index] || "absent",
      })),
    );

    if (gameState === "playing") {
      const draft = guess
        .slice(0, equationLength)
        .split("")
        .map((char) => ({ char, state: "draft" }));

      while (draft.length < equationLength) {
        draft.push({ char: "", state: "empty" });
      }

      rows.push(draft);
    }

    while (rows.length < maxGuesses) {
      rows.push([...EMPTY_ROW]);
    }

    return rows;
  }, [attempts, equationLength, gameState, guess, maxGuesses]);

  const onSubmit = async (event) => {
    event.preventDefault();

    if (!puzzle || gameState !== "playing") {
      return;
    }

    const guessEquation = guess.trim();
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
      setGuess("");

      if (payload.isCorrect) {
        const finalMessage = `Correct. Equation: ${payload.answer}`;
        setGameState("won");
        setMessage(finalMessage);
        setResolvedAnswer(payload.answer || "");
        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
              attempts: nextAttempts,
              gameState: "won",
              message: finalMessage,
              resolvedAnswer: payload.answer || "",
            }),
          );
        }
        return;
      }

      if (nextAttempts.length >= maxGuesses) {
        const finalMessage = `Out of guesses. Answer: ${payload.answer}`;
        setGameState("lost");
        setMessage(finalMessage);
        setResolvedAnswer(payload.answer || "");
        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
              attempts: nextAttempts,
              gameState: "lost",
              message: finalMessage,
              resolvedAnswer: payload.answer || "",
            }),
          );
        }
        return;
      }

      setMessage("Nice try. Keep going.");
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : "Guess must be a valid equation");
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

  const effectiveAnswer = resolvedAnswer || puzzle?.answer || "Unavailable";
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
            <span className="chip">{contextDateLabel}</span>
            <span className="chip">Attempts: {attempts.length}/{maxGuesses}</span>
            <span className="chip">Length: {equationLength}</span>
          </div>

          <p className="rule-copy">Use digits and + - * / =. Guess must be a true 9-character equation.</p>

          <div className="board">
            {boardRows.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="board-row">
                {row.map((cell, colIndex) => (
                  <div key={`cell-${rowIndex}-${colIndex}`} className={`board-cell ${cell.state}`}>
                    {cell.char || " "}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <form className="guess-form" onSubmit={onSubmit}>
            <input
              value={guess}
              onChange={(event) => setGuess(event.target.value.replace(/\s+/g, "").slice(0, equationLength))}
              className="guess-input"
              type="text"
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. 3*10-4=26"
              aria-label="Guess equation"
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

          <p className="message" data-kind={gameState}>{message || "Green = exact, Yellow = present, Gray = absent."}</p>

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
            <p className="result-modal-answer">{effectiveAnswer}</p>
            <div className="result-modal-actions">
              <button className="admin-btn-like" type="button" onClick={handleShareResult}>
                Share
              </button>
              <a className="admin-btn-like primary" href={archiveHref}>Play Archive Games</a>
            </div>
            {copyStatus ? <p className="result-modal-copy">{copyStatus}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
