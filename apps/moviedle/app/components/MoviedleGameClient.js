"use client";

import { useEffect, useMemo, useState } from "react";
import MainNav from "./MainNav";

const normalizeGuess = (value) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export default function MoviedleGameClient({
  apiUrl,
  navLabel = "Moviedle",
  hideToday = false,
  archiveHref = "/archive",
  storagePrefix = "moviedle:v1:today",
  completionPrefix = "moviedle:v1:completed",
  lockDailyCompletion = true,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [gameState, setGameState] = useState("playing");
  const [message, setMessage] = useState("");
  const [revealedAnswer, setRevealedAnswer] = useState("");
  const [isImageOpen, setIsImageOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const loadPuzzle = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(apiUrl, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load Moviedle puzzle");
        }

        if (!active) {
          return;
        }

        setPuzzle(payload);
        setGuess("");
        setAttempts([]);
        setGameState("playing");
        setMessage("");
        setRevealedAnswer("");
        setIsImageOpen(false);
      } catch (loadError) {
        if (!active) {
          return;
        }
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
      setGuess(typeof parsed.guess === "string" ? parsed.guess : "");
      setAttempts(Array.isArray(parsed.attempts) ? parsed.attempts : []);
      setGameState(parsed.gameState === "won" || parsed.gameState === "lost" ? parsed.gameState : "playing");
      setMessage(typeof parsed.message === "string" ? parsed.message : "");
      setRevealedAnswer(typeof parsed.revealedAnswer === "string" ? parsed.revealedAnswer : "");
    } catch {
      window.localStorage.removeItem(progressKey);
    }
  }, [progressKey]);

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
      setRevealedAnswer(typeof parsed.revealedAnswer === "string" ? parsed.revealedAnswer : "");
    } catch {
      window.localStorage.removeItem(completionKey);
    }
  }, [completionKey, lockDailyCompletion, puzzle?.puzzleId]);

  useEffect(() => {
    if (!progressKey || !puzzle) {
      return;
    }

    const payload = { guess, attempts, gameState, message, revealedAnswer };
    window.localStorage.setItem(progressKey, JSON.stringify(payload));
  }, [attempts, gameState, guess, message, progressKey, puzzle, revealedAnswer]);

  const maxGuesses = Number.isFinite(puzzle?.maxGuesses) ? Number(puzzle.maxGuesses) : 5;
  const stills = Array.isArray(puzzle?.stillImages) ? puzzle.stillImages : [];
  const revealedStillCount = Math.max(1, Math.min(stills.length || 1, 1 + attempts.length));
  const visibleStill = stills[Math.max(0, revealedStillCount - 1)] || null;
  const guessesLeft = Math.max(0, maxGuesses - attempts.length);

  const handleSubmit = async (event) => {
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
      const response = await fetch("/api/puzzle/submit", {
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
      setGuess("");

      if (payload.isCorrect) {
        const title = payload.answerTitle || "the movie";
        const finalMessage = `Correct! It was ${title}.`;
        setGameState("won");
        setRevealedAnswer(title);
        setMessage(finalMessage);

        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
              attempts: nextAttempts,
              gameState: "won",
              message: finalMessage,
              revealedAnswer: title,
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
        setMessage(finalMessage);

        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
              attempts: nextAttempts,
              gameState: "lost",
              message: finalMessage,
              revealedAnswer: title,
            }),
          );
        }
        return;
      }

      setMessage("Not quite. Another still has been revealed.");
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : "Could not submit guess.");
    }
  };

  const resetArchivePuzzle = () => {
    if (!lockDailyCompletion) {
      setGuess("");
      setAttempts([]);
      setGameState("playing");
      setMessage("");
      setRevealedAnswer("");
      return;
    }

    setMessage("Today’s puzzle is locked after completion. Try archive games.");
  };

  if (loading) {
    return (
      <>
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <section className="card moviedle-card">
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
          <section className="card moviedle-card">
            <h1 className="page-title">Moviedle unavailable</h1>
            <p className="page-subtle">{error || "No puzzle available right now."}</p>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <MainNav label={navLabel} hideToday={hideToday} />

      <main className="container">
        <section className="card moviedle-card">
          <div className="game-meta-row">
            <span className="chip">Attempts: {attempts.length}/{maxGuesses}</span>
            <span className="chip">Remaining: {guessesLeft}</span>
            <span className="chip">Still: {revealedStillCount}/{Math.max(1, stills.length)}</span>
          </div>

          <button
            type="button"
            className="still-figure-button"
            onClick={() => setIsImageOpen(true)}
            aria-label="Open still fullscreen"
            disabled={!visibleStill}
          >
            <figure className="still-figure">
              {visibleStill ? (
                <img src={visibleStill.url} alt={visibleStill.alt || "Movie still"} className="still-image" />
              ) : (
                <p className="page-subtle">No still image available.</p>
              )}
            </figure>
          </button>

          <form className="guess-form" onSubmit={handleSubmit}>
            <input
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              className="guess-input"
              type="text"
              placeholder="Guess the movie title"
              aria-label="Guess the movie title"
              disabled={gameState !== "playing"}
              autoCapitalize="words"
            />
            <button className="guess-submit-btn" type="submit" disabled={gameState !== "playing"}>
              Guess
            </button>
          </form>

          <p className="message" data-kind={gameState}>
            {message || "Guess the movie. Wrong guesses reveal additional stills."}
          </p>

          {revealedAnswer ? (
            <p className="answer-banner">
              Answer: <strong>{revealedAnswer}</strong>
            </p>
          ) : null}

          {attempts.length > 0 ? (
            <div className="guess-history-wrap">
              <p className="guess-history-title">Guess History</p>
              <ul className="guess-history-list">
                {attempts.map((attempt, index) => (
                  <li key={`${attempt.normalizedGuess}-${index}`} className="guess-history-item">
                    <span>{attempt.guess}</span>
                    <strong>{attempt.isCorrect ? "Correct" : "Wrong"}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {gameState !== "playing" ? (
            <div className="post-actions">
              <button className="admin-btn-like" type="button" onClick={resetArchivePuzzle}>
                {lockDailyCompletion ? "Today Locked" : "Play Again"}
              </button>
              <a className="admin-btn-like primary" href={archiveHref}>Archive Games</a>
            </div>
          ) : null}
        </section>
      </main>

      {isImageOpen && visibleStill ? (
        <div className="image-modal-backdrop" onClick={() => setIsImageOpen(false)}>
          <div className="image-modal-panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="image-modal-close"
              onClick={() => setIsImageOpen(false)}
              aria-label="Close image"
            >
              Close
            </button>
            <img src={visibleStill.url} alt={visibleStill.alt || "Movie still"} className="image-modal-image" />
          </div>
        </div>
      ) : null}
    </>
  );
}
