"use client";

import { useEffect, useMemo, useState } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
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
  const [revealedDetails, setRevealedDetails] = useState(null);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

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
        setRevealedDetails(null);
        setIsImageOpen(false);
        setIsResultOpen(false);
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
      setRevealedDetails(
        parsed?.revealedDetails && typeof parsed.revealedDetails === "object" ? parsed.revealedDetails : null,
      );
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
      setRevealedDetails(
        parsed?.revealedDetails && typeof parsed.revealedDetails === "object" ? parsed.revealedDetails : null,
      );
    } catch {
      window.localStorage.removeItem(completionKey);
    }
  }, [completionKey, lockDailyCompletion, puzzle?.puzzleId]);

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
      setSuggestions([]);
      return () => {};
    }

    const trimmed = guess.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return () => {};
    }

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/puzzle/suggest?q=${encodeURIComponent(trimmed)}&limit=8`, { cache: "no-store" });
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
  }, [gameState, guess]);

  useEffect(() => {
    if (gameState === "won" || gameState === "lost") {
      setIsResultOpen(true);
    }
  }, [gameState]);

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
      setSuggestions([]);

      if (payload.isCorrect) {
        const title = payload.answerTitle || "the movie";
        const finalMessage = `Correct! It was ${title}.`;
        setGameState("won");
        setRevealedAnswer(title);
        setRevealedDetails(payload.answerDetails || null);
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
              revealedDetails: payload.answerDetails || null,
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
        setRevealedDetails(payload.answerDetails || null);
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
              revealedDetails: payload.answerDetails || null,
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
      setRevealedDetails(null);
      setIsResultOpen(false);
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
          <DailydabbleUnavailable title="Moviedle unavailable" message={error || "No puzzle available right now."} />
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
          {gameState === "playing" && suggestions.length > 0 ? (
            <div className="suggestions-wrap" role="listbox" aria-label="Movie title suggestions">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="suggestion-item"
                  onClick={() => {
                    setGuess(item.title);
                    setSuggestions([]);
                  }}
                >
                  {item.title}
                </button>
              ))}
            </div>
          ) : null}

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

      {isResultOpen && gameState !== "playing" ? (
        <div className="result-modal-backdrop" onClick={() => setIsResultOpen(false)}>
          <section className="result-modal-panel" onClick={(event) => event.stopPropagation()}>
            <button className="result-modal-close" type="button" onClick={() => setIsResultOpen(false)}>
              Close
            </button>
            <h2 className="result-modal-title">Results</h2>
            <p className="result-modal-answer">{revealedAnswer || revealedDetails?.title || "Unknown title"}</p>
            {Number.isFinite(revealedDetails?.releaseYear) ? (
              <p className="result-modal-copy"><strong>Year:</strong> {revealedDetails.releaseYear}</p>
            ) : null}
            {Array.isArray(revealedDetails?.leadActors) && revealedDetails.leadActors.length > 0 ? (
              <p className="result-modal-copy">
                <strong>Lead actors:</strong> {revealedDetails.leadActors.join(", ")}
              </p>
            ) : null}
            {revealedDetails?.summary ? (
              <p className="result-modal-copy">{revealedDetails.summary}</p>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
