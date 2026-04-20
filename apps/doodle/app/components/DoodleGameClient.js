"use client";

import { useEffect, useMemo, useState } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import MainNav from "./MainNav";

const normalizeGuess = (value) => value.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
const getSegmentKey = (segment, index) => segment.id || segment.fullD || segment.d || `segment-${index}`;
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
    id: typeof segment.id === "string" ? segment.id : undefined,
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

  const maxGuesses = Number.isFinite(puzzle?.stageCount) && puzzle.stageCount > 0 ? puzzle.stageCount : 5;
  const revealedStages = Math.min(maxGuesses, attempts.length + 1);
  const guessesLeft = Math.max(0, maxGuesses - attempts.length);
  const clueList = Array.isArray(puzzle?.clues) && puzzle.clues.length > 0 ? puzzle.clues : [`Clue 1: Start guessing.`];
  const activeClue = clueList[Math.min(revealedStages - 1, clueList.length - 1)];
  const activeStageSegments = Array.isArray(puzzle?.stages?.[revealedStages - 1])
    ? puzzle.stages[revealedStages - 1]
    : [];
  const previousStageSegments = Array.isArray(puzzle?.stages?.[revealedStages - 2])
    ? puzzle.stages[revealedStages - 2]
    : [];
  const previousStageMap = useMemo(() => {
    const map = new Map();
    previousStageSegments
      .map((segment, index) => ({ segment: normalizeStageSegment(segment), index }))
      .filter((entry) => Boolean(entry.segment))
      .forEach(({ segment, index }) => {
        map.set(getSegmentKey(segment, index), segment);
      });
    return map;
  }, [previousStageSegments]);

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
          <DailydabbleUnavailable title="Doodle unavailable" message={error || "No puzzle available right now."} />
        </main>
      </>
    );
  }

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
              {activeStageSegments
                .map((segment, pathIndex) => ({ segment: normalizeStageSegment(segment), pathIndex }))
                .filter((entry) => Boolean(entry.segment))
                .map(({ segment, pathIndex }) => {
                  const segmentKey = getSegmentKey(segment, pathIndex);
                  const previousSegment = previousStageMap.get(segmentKey) ?? null;
                  const previousD =
                    previousSegment && typeof previousSegment.d === "string"
                      ? previousSegment.d.trim()
                      : "";
                  const currentD = typeof segment.d === "string" ? segment.d.trim() : "";
                  const hasPreviousPortion =
                    Boolean(previousD) &&
                    Boolean(currentD) &&
                    currentD.startsWith(previousD) &&
                    currentD.length > previousD.length;
                  const deltaD = hasPreviousPortion ? currentD.slice(previousD.length).trim() : "";
                  const hasDelta = Boolean(deltaD);
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
                  const safeMaskKey = String(segmentKey).replace(/[^a-zA-Z0-9_-]/g, "_");
                  const baseMaskId = `doodle-mask-${safeMaskKey}`;
                  const animateMaskId = `doodle-mask-anim-${safeMaskKey}-${revealedStages}`;

                  const renderFillMasked = (maskPath, maskId, animate = false) => (
                    <g key={`${maskId}`}>
                      <defs>
                        <mask id={maskId} maskUnits="userSpaceOnUse">
                          <rect x="-10000" y="-10000" width="20000" height="20000" fill="black" />
                          <path
                            d={maskPath}
                            className={animate ? "doodle-mask-path" : undefined}
                            fill="none"
                            stroke="white"
                            strokeWidth="18"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fillRule={drawFillRule}
                            pathLength={1}
                            strokeDasharray={`${segment.to} 1`}
                            strokeDashoffset={animate ? segment.to : 0}
                            style={animate ? { animationDelay: `${pathIndex * 55}ms` } : undefined}
                          />
                        </mask>
                      </defs>
                      <path
                        d={fullD}
                        className={animate ? "doodle-path" : undefined}
                        fill={drawFill}
                        fillRule={drawFillRule}
                        stroke="none"
                        opacity={segment.style.opacity}
                        fillOpacity={segment.style.fillOpacity}
                        mask={`url(#${maskId})`}
                        style={animate ? { animationDelay: `${pathIndex * 55}ms` } : undefined}
                      />
                    </g>
                  );

                  if (isFillOnly) {
                    if (hasDelta) {
                      return (
                        <g key={`fill-split-${segmentKey}`}>
                          {renderFillMasked(previousD, `${baseMaskId}-static`, false)}
                          {renderFillMasked(deltaD, animateMaskId, true)}
                        </g>
                      );
                    }

                    if (previousSegment && !hasDelta) {
                      return renderFillMasked(currentD || segment.d, `${baseMaskId}-current`, false);
                    }

                    return (
                      renderFillMasked(currentD || segment.d, animateMaskId, true)
                    );
                  }

                  if (hasDelta) {
                    return (
                      <g key={`stroke-split-${segmentKey}`}>
                        <path
                          d={previousD}
                          fill={drawFill}
                          fillRule={drawFillRule}
                          stroke={drawStroke}
                          strokeWidth={drawStrokeWidth}
                          strokeLinecap={drawStrokeLinecap}
                          strokeLinejoin={drawStrokeLinejoin}
                          opacity={segment.style.opacity}
                          fillOpacity={segment.style.fillOpacity}
                          strokeOpacity={segment.style.strokeOpacity}
                        />
                        <path
                          key={`path-anim-${segmentKey}-${revealedStages}`}
                          d={deltaD}
                          className="doodle-path"
                          fill="none"
                          stroke={drawStroke}
                          strokeWidth={drawStrokeWidth}
                          strokeLinecap={drawStrokeLinecap}
                          strokeLinejoin={drawStrokeLinejoin}
                          opacity={segment.style.opacity}
                          strokeOpacity={segment.style.strokeOpacity}
                          pathLength={1}
                          strokeDasharray={`${segment.to} 1`}
                          strokeDashoffset={segment.to}
                          style={{
                            animationDelay: `${pathIndex * 55}ms`,
                          }}
                        />
                      </g>
                    );
                  }

                  if (previousSegment && !hasDelta) {
                    return (
                      <path
                        key={`path-static-${segmentKey}`}
                        d={segment.d}
                        fill={drawFill}
                        fillRule={drawFillRule}
                        stroke={drawStroke}
                        strokeWidth={drawStrokeWidth}
                        strokeLinecap={drawStrokeLinecap}
                        strokeLinejoin={drawStrokeLinejoin}
                        opacity={segment.style.opacity}
                        fillOpacity={segment.style.fillOpacity}
                        strokeOpacity={segment.style.strokeOpacity}
                      />
                    );
                  }

                  return (
                    <path
                      key={`path-${segmentKey}-${revealedStages}`}
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
                      strokeDashoffset={segment.to}
                      style={{
                        animationDelay: `${pathIndex * 55}ms`,
                      }}
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
