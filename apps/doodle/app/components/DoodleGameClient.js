"use client";

import { useEffect, useMemo, useState } from "react";
import MainNav from "./MainNav";

const normalizeGuess = (value) => value.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");

export default function DoodleGameClient({
  apiUrl,
  navLabel = "Doodle",
  hideToday = false,
  archiveHref = "/archive",
  storagePrefix = "doodle:v1:today",
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [gameState, setGameState] = useState("playing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadPuzzle = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(apiUrl, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load doodle puzzle");
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
        setError(loadError instanceof Error ? loadError.message : "Failed to load doodle puzzle");
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

  const storageKey = useMemo(() => {
    if (!puzzle?.puzzleId) {
      return null;
    }
    return `${storagePrefix}:${puzzle.puzzleId}`;
  }, [puzzle?.puzzleId, storagePrefix]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setGuess(typeof parsed.guess === "string" ? parsed.guess : "");
      setAttempts(Array.isArray(parsed.attempts) ? parsed.attempts : []);
      const savedState = parsed.gameState;
      if (savedState === "won" || savedState === "lost" || savedState === "playing") {
        setGameState(savedState);
      }
      if (typeof parsed.message === "string") {
        setMessage(parsed.message);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !puzzle) {
      return;
    }

    const payload = {
      guess,
      attempts,
      gameState,
      message,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [attempts, gameState, guess, message, puzzle, storageKey]);

  if (loading) {
    return (
      <>
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <section className="card legal-card">
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
          <section className="card legal-card">
            <h1 className="page-title">Doodle unavailable</h1>
            <p className="page-subtle">{error || "No puzzle available right now."}</p>
          </section>
        </main>
      </>
    );
  }

  const maxGuesses = Number.isFinite(puzzle.stageCount) && puzzle.stageCount > 0 ? puzzle.stageCount : 5;
  const revealedStages = Math.min(maxGuesses, attempts.length + 1);
  const guessesLeft = Math.max(0, maxGuesses - attempts.length);
  const clueList = Array.isArray(puzzle.clues) && puzzle.clues.length > 0 ? puzzle.clues : [`Clue 1: Start guessing.`];
  const activeClue = clueList[Math.min(revealedStages - 1, clueList.length - 1)];

  const submitGuess = (event) => {
    event.preventDefault();
    if (gameState !== "playing") {
      return;
    }

    const normalized = normalizeGuess(guess);
    if (!normalized) {
      setMessage("Enter a guess first.");
      return;
    }

    const aliases = Array.isArray(puzzle.aliases) ? puzzle.aliases : [];
    const isCorrect = normalized === puzzle.answer || aliases.includes(normalized);
    const nextAttempts = [...attempts, normalized];
    setAttempts(nextAttempts);

    if (isCorrect) {
      setGameState("won");
      setMessage(`Nice! The doodle is ${puzzle.answer}.`);
      return;
    }

    if (nextAttempts.length >= maxGuesses) {
      setGameState("lost");
      setMessage(`Out of guesses. The doodle was ${puzzle.answer}.`);
      return;
    }

    setMessage("Not quite. You unlocked more of the doodle.");
    setGuess("");
  };

  const resetPuzzle = () => {
    setGuess("");
    setAttempts([]);
    setGameState("playing");
    setMessage("");
  };

  return (
    <>
      <MainNav label={navLabel} hideToday={hideToday} />

      <main className="container">
        <section className="card doodle-card">
          <div className="game-meta-row">
            <span className="chip">Guesses: {attempts.length}/{maxGuesses}</span>
            <span className="chip">Remaining: {guessesLeft}</span>
            <span className="chip">Reveal: {revealedStages}/{maxGuesses}</span>
          </div>

          <div className="doodle-stage-wrap">
            <svg className="doodle-canvas" viewBox={puzzle.viewBox || "0 0 340 340"} role="img" aria-label="Doodle clue drawing">
              {puzzle.stages.slice(0, revealedStages).map((stage, stageIndex) => (
                <g key={`stage-${stageIndex}`}>
                  {stage.map((path, pathIndex) => (
                    <path
                      key={`path-${stageIndex}-${pathIndex}`}
                      d={path}
                      className="doodle-path"
                      style={{ animationDelay: `${stageIndex * 120 + pathIndex * 55}ms` }}
                    />
                  ))}
                </g>
              ))}
            </svg>
          </div>

          <p className="doodle-clue">{activeClue}</p>

          <form className="guess-form" onSubmit={submitGuess}>
            <input
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              className="guess-input"
              type="text"
              placeholder="Type your guess..."
              aria-label="Guess the doodle"
              disabled={gameState !== "playing"}
            />
            <button className="guess-submit-btn" type="submit" disabled={gameState !== "playing"}>
              Guess
            </button>
          </form>

          <p className="message" data-kind={gameState}>{message || "Start guessing to reveal the drawing."}</p>

          {attempts.length > 0 ? (
            <div className="guess-history-wrap">
              <p className="guess-history-title">Guess History</p>
              <ul className="guess-history-list">
                {attempts.map((attempt, index) => (
                  <li key={`${attempt}-${index}`} className="guess-history-item">
                    <span>Guess {index + 1}</span>
                    <strong>{attempt}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {gameState !== "playing" ? (
            <div className="post-actions">
              <button className="admin-btn-like" type="button" onClick={resetPuzzle}>Play Again</button>
              <a className="admin-btn-like primary" href={archiveHref}>Archive Games</a>
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
