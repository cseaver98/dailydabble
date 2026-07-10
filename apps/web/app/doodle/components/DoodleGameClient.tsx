"use client";

import { useEffect, useMemo, useState } from "react";
import type { SVGProps } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import { toPublicAppUrl } from "../../../lib/app-url";
import { recordGameCompletionQuietly } from "../../../lib/record-game-completion";
import { buildResultPayload } from "../../../lib/result-payload";
import { buildGameShareText, shareResultText } from "../../../lib/share-results";
import { fetchStoredGameResult, getResultPayloadAnswer, getResultPayloadAttempts } from "../../../lib/stored-game-result";
import { useNextGameCountdown } from "../../../lib/use-next-game-countdown";
import ArchiveLockGate from "../../components/ArchiveLockGate";
import HowToPlayDialog from "../../components/HowToPlayDialog";
import LoadingLabel from "../../components/LoadingLabel";
import ResultDialogActions from "../../components/ResultDialogActions";
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
  stages?: DoodleStageSegmentInput[][];
};
type DoodleGameState = "playing" | "won" | "lost";
type DoodleStageSegmentInput =
  | string
  | {
      id?: unknown;
      d?: unknown;
      to?: unknown;
      style?: unknown;
      fillOnly?: unknown;
      complete?: unknown;
      fullD?: unknown;
    };
type DoodleSegmentStyle = {
  fill: string;
  stroke: string;
  strokeWidth: string;
  strokeLinecap: SVGProps<SVGPathElement>["strokeLinecap"];
  strokeLinejoin: SVGProps<SVGPathElement>["strokeLinejoin"];
  opacity: string;
  fillOpacity: string;
  strokeOpacity: string;
  fillRule: SVGProps<SVGPathElement>["fillRule"];
};
type NormalizedDoodleSegment = {
  id?: string;
  d: string;
  to: number;
  style: DoodleSegmentStyle;
  fillOnly?: boolean;
  complete?: boolean;
  fullD?: string;
};
type RestoredDoodleState = {
  guess: string;
  attempts: Attempt[];
  gameState: DoodleGameState;
  message: string;
};

