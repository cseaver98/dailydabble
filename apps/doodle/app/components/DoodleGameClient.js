"use client";

import { useEffect, useMemo, useState } from "react";
import MainNav from "./MainNav";

const normalizeGuess = (value) => value.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
const normalizeStageSegment = (segment) => {
  if (typeof segment === "string") {
    return { d: segment, to: 1 };
  }

  if (!segment || typeof segment !== "object" || typeof segment.d !== "string") {
    return null;
  }

  const to = Number(segment.to ?? 1);
  const safeTo = Number.isFinite(to) ? Math.max(0.001, Math.min(1, to)) : 1;
  const sourceStyle = segment.style && typeof segment.style === "object" ? segment.style : {};
  const normalizedStyle = {
    fill: typeof sourceStyle.fill === "string" ? sourceStyle.fill : "none",
    stroke: typeof sourceStyle.stroke === "string" ? sourceStyle.stroke : "var(--brand-strong)",
    strokeWidth: typeof sourceStyle["stroke-width"] === "string" ? sourceStyle["stroke-width"] : "8",
    strokeLinecap: typeof sourceStyle["stroke-linecap"] === "string" ? sourceStyle["stroke-linecap"] : "round",
    strokeLinejoin: typeof sourceStyle["stroke-linejoin"] === "string" ? sourceStyle["stroke-linejoin"] : "round",
    opacity: typeof sourceStyle.opacity === "string" ? sourceStyle.opacity : "1",
    fillOpacity: typeof sourceStyle["fill-opacity"] === "string" ? sourceStyle["fill-opacity"] : "1",
    strokeOpacity: typeof sourceStyle["stroke-opacity"] === "string" ? sourceStyle["stroke-opacity"] : "1",
    fillRule: typeof sourceStyle["fill-rule"] === "string" ? sourceStyle["fill-rule"] : "evenodd",
  };
  return {
    d: segment.d,
    to: safeTo,
    style: normalizedStyle,
    fillOnly: typeof segment.fillOnly === "boolean" ? segment.fillOnly : undefined,
    complete: typeof segment.complete === "boolean" ? segment.complete : undefined,
    fullD: typeof segment.fullD === "string" ? segment.fullD : undefined,
  };
};

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
          if (response.status === 404) {
            if (active) {
              setPuzzle(null);
              setError("");
            }
            return;
          }
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

  const activeStageSegments = Array.isArray(puzzle.stages?.[revealedStages - 1])
    ? puzzle.stages[revealedStages - 1]
    : [];

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
              {activeStageSegments
                .map((segment, pathIndex) => ({ segment: normalizeStageSegment(segment), pathIndex }))
                .filter((entry) => Boolean(entry.segment))
                .map(({ segment, pathIndex }) => {
                  const isFillOnly = typeof segment.fillOnly === "boolean"
                    ? segment.fillOnly
                    : String(segment.style.stroke || "").toLowerCase() === "none" &&
                      String(segment.style.fill || "").toLowerCase() !== "none";
                  const drawFill = isFillOnly ? segment.style.fill : "none";
                  const drawStroke = isFillOnly ? "none" : segment.style.stroke;
                  const drawStrokeWidth = isFillOnly ? "1.75" : segment.style.strokeWidth;
                  const drawStrokeLinecap = isFillOnly ? "round" : segment.style.strokeLinecap;
                  const drawStrokeLinejoin = isFillOnly ? "round" : segment.style.strokeLinejoin;
                  const drawFillRule = segment.style.fillRule || "evenodd";
                  const fullD = segment.fullD || segment.d;
                  const maskId = `doodle-mask-${revealedStages}-${pathIndex}`;
                  if (isFillOnly) {
                    return (
                      <g key={`fill-${revealedStages}-${pathIndex}`}>
                        <defs>
                          <mask id={maskId} maskUnits="userSpaceOnUse">
                            <rect x="-10000" y="-10000" width="20000" height="20000" fill="black" />
                            <path
                              d={segment.d}
                              fill="white"
                              stroke="white"
                              strokeWidth="18"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fillRule={drawFillRule}
                            />
                          </mask>
                        </defs>
                        <path
                          d={fullD}
                          className="doodle-path"
                          fill={drawFill}
                          fillRule={drawFillRule}
                          stroke="none"
                          opacity={segment.style.opacity}
                          fillOpacity={segment.style.fillOpacity}
                          mask={`url(#${maskId})`}
                          style={{ animationDelay: `${pathIndex * 55}ms` }}
                        />
                      </g>
                    );
                  }
                  return (
                    <path
                      key={`path-${revealedStages}-${pathIndex}`}
                      d={segment.d}
                      className="doodle-path"
                      fill={drawFill}
                      fillRule={drawFillRule}
                      stroke={drawStroke}
                      strokeWidth={drawStrokeWidth}
                      strokeLinecap={drawStrokeLinecap}
                      strokeLinejoin={drawStrokeLinejoin}
                      opacity={segment.style.opacity}
                      fillOpacity={segment.style.fillOpacity}
                      strokeOpacity={isFillOnly ? "0.92" : segment.style.strokeOpacity}
                      pathLength={1}
                      strokeDasharray={`${segment.to} 1`}
                      style={{ animationDelay: `${pathIndex * 55}ms` }}
                    />
                  );
                })}
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
