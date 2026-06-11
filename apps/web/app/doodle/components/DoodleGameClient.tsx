"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import { toPublicAppUrl } from "../../../lib/app-url";
import ArchiveLockGate from "../../components/ArchiveLockGate";
import HowToPlayDialog from "../../components/HowToPlayDialog";
import LoadingLabel from "../../components/LoadingLabel";
import MainNav from "./MainNav";

type DoodleGameClientProps = {
  apiUrl: string;
  navLabel?: string;
  hideToday?: boolean;
  archiveHref?: string;
  storagePrefix?: string;
  completionPrefix?: string;
  lockDailyCompletion?: boolean;
};
type Attempt = string;
type DoodlePuzzle = {
  puzzleId: string;
  puzzleDate: string;
  archiveGameNumber?: number;
  answer: string;
  aliases?: string[];
  viewBox?: string;
  stageCount?: number;
  stages?: any[][];
};

const normalizeGuess = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
const normalizeAnswerKey = (value: string) => normalizeGuess(value).replace(/\s+/g, "");
const capitalizeFirstLetter = (value: string) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
};
const getSegmentKey = (segment: any, index: number) => segment.id || segment.fullD || segment.d || `segment-${index}`;
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
const DRAW_STAGGER_MS = 140;
const DRAW_DURATION_MS = 1750;
const WIN_REVEAL_STAGGER_MS = 45;
const WIN_REVEAL_DURATION_MS = 550;
const getStageRevealDurationMs = (segments: unknown[], staggerMs: number, durationMs: number) => {
  const segmentCount = (Array.isArray(segments) ? segments : [])
    .map((segment) => normalizeStageSegment(segment))
    .filter((segment) => Boolean(segment)).length;
  if (segmentCount <= 0) {
    return 150;
  }
  return Math.max(150, (segmentCount - 1) * staggerMs + durationMs + 120);
};
const isBlackTone = (value: string) => {
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
const normalizeDoodleColor = (value: string, fallback = "none") => {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }
  if (isBlackTone(value)) {
    return "var(--brand-strong)";
  }
  return value;
};
const normalizeStageSegment = (segment: any) => {
  const emptySegment = {
    id: undefined,
    d: "",
    to: 1,
    style: {
      fill: "none",
      stroke: "none",
      strokeWidth: "0",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      opacity: "0",
      fillOpacity: "0",
      strokeOpacity: "0",
      fillRule: "evenodd",
    },
    fillOnly: false,
    complete: false,
    fullD: undefined,
  };
  if (typeof segment === "string") {
    return {
      ...emptySegment,
      d: segment,
      to: 1,
      style: {
        ...emptySegment.style,
        stroke: "var(--brand-strong)",
        strokeWidth: "8",
        strokeOpacity: "1",
        opacity: "1",
      },
    };
  }

  if (!segment || typeof segment !== "object" || typeof segment.d !== "string") {
    return emptySegment;
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
  archiveHref = "/doodle/archive",
  storagePrefix = "doodle:v1:today",
  completionPrefix = "doodle:v1:completed",
  lockDailyCompletion = true,
}: DoodleGameClientProps) {
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
  const [puzzle, setPuzzle] = useState<DoodlePuzzle | null>(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [gameState, setGameState] = useState("playing");
  const [message, setMessage] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [winRevealStage, setWinRevealStage] = useState<number | null>(null);
  const [shouldAnimateWinReveal, setShouldAnimateWinReveal] = useState(false);
  const [isWinRevealAnimating, setIsWinRevealAnimating] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [nextGameCountdown, setNextGameCountdown] = useState("");
  const [archiveLock, setArchiveLock] = useState<{ title: string; description: string } | null>(null);
  const contextChipLabel = isArchiveView
    ? `ARCHIVE GAME #${puzzle?.archiveGameNumber ?? ""}`.trim()
    : "TODAY'S GAME";

  useEffect(() => {
    let active = true;

    const loadPuzzle = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(apiUrl, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 423) {
          if (active) {
            setPuzzle(null);
            setArchiveLock({
              title: typeof payload.lockTitle === "string" ? payload.lockTitle : "Archive Game #1 is locked",
              description: typeof payload.lockDescription === "string" ? payload.lockDescription : "Enter the shared password to open this retired archive game.",
            });
            setError("");
          }
          return;
        }

        if (!response.ok) {
          if (response.status === 404) {
            if (active) {
              setPuzzle(null);
              setArchiveLock(null);
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
        setArchiveLock(null);
        setGuess("");
        setAttempts([]);
        setGameState("playing");
        setMessage("");
        setIsResultOpen(false);
        setIsHowToPlayOpen(false);
        setWinRevealStage(null);
        setShouldAnimateWinReveal(false);
        setIsWinRevealAnimating(false);
        setCopyStatus("");
      } catch (loadError) {
        if (!active) {
          return;
        }
        setArchiveLock(null);
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
      setShouldAnimateWinReveal(false);
      setIsWinRevealAnimating(false);
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
      setShouldAnimateWinReveal(false);
      setIsWinRevealAnimating(false);
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

  const maxGuesses = Number.isFinite(puzzle?.stageCount) && (puzzle?.stageCount ?? 0) > 0 ? (puzzle?.stageCount ?? 5) : 5;
  const stageList: any[][] = Array.isArray(puzzle?.stages) ? (puzzle?.stages ?? []) : [];
  const answerText = puzzle?.answer || "Unknown";
  const finalRevealStage = Math.max(1, stageList.length > 0 ? stageList.length : maxGuesses);
  const baseRevealedStages = Math.min(finalRevealStage, attempts.length + 1);
  const revealedStages = gameState === "won"
    ? (shouldAnimateWinReveal ? (winRevealStage ?? baseRevealedStages) : finalRevealStage)
    : baseRevealedStages;
  const activeStageSegments = Array.isArray(stageList[revealedStages - 1])
    ? stageList[revealedStages - 1]
    : [];
  const previousStageSegments = Array.isArray(stageList[revealedStages - 2])
    ? stageList[revealedStages - 2]
    : [];
  const finalStageSegments = Array.isArray(stageList[finalRevealStage - 1])
    ? stageList[finalRevealStage - 1]
    : [];
  const isWinRevealInProgress = isWinRevealAnimating;
  const activeDrawStaggerMs = isWinRevealInProgress ? WIN_REVEAL_STAGGER_MS : DRAW_STAGGER_MS;
  const activeDrawDurationMs = isWinRevealInProgress ? WIN_REVEAL_DURATION_MS : DRAW_DURATION_MS;
  const shouldAnimateCanvas = gameState === "playing" || isWinRevealInProgress;

  useEffect(() => {
    if (gameState === "playing") {
      setWinRevealStage(null);
      setShouldAnimateWinReveal(false);
      setIsWinRevealAnimating(false);
      setIsResultOpen(false);
      return;
    }

    if (gameState === "lost") {
      setWinRevealStage(null);
      setShouldAnimateWinReveal(false);
      setIsWinRevealAnimating(false);
      setIsResultOpen(true);
      return;
    }

    if (!shouldAnimateWinReveal) {
      setWinRevealStage(finalRevealStage);
      setIsWinRevealAnimating(false);
      setIsResultOpen(true);
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;
    const initialStage = Math.min(finalRevealStage, Math.max(1, attempts.length + 1));
    setIsResultOpen(false);
    setIsWinRevealAnimating(true);

    const revealNextStage = (stage: number) => {
      if (cancelled) {
        return;
      }
      setWinRevealStage(stage);
      const stageSegments: unknown[] = Array.isArray(stageList[stage - 1]) ? (stageList[stage - 1] as unknown[]) : [];
      const revealDelayMs = getStageRevealDurationMs(
        stageSegments,
        WIN_REVEAL_STAGGER_MS,
        WIN_REVEAL_DURATION_MS,
      );

      if (stage >= finalRevealStage) {
        timeoutId = window.setTimeout(() => {
          if (!cancelled) {
            setIsWinRevealAnimating(false);
            setShouldAnimateWinReveal(false);
            setIsResultOpen(true);
          }
        }, revealDelayMs);
        return;
      }

      timeoutId = window.setTimeout(() => revealNextStage(stage + 1), revealDelayMs);
    };

    revealNextStage(initialStage);

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      setIsWinRevealAnimating(false);
    };
  }, [attempts.length, finalRevealStage, gameState, shouldAnimateWinReveal, stageList]);

  useEffect(() => {
    if (!lockDailyCompletion || isArchiveView || gameState === "playing") {
      setNextGameCountdown("");
      return;
    }
    setNextGameCountdown(getNextGameCountdown());
    const intervalId = window.setInterval(() => setNextGameCountdown(getNextGameCountdown()), 1000);
    return () => window.clearInterval(intervalId);
  }, [gameState, isArchiveView, lockDailyCompletion]);
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
  const canonicalAnswer = normalizeAnswerKey(puzzle?.answer || "");
  const canonicalAliases = answerAliases.map((alias) => normalizeAnswerKey(alias));
  const isCorrectAttempt = (attempt: string) => {
    if (!attempt) {
      return false;
    }
    const canonicalAttempt = normalizeAnswerKey(attempt);
    return canonicalAttempt === canonicalAnswer || canonicalAliases.includes(canonicalAttempt);
  };
  const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : "";
  const latestAttemptCorrect = isCorrectAttempt(latestAttempt);
  const earlierAttempts = attempts.slice(0, -1).reverse();

  if (loading) {
    return (
      <div className="doodle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <section className="card legal-card">
            <h1 className="page-title"><LoadingLabel text="Loading puzzle" /></h1>
          </section>
        </main>
      </div>
    );
  }

  if (archiveLock) {
    return (
      <div className="doodle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <ArchiveLockGate archiveHref={archiveHref} title={archiveLock.title} description={archiveLock.description} />
        </main>
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="doodle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <DailydabbleUnavailable title="Doodle unavailable" message={error || "No puzzle available right now."} />
        </main>
      </div>
    );
  }

  const submitGuess = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (gameState !== "playing") {
      return;
    }

    const normalized = normalizeGuess(guess);
    if (!normalized) {
      setMessage("Enter a guess first.");
      return;
    }

    const isCorrect = isCorrectAttempt(normalized);
    const nextAttempts = [...attempts, normalized];
    setAttempts(nextAttempts);

    if (isCorrect) {
      const finalMessage = `Nice! The doodle is a ${answerText}.`;
      setShouldAnimateWinReveal(true);
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
      const finalMessage = `Out of guesses. The doodle was ${answerText}.`;
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
    setShouldAnimateWinReveal(false);
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
    setWinRevealStage(null);
    setShouldAnimateWinReveal(false);
    setIsWinRevealAnimating(false);
    setCopyStatus("");
  };

  const shareText = [
    `Doodle ${isArchiveView ? `(Archive ${puzzle?.puzzleDate || ""})` : `(Today ${puzzle?.puzzleDate || ""})`}`.trim(),
    `${attempts.length}/${maxGuesses} tries`,
    `Answer: ${answerText}`,
    toPublicAppUrl("/doodle"),
  ].join("\n");
  const performanceLabel = getPerformanceLabel(gameState === "won", attempts.length, maxGuesses);
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
    <div className="doodle-shell">
      <MainNav label={navLabel} hideToday={hideToday} />

      <main className="container">
        <section className="card doodle-card">
          <div className="game-meta-row">
            <span className="chip">{contextChipLabel}</span>
            <span className="chip">Guesses {attempts.length}/{maxGuesses}</span>
            <button className="how-to-play-btn" type="button" onClick={() => setIsHowToPlayOpen(true)}>
              ? How to play
            </button>
          </div>

          <div className="doodle-stage-wrap">
            <svg className="doodle-canvas" viewBox={puzzle?.viewBox || "0 0 340 340"} role="img" aria-label="Doodle clue drawing">
              {activeStageSegments
                .map((segment, pathIndex) => ({ segment: normalizeStageSegment(segment), pathIndex }))
                .filter((entry) => Boolean(entry.segment))
                .map(({ segment, pathIndex }) => {
                  if (!shouldAnimateCanvas) {
                    return (
                      <path
                        key={`path-static-final-${getSegmentKey(segment, pathIndex)}`}
                        d={segment.d}
                        fill={segment.style.fill}
                        fillRule={(segment.style.fillRule || "evenodd") as any}
                        stroke={segment.style.stroke}
                        strokeWidth={segment.style.strokeWidth}
                        strokeLinecap={segment.style.strokeLinecap as any}
                        strokeLinejoin={segment.style.strokeLinejoin as any}
                        opacity={segment.style.opacity}
                        fillOpacity={segment.style.fillOpacity}
                        strokeOpacity={segment.style.strokeOpacity}
                      />
                    );
                  }

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
                  const drawStrokeLinecap = (isFillOnly ? "round" : segment.style.strokeLinecap) as any;
                  const drawStrokeLinejoin = (isFillOnly ? "round" : segment.style.strokeLinejoin) as any;
                  const drawFillRule = (segment.style.fillRule || "evenodd") as any;
                  const fullD = segment.fullD || segment.d;
                  const safeMaskKey = String(segmentKey).replace(/[^a-zA-Z0-9_-]/g, "_");
                  const baseMaskId = `doodle-mask-${safeMaskKey}`;
                  const animateMaskId = `doodle-mask-anim-${safeMaskKey}-${revealedStages}`;

                  const renderFillMasked = (maskPath: string, maskId: string, animate = false) => (
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
                                    animationDelay: `${pathIndex * activeDrawStaggerMs}ms`,
                                    animationDuration: `${activeDrawDurationMs}ms`,
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
                                animationDelay: `${pathIndex * activeDrawStaggerMs}ms`,
                                animationDuration: `${activeDrawDurationMs}ms`,
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
                            animationDelay: `${pathIndex * activeDrawStaggerMs}ms`,
                            animationDuration: `${activeDrawDurationMs}ms`,
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
                        animationDelay: `${pathIndex * activeDrawStaggerMs}ms`,
                        animationDuration: `${activeDrawDurationMs}ms`,
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
              <button
                className="guess-submit-btn"
                type="button"
                onClick={() => {
                  if (isWinRevealInProgress) {
                    return;
                  }
                  setIsResultOpen(true);
                }}
                disabled={isWinRevealInProgress}
              >
                {isWinRevealInProgress ? "Drawing..." : "Review result"}
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
            <p className="result-modal-copy result-modal-subtitle">{performanceLabel}</p>
            <p className="result-modal-answer">{capitalizeFirstLetter(answerText)}</p>
            {finalStageSegments.length > 0 ? (
              <div className="result-modal-doodle-wrap">
                <svg className="result-modal-doodle" viewBox={puzzle?.viewBox || "0 0 340 340"} role="img" aria-label="Solved doodle">
                  {finalStageSegments
                    .map((segment, index) => ({ segment: normalizeStageSegment(segment), index }))
                    .filter((entry) => Boolean(entry.segment))
                    .map(({ segment, index }) => (
                      <path
                        key={`result-${index}`}
                        d={segment.d}
                        fill={segment.style.fill}
                        fillRule={(segment.style.fillRule || "evenodd") as any}
                        stroke={segment.style.stroke}
                        strokeWidth={segment.style.strokeWidth}
                        strokeLinecap={segment.style.strokeLinecap as any}
                        strokeLinejoin={segment.style.strokeLinejoin as any}
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
              <a className="admin-btn-like" href="/">DailyDabble</a>
              <a className="admin-btn-like primary" href={archiveHref}>Play Archive Games</a>
            </div>
            {copyStatus ? <p className="result-modal-copy">{copyStatus}</p> : null}
          </section>
        </div>
      ) : null}

      {isHowToPlayOpen ? (
        <HowToPlayDialog
          title="How to play Doodle"
          subtitle="Guess the doodle as it is drawn."
          steps={[
            "Watch the drawing reveal one stage at a time.",
            "Type what you think the doodle is.",
            "Each wrong guess reveals more of the drawing.",
            `Guess the doodle in ${maxGuesses} guesses.`,
          ]}
          buttonClassName="admin-btn-like primary"
          onClose={() => setIsHowToPlayOpen(false)}
        />
      ) : null}
    </div>
  );
}
