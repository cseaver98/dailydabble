"use client";

import { useEffect, useMemo, useState } from "react";
import MainNav from "./MainNav";

export default function SportleGameClient({
  apiUrl,
  navLabel = "Sportle",
  hideToday = false,
  archiveHref = "/archive",
  storagePrefix = "sportle:v1:today",
  completionPrefix = "sportle:v1:completed",
  lockDailyCompletion = true,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [gameState, setGameState] = useState("playing");
  const [message, setMessage] = useState("");
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
      setGuess(typeof parsed.guess === "string" ? parsed.guess : "");
      setAttempts(Array.isArray(parsed.attempts) ? parsed.attempts : []);
      setGameState(parsed.gameState === "won" || parsed.gameState === "lost" ? parsed.gameState : "playing");
      setMessage(typeof parsed.message === "string" ? parsed.message : "");
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
    } catch {
      window.localStorage.removeItem(completionKey);
    }
  }, [completionKey, lockDailyCompletion, puzzle?.puzzleId]);

  useEffect(() => {
    if (!progressKey || !puzzle) {
      return;
    }

    window.localStorage.setItem(progressKey, JSON.stringify({ guess, attempts, gameState, message }));
  }, [attempts, gameState, guess, message, progressKey, puzzle]);

  useEffect(() => {
    if (!puzzle?.sport || gameState !== "playing") {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const query = guess.trim();

    const run = async () => {
      try {
        const params = new URLSearchParams({ sport: puzzle.sport });
        if (query) {
          params.set("q", query);
        }
        const response = await fetch(`/api/puzzle/athletes?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load suggestions");
        }
        setSuggestions(Array.isArray(payload.items) ? payload.items : []);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      }
    };

    const timeoutId = window.setTimeout(() => {
      void run();
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [gameState, guess, puzzle?.sport]);

  const maxGuesses = Number.isFinite(puzzle?.maxGuesses) ? Number(puzzle.maxGuesses) : 6;
  const guessesLeft = Math.max(0, maxGuesses - attempts.length);
  const clues = Array.isArray(puzzle?.clues) ? puzzle.clues : [];
  const revealedHintCount = Math.min(clues.length, 1 + attempts.length);
  const visibleHints = clues.slice(0, revealedHintCount);

  const onSubmit = async (event) => {
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
        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
              attempts: nextAttempts,
              gameState: "won",
              message: finalMessage,
            }),
          );
        }
        return;
      }

      if (nextAttempts.length >= maxGuesses) {
        const finalMessage = `Out of guesses. Athlete: ${payload.answerName}`;
        setGameState("lost");
        setMessage(finalMessage);
        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
              attempts: nextAttempts,
              gameState: "lost",
              message: finalMessage,
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
      return;
    }

    setMessage("Today’s puzzle is locked after completion. Try archive games.");
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
          <section className="card sportle-card">
            <h1 className="page-title">Sportle unavailable</h1>
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
        <section className="card sportle-card">
          <div className="game-meta-row">
            <span className="chip">Sport: {String(puzzle.sport || "nba").toUpperCase()}</span>
            <span className="chip">Attempts: {attempts.length}/{maxGuesses}</span>
            <span className="chip">Remaining: {guessesLeft}</span>
          </div>

          <div className="hints-wrap">
            <p className="guess-history-title">Clues</p>
            <ul className="hints-list">
              {visibleHints.map((clue, index) => (
                <li key={`${clue.label}-${index}`} className="hint-item">
                  <span className="hint-label">{clue.label}</span>
                  {index === 0 && clue.logoUrl ? (
                    <div className="clue-team-row">
                      <img src={clue.logoUrl} alt={clue.value || "Team logo"} className="team-logo" />
                      <span>{clue.value}</span>
                    </div>
                  ) : (
                    <span>{clue.value}</span>
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
              list="athlete-guess-suggestions"
              placeholder="Type an athlete name"
              aria-label="Guess athlete"
              disabled={gameState !== "playing"}
            />
            <datalist id="athlete-guess-suggestions">
              {suggestions.map((item) => (
                <option key={item.id} value={item.fullName} />
              ))}
            </datalist>
            <button className="guess-submit-btn" type="submit" disabled={gameState !== "playing"}>
              Guess
            </button>
          </form>

          <p className="message" data-kind={gameState}>
            {message || "Start with clue 1. Wrong guesses unlock more clues."}
          </p>

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

          {gameState !== "playing" ? (
            <div className="post-actions">
              <button className="admin-btn-like" type="button" onClick={resetArchivePuzzle}>
                {lockDailyCompletion ? "Today Locked" : "Play Again"}
              </button>
              <a className="admin-btn-like primary" href={archiveHref}>Play Archive Games</a>
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