const normalizeGuess = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
const normalizeAnswerKey = (value: string) => normalizeGuess(value).replace(/\s+/g, "");
const capitalizeFirstLetter = (value: string) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
};
const getSegmentKey = (segment: NormalizedDoodleSegment, index: number) => segment.id || segment.fullD || segment.d || `segment-${index}`;
const getDefaultRestoredDoodleState = (): RestoredDoodleState => ({
  guess: "",
  attempts: [],
  gameState: "playing",
  message: "",
});
const restoreDoodleState = ({
  puzzleId,
  storageKey,
  completionKey,
  lockDailyCompletion,
}: {
  puzzleId: string;
  storageKey: string;
  completionKey: string;
  lockDailyCompletion: boolean;
}): RestoredDoodleState => {
  if (lockDailyCompletion) {
    const completionRaw = window.localStorage.getItem(completionKey);
    if (completionRaw) {
      try {
        const parsed = JSON.parse(completionRaw);
        if (parsed?.puzzleId === puzzleId) {
          return {
            guess: typeof parsed.guess === "string" ? parsed.guess : "",
            attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
            gameState: parsed.gameState === "won" || parsed.gameState === "lost" ? parsed.gameState : "playing",
            message: typeof parsed.message === "string" ? parsed.message : "",
          };
        }
      } catch {
        window.localStorage.removeItem(completionKey);
      }
    }
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return getDefaultRestoredDoodleState();
  }

  try {
    const parsed = JSON.parse(raw);
    const savedState = parsed.gameState;
    if (!lockDailyCompletion && (savedState === "won" || savedState === "lost")) {
      window.localStorage.removeItem(storageKey);
      return getDefaultRestoredDoodleState();
    }

    return {
      guess: typeof parsed.guess === "string" ? parsed.guess : "",
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      gameState: savedState === "won" || savedState === "lost" || savedState === "playing" ? savedState : "playing",
      message: typeof parsed.message === "string" ? parsed.message : "",
    };
  } catch {
    window.localStorage.removeItem(storageKey);
    return getDefaultRestoredDoodleState();
  }
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
const getStringProperty = (source: Record<string, unknown>, key: string, fallback: string) =>
  typeof source[key] === "string" ? source[key] : fallback;

const normalizeStageSegment = (segment: unknown): NormalizedDoodleSegment => {
  const emptySegment: NormalizedDoodleSegment = {
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

  if (!segment || typeof segment !== "object") {
    return emptySegment;
  }

  const sourceSegment = segment as DoodleStageSegmentInput & Record<string, unknown>;
  if (typeof sourceSegment.d !== "string") {
    return emptySegment;
  }

  const to = Number(sourceSegment.to ?? 1);
  const safeTo = Number.isFinite(to) ? Math.max(0.001, Math.min(1, to)) : 1;
  const sourceStyle = sourceSegment.style && typeof sourceSegment.style === "object"
    ? (sourceSegment.style as Record<string, unknown>)
    : {};
  const normalizedStyle = {
    fill: normalizeDoodleColor(getStringProperty(sourceStyle, "fill", "none"), "none"),
    stroke: normalizeDoodleColor(getStringProperty(sourceStyle, "stroke", "var(--brand-strong)"), "var(--brand-strong)"),
    strokeWidth: getStringProperty(sourceStyle, "stroke-width", "8"),
    strokeLinecap: getStringProperty(sourceStyle, "stroke-linecap", "round") as DoodleSegmentStyle["strokeLinecap"],
    strokeLinejoin: getStringProperty(sourceStyle, "stroke-linejoin", "round") as DoodleSegmentStyle["strokeLinejoin"],
    opacity: getStringProperty(sourceStyle, "opacity", "1"),
    fillOpacity: getStringProperty(sourceStyle, "fill-opacity", "1"),
    strokeOpacity: getStringProperty(sourceStyle, "stroke-opacity", "1"),
    fillRule: getStringProperty(sourceStyle, "fill-rule", "evenodd") as DoodleSegmentStyle["fillRule"],
  } satisfies DoodleSegmentStyle;
  return {
    id: typeof sourceSegment.id === "string" ? sourceSegment.id : undefined,
    d: sourceSegment.d,
    to: safeTo,
    style: normalizedStyle,
    fillOnly: typeof sourceSegment.fillOnly === "boolean" ? sourceSegment.fillOnly : undefined,
    complete: typeof sourceSegment.complete === "boolean" ? sourceSegment.complete : undefined,
    fullD: typeof sourceSegment.fullD === "string" ? sourceSegment.fullD : undefined,
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
  const isArchiveView = apiUrl.includes("/by-date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState<DoodlePuzzle | null>(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [gameState, setGameState] = useState<DoodleGameState>("playing");
  const [message, setMessage] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [winRevealStage, setWinRevealStage] = useState<number | null>(null);
  const [shouldAnimateWinReveal, setShouldAnimateWinReveal] = useState(false);
  const [isWinRevealAnimating, setIsWinRevealAnimating] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [archiveLock, setArchiveLock] = useState<{ title: string; description: string; mode?: "password" | "subscription" } | null>(null);
  const contextChipLabel = isArchiveView
    ? `ARCHIVE GAME #${puzzle?.archiveGameNumber ?? ""}`.trim()
    : "TODAY'S GAME";
  const shouldShowNextGameCountdown = lockDailyCompletion && !isArchiveView && gameState !== "playing";
  const nextGameCountdown = useNextGameCountdown(shouldShowNextGameCountdown);
  const statusChipLabel = shouldShowNextGameCountdown
    ? `Next game in ${nextGameCountdown || "--:--:--"}`
    : contextChipLabel;

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
              mode: payload.lockMode === "subscription" ? "subscription" : "password",
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

        const storageKey = `${storagePrefix}:${payload.puzzleId}`;
        const completionKey = `${completionPrefix}:${payload.puzzleId}`;
        const storedResult = await fetchStoredGameResult({
          gameSlug: "doodle",
          puzzleId: payload.puzzleId,
          puzzleDate: payload.puzzleDate,
          isArchive: isArchiveView,
        });
        if (storedResult) {
          const answer = getResultPayloadAnswer(storedResult);
          const answerValue = typeof answer.value === "string" ? answer.value : payload.answer;
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: payload.puzzleId,
              guess: "",
              attempts: getResultPayloadAttempts(storedResult),
              gameState: storedResult.isWin ? "won" : "lost",
              message: storedResult.isWin ? `Nice! The doodle is a ${answerValue}.` : `Out of guesses. The doodle was ${answerValue}.`,
            }),
          );
        }

        const restoredState = restoreDoodleState({
          puzzleId: payload.puzzleId,
          storageKey,
          completionKey,
          lockDailyCompletion,
        });
        setPuzzle(payload);
        setArchiveLock(null);
        setGuess(restoredState.guess);
        setAttempts(restoredState.attempts);
        setGameState(restoredState.gameState);
        setMessage(restoredState.message);
        setIsResultOpen(restoredState.gameState !== "playing");
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
  }, [apiUrl, completionPrefix, lockDailyCompletion, storagePrefix]);

  const storageKey = useMemo(() => {
    if (!puzzle?.puzzleId) {
      return null;
    }
    return `${storagePrefix}:${puzzle.puzzleId}`;
  }, [puzzle, storagePrefix]);

  const completionKey = useMemo(() => {
    if (!puzzle?.puzzleId) {
      return null;
    }
    return `${completionPrefix}:${puzzle.puzzleId}`;
  }, [completionPrefix, puzzle]);

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
  const stageList = useMemo<DoodleStageSegmentInput[][]>(
    () => (Array.isArray(puzzle?.stages) ? (puzzle.stages ?? []) : []),
    [puzzle],
  );
  const answerText = puzzle?.answer || "Unknown";
  const finalRevealStage = Math.max(1, stageList.length > 0 ? stageList.length : maxGuesses);
  const baseRevealedStages = Math.min(finalRevealStage, attempts.length + 1);
  const revealedStages = gameState === "won"
    ? (shouldAnimateWinReveal ? (winRevealStage ?? baseRevealedStages) : finalRevealStage)
    : baseRevealedStages;
  const activeStageSegments = useMemo(
    () => (Array.isArray(stageList[revealedStages - 1]) ? stageList[revealedStages - 1] : []),
    [revealedStages, stageList],
  );
  const previousStageSegments = useMemo(
    () => (Array.isArray(stageList[revealedStages - 2]) ? stageList[revealedStages - 2] : []),
    [revealedStages, stageList],
  );
  const finalStageSegments = useMemo(
    () => (Array.isArray(stageList[finalRevealStage - 1]) ? stageList[finalRevealStage - 1] : []),
    [finalRevealStage, stageList],
  );
  const isWinRevealInProgress = isWinRevealAnimating;
  const activeDrawStaggerMs = isWinRevealInProgress ? WIN_REVEAL_STAGGER_MS : DRAW_STAGGER_MS;
  const activeDrawDurationMs = isWinRevealInProgress ? WIN_REVEAL_DURATION_MS : DRAW_DURATION_MS;
  const shouldAnimateCanvas = gameState === "playing" || isWinRevealInProgress;

  useEffect(() => {
    if (gameState === "playing") {
      const frameId = window.requestAnimationFrame(() => {
        setWinRevealStage(null);
        setShouldAnimateWinReveal(false);
        setIsWinRevealAnimating(false);
        setIsResultOpen(false);
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    if (gameState === "lost") {
      const frameId = window.requestAnimationFrame(() => {
        setWinRevealStage(null);
        setShouldAnimateWinReveal(false);
        setIsWinRevealAnimating(false);
        setIsResultOpen(true);
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    if (!shouldAnimateWinReveal) {
      const frameId = window.requestAnimationFrame(() => {
        setWinRevealStage(finalRevealStage);
        setIsWinRevealAnimating(false);
        setIsResultOpen(true);
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    let cancelled = false;
    let timeoutId: number | undefined;
    const initialStage = Math.min(finalRevealStage, Math.max(1, attempts.length + 1));
    const frameId = window.requestAnimationFrame(() => {
      setIsResultOpen(false);
      setIsWinRevealAnimating(true);
    });

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
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      setIsWinRevealAnimating(false);
    };
  }, [attempts.length, finalRevealStage, gameState, shouldAnimateWinReveal, stageList]);

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
          <ArchiveLockGate archiveHref={archiveHref} title={archiveLock.title} description={archiveLock.description} mode={archiveLock.mode} />
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
      recordGameCompletionQuietly({
        gameSlug: "doodle",
        puzzleId: puzzle.puzzleId,
        puzzleDate: puzzle.puzzleDate,
        isArchive: isArchiveView,
        isWin: true,
        guessesUsed: nextAttempts.length,
        maxGuesses,
        resultPayload: buildResultPayload({
          attempts: nextAttempts,
          answer: { value: answerText, aliases: puzzle.aliases ?? [] },
          final: { guess: normalized, isCorrect: true },
          isWin: true,
          guessesUsed: nextAttempts.length,
          maxGuesses,
        }),
      });
      if (completionKey && lockDailyCompletion) {
        window.localStorage.setItem(
          completionKey,
          JSON.stringify({
            puzzleId: puzzle.puzzleId,
            guess,
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
      recordGameCompletionQuietly({
        gameSlug: "doodle",
        puzzleId: puzzle.puzzleId,
        puzzleDate: puzzle.puzzleDate,
        isArchive: isArchiveView,
        isWin: false,
        guessesUsed: nextAttempts.length,
        maxGuesses,
        resultPayload: buildResultPayload({
          attempts: nextAttempts,
          answer: { value: answerText, aliases: puzzle.aliases ?? [] },
          final: { guess: normalized, isCorrect: false },
          isWin: false,
          guessesUsed: nextAttempts.length,
          maxGuesses,
        }),
      });
      if (completionKey && lockDailyCompletion) {
        window.localStorage.setItem(
          completionKey,
          JSON.stringify({
            puzzleId: puzzle.puzzleId,
            guess,
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

  const shareText = buildGameShareText({
    gameName: "Doodle",
    isArchiveView,
    puzzleDate: puzzle?.puzzleDate,
    didWin: gameState === "won",
    guessesUsed: attempts.length,
    maxGuesses,
    url: toPublicAppUrl("/doodle"),
  });
  const performanceLabel = getPerformanceLabel(gameState === "won", attempts.length, maxGuesses);
  const handleShareResult = async () => {
    const shareResult = await shareResultText("Doodle", shareText);
    if (shareResult === "shared") setCopyStatus("Shared");
    if (shareResult === "copied") setCopyStatus("Copied to clipboard");
    if (shareResult === "failed") setCopyStatus("Share failed");
  };

  return (
    <div className="doodle-shell">
      <MainNav label={navLabel} hideToday={hideToday} />

      <main className="container">
        <section className="card doodle-card">
          <div className="game-meta-row">
            <span className="chip">{statusChipLabel}</span>
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
                        fillRule={segment.style.fillRule || "evenodd"}
                        stroke={segment.style.stroke}
                        strokeWidth={segment.style.strokeWidth}
                        strokeLinecap={segment.style.strokeLinecap}
                        strokeLinejoin={segment.style.strokeLinejoin}
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
                  const drawStrokeLinecap: DoodleSegmentStyle["strokeLinecap"] = isFillOnly ? "round" : segment.style.strokeLinecap;
                  const drawStrokeLinejoin: DoodleSegmentStyle["strokeLinejoin"] = isFillOnly ? "round" : segment.style.strokeLinejoin;
                  const drawFillRule = segment.style.fillRule || "evenodd";
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
              placeholder="Guess the doodle"
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

          {gameState === "playing" ? (
            <p className="message" data-kind={gameState}>{message || "Start guessing to reveal the drawing."}</p>
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
            <div className="result-modal-summary">
              <p className="result-modal-copy result-modal-subtitle">{performanceLabel}</p>
              <p className="result-modal-copy result-modal-stat-line">
                Guesses used:{" "}
                <span className="result-modal-stat-value">{attempts.length}/{maxGuesses}</span>
              </p>
            </div>
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
            <p className="result-modal-answer">{capitalizeFirstLetter(answerText)}</p>
            <ResultDialogActions currentGameSlug="doodle" onShare={handleShareResult} />
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
