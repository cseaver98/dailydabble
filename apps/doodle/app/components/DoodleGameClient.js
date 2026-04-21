"use client";

import { useEffect, useMemo, useState } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import MainNav from "./MainNav";

const normalizeGuess = (value) => value.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
const getSegmentKey = (segment, index) => segment.id || segment.fullD || segment.d || `segment-${index}`;
const DRAW_STAGGER_MS = 140;
const DRAW_DURATION_MS = 1750;
const isBlackTone = (value) => {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "black" ||
    normalized === "#000" ||
    normalized === "#000000" ||
    normalized === "rgb(0,0,0)" ||
    normalized === "rgb(0, 0, 0)"
  );
};
const normalizeDoodleColor = (value, fallback = "none") => {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }
  if (isBlackTone(value)) {
    return "var(--brand-strong)";
  }
  return value;
};
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
    fill: normalizeDoodleColor(sourceStyle.fill, "none"),
    stroke: normalizeDoodleColor(sourceStyle.stroke, "var(--brand-strong)"),
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
  completionPrefix = "doodle:v1:completed",
  lockDailyCompletion = true,
}) {
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
  const isArchiveView = apiUrl.includes("/by-date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [gameState, setGameState] = useState("playing");
  const [message, setMessage] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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
        setIsResultOpen(false);
        setCopyStatus("");
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

  const completionKey = useMemo(() => {
    if (!puzzle?.puzzleId) {
      return null;
    }
    return `${completionPrefix}:${puzzle.puzzleId}`;
  }, [completionPrefix, puzzle?.puzzleId]);

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
      const savedState = parsed.gameState;
      if (!lockDailyCompletion && (savedState === "won" || savedState === "lost")) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      setGuess(typeof parsed.guess === "string" ? parsed.guess : "");
      setAttempts(Array.isArray(parsed.attempts) ? parsed.attempts : []);
      if (savedState === "won" || savedState === "lost" || savedState === "playing") {
        setGameState(savedState);
      }
      if (typeof parsed.message === "string") {
        setMessage(parsed.message);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [lockDailyCompletion, storageKey]);

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

  const maxGuesses = Number.isFinite(puzzle?.stageCount) && puzzle.stageCount > 0 ? puzzle.stageCount : 5;
  const revealedStages = Math.min(maxGuesses, attempts.length + 1);
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
  const answerAliases = Array.isArray(puzzle?.aliases) ? puzzle.aliases : [];
  const isCorrectAttempt = (attempt) => {
    if (!attempt) {
      return false;
    }
    return attempt === puzzle?.answer || answerAliases.includes(attempt);
  };
  const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : "";
  const latestAttemptCorrect = isCorrectAttempt(latestAttempt);
  const earlierAttempts = attempts.slice(0, -1).reverse();

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
      const finalMessage = `Nice! The doodle is ${puzzle.answer}.`;
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
      const finalMessage = `Out of guesses. The doodle was ${puzzle.answer}.`;
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

    setMessage("Not quite. You unlocked more of the doodle.");
    setGuess("");
  };

  const resetPuzzle = () => {
    if (lockDailyCompletion && !isArchiveView) {
      setMessage("Today’s puzzle is locked after completion. Try archive games.");
      return;
    }
    setGuess("");
    setAttempts([]);
    setGameState("playing");
    setMessage("");
    setIsResultOpen(false);
    setCopyStatus("");
  };

  const finalStageSegments = Array.isArray(puzzle?.stages?.[Math.max(0, puzzle.stages.length - 1)])
    ? puzzle.stages[puzzle.stages.length - 1]
    : [];
  const shareText = [
    `Doodle ${isArchiveView ? `(Archive ${puzzle?.puzzleDate || ""})` : `(Today ${puzzle?.puzzleDate || ""})`}`.trim(),
    `${attempts.length}/${maxGuesses} tries`,
    `Answer: ${puzzle.answer}`,
  ].join("\n");
  const handleShareResult = async () => {
    if (!shareText) {
      return;
    }
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Doodle", text: shareText });
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

  return (
    <>
      <MainNav label={navLabel} hideToday={hideToday} />

      <main className="container">
        <section className="card doodle-card">
          <div className="game-meta-row">
            <span className="chip">{contextDateLabel}</span>
            <span className="chip">Guesses: {attempts.length}/{maxGuesses}</span>
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
                            style={
                              animate
                                ? {
                                    animationDelay: `${pathIndex * DRAW_STAGGER_MS}ms`,
                                    animationDuration: `${DRAW_DURATION_MS}ms`,
                                  }
                                : undefined
                            }
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
                        style={
                          animate
                            ? {
                                animationDelay: `${pathIndex * DRAW_STAGGER_MS}ms`,
                                animationDuration: `${DRAW_DURATION_MS}ms`,
                              }
                            : undefined
                        }
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
                            animationDelay: `${pathIndex * DRAW_STAGGER_MS}ms`,
                            animationDuration: `${DRAW_DURATION_MS}ms`,
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
                        animationDelay: `${pathIndex * DRAW_STAGGER_MS}ms`,
                        animationDuration: `${DRAW_DURATION_MS}ms`,
                      }}
                    />
                  );
                })}
            </svg>
          </div>

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

          <p className="message" data-kind={gameState}>{message || "Start guessing to reveal the drawing."}</p>

          {lockDailyCompletion && !isArchiveView && gameState !== "playing" ? (
            <p className="next-game-copy">Next game in {nextGameCountdown || "--:--:--"}</p>
          ) : null}

          {attempts.length > 0 ? (
            <div className="guess-history-wrap">
              <button
                type="button"
                className="guess-history-toggle"
                aria-expanded={isHistoryOpen}
                aria-controls="doodle-guess-history-panel"
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
              <div className="guess-history-latest">
                <span className="guess-history-guess">{latestAttempt}</span>
                {latestAttemptCorrect ? (
                  <strong className="guess-history-status-correct">Correct</strong>
                ) : (
                  <strong className="guess-history-status-wrong">Wrong</strong>
                )}
              </div>
              {isHistoryOpen && earlierAttempts.length > 0 ? (
                <ul id="doodle-guess-history-panel" className="guess-history-list">
                  {earlierAttempts.map((attempt, index) => (
                    <li key={`${attempt}-${index}`} className="guess-history-item">
                      <span className="guess-history-guess">{attempt}</span>
                      <strong className="guess-history-status-wrong">Wrong</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
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
            <p className="result-modal-answer">{puzzle.answer}</p>
            {finalStageSegments.length > 0 ? (
              <div className="result-modal-doodle-wrap">
                <svg className="result-modal-doodle" viewBox={puzzle.viewBox || "0 0 340 340"} role="img" aria-label="Solved doodle">
                  {finalStageSegments
                    .map((segment, index) => ({ segment: normalizeStageSegment(segment), index }))
                    .filter((entry) => Boolean(entry.segment))
                    .map(({ segment, index }) => (
                      <path
                        key={`result-${index}`}
                        d={segment.d}
                        fill={segment.style.fill}
                        fillRule={segment.style.fillRule || "evenodd"}
                        stroke={segment.style.stroke}
                        strokeWidth={segment.style.strokeWidth}
                        strokeLinecap={segment.style.strokeLinecap}
                        strokeLinejoin={segment.style.strokeLinejoin}
                        opacity={segment.style.opacity}
                        fillOpacity={segment.style.fillOpacity}
                        strokeOpacity={segment.style.strokeOpacity}
                      />
                    ))}
                </svg>
              </div>
            ) : null}
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
