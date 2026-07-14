"use client";

import { trackGameStarted } from "../../../lib/analytics-client";

import { DailydabbleNav, DailydabbleUnavailable } from "@dailydabble/ui";
import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import AccountNav from "../../components/AccountNav";
import GameMenu from "../../components/GameMenu";
import { toPublicAppUrl } from "@/lib/app-url";
import { recordGameCompletionQuietly } from "@/lib/record-game-completion";
import { buildResultPayload } from "@/lib/result-payload";
import { buildGameShareText, shareResultText } from "@/lib/share-results";
import { useNextGameCountdown } from "@/lib/use-next-game-countdown";
import AsyncImage from "../../components/AsyncImage";
import ArchiveLockGate from "../../components/ArchiveLockGate";
import HowToPlayDialog from "../../components/HowToPlayDialog";
import LoadingLabel from "../../components/LoadingLabel";
import ResultDialogActions from "../../components/ResultDialogActions";
import GuessProgressChip from "../../components/GuessProgressChip";
import useHowToPlayDialog from "../../components/useHowToPlayDialog";
import EditorialDrawer from "./EditorialDrawer";
import type { PuzzleAnswer, PuzzlePersonPublic, PuzzlePublic, RoundGuessFeedback } from "@/lib/agegaple/types";
import { fetchStoredGameResult, getResultPayloadAnswer, getResultPayloadAttempts } from "@/lib/stored-game-result";

const completionStoragePrefix = "agegaple:v6:completed:";
const progressStoragePrefix = "agegaple:v6:progress:";
const maxGuesses = 6;

type AgegapleGameClientProps = {
  apiUrl?: string;
  archiveHref?: string;
  completionPrefix?: string;
  storagePrefix?: string;
  lockDailyCompletion?: boolean;
};

type StoredCompletion = {
  puzzleId: string;
  guess: string;
  result: PuzzleAnswer;
  fingerprint: string;
  attempts: RoundGuessFeedback[];
};

type StoredProgress = {
  puzzleId: string;
  guess: string;
  attempts: RoundGuessFeedback[];
};

type RestoredGameState = StoredProgress & {
  result: PuzzleAnswer | null;
  isCompleted: boolean;
  isResultOpen: boolean;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const getPuzzleFingerprint = (puzzle: PuzzlePublic) =>
  `${puzzle.puzzleDate}|${puzzle.personA.name}|${puzzle.personA.imageUrl}|${puzzle.personB.name}|${puzzle.personB.imageUrl}`;

const getDefaultRestoredState = (puzzleId = ""): RestoredGameState => ({
  puzzleId,
  guess: "10",
  attempts: [],
  result: null,
  isCompleted: false,
  isResultOpen: false,
});

const isPuzzleAnswer = (value: unknown): value is PuzzleAnswer => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const answer = value as Partial<PuzzleAnswer>;
  return typeof answer.puzzleId === "string"
    && typeof answer.guessYears === "number"
    && typeof answer.isCorrect === "boolean";
};

const restoreAgegapleState = ({
  puzzle,
  completionPrefix,
  storagePrefix,
  lockDailyCompletion,
}: {
  puzzle: PuzzlePublic;
  completionPrefix: string;
  storagePrefix: string;
  lockDailyCompletion: boolean;
}): RestoredGameState => {
  const completionKey = `${completionPrefix}${puzzle.puzzleId}`;
  const progressKey = `${storagePrefix}${puzzle.puzzleId}`;
  const completionRaw = lockDailyCompletion ? window.localStorage.getItem(completionKey) : null;

  if (completionRaw) {
    try {
      const parsed = JSON.parse(completionRaw) as StoredCompletion;
      if (parsed.puzzleId === puzzle.puzzleId && parsed.fingerprint === getPuzzleFingerprint(puzzle) && parsed.result) {
        return {
          ...getDefaultRestoredState(puzzle.puzzleId),
          guess: parsed.guess || String(parsed.result.guessYears),
          attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
          result: parsed.result,
          isCompleted: true,
          isResultOpen: true,
        };
      }
      window.localStorage.removeItem(completionKey);
    } catch {
      window.localStorage.removeItem(completionKey);
    }
  }

  const progressRaw = window.localStorage.getItem(progressKey);
  if (!progressRaw) return getDefaultRestoredState(puzzle.puzzleId);

  try {
    const parsed = JSON.parse(progressRaw) as StoredProgress;
    if (parsed.puzzleId !== puzzle.puzzleId) {
      window.localStorage.removeItem(progressKey);
      return getDefaultRestoredState(puzzle.puzzleId);
    }
    return {
      puzzleId: puzzle.puzzleId,
      guess: parsed.guess || "10",
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      result: null,
      isCompleted: false,
      isResultOpen: false,
    };
  } catch {
    window.localStorage.removeItem(progressKey);
    return getDefaultRestoredState(puzzle.puzzleId);
  }
};

const getHeatLabel = (distanceYears: number) => {
  if (distanceYears <= 1) return "Very warm 🔥";
  if (distanceYears <= 3) return "Warm ☀️";
  if (distanceYears <= 7) return "Cold 🧊";
  return "Very cold 🥶";
};

const getPerformanceLabel = (didWin: boolean, attemptsUsed: number) => {
  if (!didWin) return "Better luck next time.";
  if (attemptsUsed <= 1) return "Amazing!";
  if (attemptsUsed === 2) return "Nice!";
  if (attemptsUsed === 3) return "Great!";
  if (attemptsUsed === 4) return "Good!";
  if (attemptsUsed === 5) return "Not bad!";
  return "Phew, close!";
};

function FitOneLineText({
  text,
  className = "agegaple-person-header",
  maxFontSize = 16,
  minFontSize = 5,
}: {
  text: string;
  className?: string;
  maxFontSize?: number;
  minFontSize?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);
  const [scaleX, setScaleX] = useState(1);
  const fit = useCallback(() => {
    const container = containerRef.current;
    const textElement = textRef.current;
    if (!container || !textElement) return;

    const styles = window.getComputedStyle(container);
    const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const availableWidth = Math.max(0, container.clientWidth - horizontalPadding);
    if (availableWidth <= 0) return;

    const maxSize = maxFontSize;
    const minSize = minFontSize;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;

    const fontFamily = styles.fontFamily || '"Plus Jakarta Sans", "Manrope", sans-serif';
    const fontWeight = styles.fontWeight || "950";
    const measureAtSize = (size: number) => {
      context.font = `${fontWeight} ${size}px ${fontFamily}`;
      return context.measureText(text).width;
    };

    const maxWidth = measureAtSize(maxSize);
    if (maxWidth <= availableWidth) {
      setFontSize(maxSize);
      setScaleX(1);
      return;
    }

    const nextSize = Math.max(minSize, Math.min(maxSize, (availableWidth / maxWidth) * maxSize));
    const fittedWidth = measureAtSize(nextSize);
    setFontSize(Math.floor(nextSize * 10) / 10);
    setScaleX(fittedWidth > availableWidth ? Math.max(0.48, availableWidth / fittedWidth) : 1);
  }, [maxFontSize, minFontSize, text]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textElement = textRef.current;
    if (!container || !textElement) return;

    const animationFrame = window.requestAnimationFrame(fit);
    const secondFrame = window.requestAnimationFrame(() => window.requestAnimationFrame(fit));
    const timeoutId = window.setTimeout(fit, 250);
    const intervalId = window.setInterval(fit, 150);
    const intervalStopId = window.setTimeout(() => window.clearInterval(intervalId), 1200);
    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(container);

    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    void document.fonts?.ready.then(fit);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      window.clearTimeout(intervalStopId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, [fit, text]);

  return (
    <div ref={containerRef} className={className}>
      <span ref={textRef} style={{ fontSize, transform: `scaleX(${scaleX})` }}>{text}</span>
    </div>
  );
}

function PersonCard({ person }: { person: PuzzlePersonPublic }) {
  return (
    <div className="agegaple-person-card">
      <FitOneLineText text={`${person.name} in ${person.photoYear}`} />
      <AsyncImage
        className="agegaple-person-image"
        src={person.imageUrl}
        alt={person.imageAlt}
        wrapperClassName="agegaple-person-image-frame flex w-full items-center justify-center"
        overlayClassName="bg-[color:var(--surface-container-lowest)]/80 text-[color:var(--primary-dim)]"
      />
    </div>
  );
}

function GapMeter({
  guessYears,
  correctYears,
  isOpen,
}: {
  guessYears: number;
  correctYears: number;
  isOpen: boolean;
}) {
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const raf = window.requestAnimationFrame(() => setAnimateIn(true));
    return () => window.cancelAnimationFrame(raf);
  }, [isOpen, guessYears, correctYears]);

  const rangeAnchor = Math.max(1, guessYears, correctYears);
  const maxYears = Math.max(10, Math.ceil((rangeAnchor * 1.35) / 10) * 10);
  const guessPercent = clampPercent((guessYears / maxYears) * 100);
  const correctPercent = clampPercent((correctYears / maxYears) * 100);
  const guessRendered = animateIn ? guessPercent : 0;
  const correctRendered = animateIn ? correctPercent : 0;
  const minRendered = Math.min(guessRendered, correctRendered);
  const maxRendered = Math.max(guessRendered, correctRendered);
  const labelVisibilityClass = animateIn ? "opacity-100" : "opacity-0";

  return (
    <div className="rounded-xl border border-[color:var(--surface-container)] bg-[color:var(--surface-container-low)] p-2.5">
      <div className="relative h-22">
        <div className="absolute left-0 right-0 top-12 h-1.5 rounded-full bg-[color:var(--surface-container)]" />
        <div
          className="absolute top-12 h-1.5 rounded-full bg-[color:var(--primary-container)] transition-all duration-700 ease-out"
          style={{ left: `${minRendered}%`, width: `${Math.max(0, maxRendered - minRendered)}%` }}
        />
        <div
          className={`absolute top-[52px] -translate-x-1/2 transition-opacity delay-700 duration-300 ${labelVisibilityClass}`}
          style={{ left: `${guessPercent}%` }}
        >
          <div className="mx-auto h-2 w-px bg-[color:var(--outline-variant)]" />
          <div className="rounded-md border border-[color:var(--outline-variant)] bg-[color:var(--surface-container-high)] px-2 py-1 text-xs font-semibold text-[color:var(--foreground)]">
            Your guess: {guessYears}y
          </div>
        </div>
        <div
          className={`absolute top-[16px] -translate-x-1/2 transition-opacity delay-700 duration-300 ${labelVisibilityClass}`}
          style={{ left: `${correctPercent}%` }}
        >
          <div className="rounded-md border border-[color:var(--primary-container)] bg-[color:var(--primary-container)] px-2 py-1 text-xs font-semibold text-[color:var(--primary-dim)]">
            Correct: {correctYears}y
          </div>
          <div className="mx-auto h-1 w-px bg-[color:var(--primary-container)]" />
        </div>
        <div
          className="absolute top-[46px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[color:var(--primary-dim)] shadow transition-all duration-700 ease-out"
          style={{ left: `${guessRendered}%` }}
        />
        <div
          className="absolute top-[46px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[color:var(--primary)] shadow transition-all duration-700 ease-out"
          style={{ left: `${correctRendered}%` }}
        />
      </div>
      <div className="mt-0.5 flex items-center justify-between text-[10px] font-semibold text-[color:var(--outline)]">
        <span>0y</span>
        <span>{maxYears}y</span>
      </div>
    </div>
  );
}

export default function AgegapleGameClient({
  apiUrl = "/api/agegaple/puzzle/today",
  archiveHref = "/agegaple/archive",
  completionPrefix = completionStoragePrefix,
  storagePrefix = progressStoragePrefix,
  lockDailyCompletion = true,
}: AgegapleGameClientProps) {
  const isArchiveView = !lockDailyCompletion;
  const [puzzle, setPuzzle] = useState<PuzzlePublic | null>(null);
  const [guess, setGuess] = useState("10");
  const [attempts, setAttempts] = useState<RoundGuessFeedback[]>([]);
  const [result, setResult] = useState<PuzzleAnswer | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveLock, setArchiveLock] = useState<{ title: string; description: string; mode?: "password" | "subscription" } | null>(null);
  const [loading, setLoading] = useState(true);
  const { isHowToPlayOpen, openHowToPlay, closeHowToPlay } = useHowToPlayDialog("agegaple", Boolean(puzzle) && !loading);
  const hasHydratedProgressRef = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(apiUrl, { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as PuzzlePublic & {
          error?: string;
          lockMode?: string;
          lockTitle?: string;
          lockDescription?: string;
        };

        if (response.status === 423) {
          if (!active) return;
          setPuzzle(null);
          setArchiveLock({
            title: typeof payload.lockTitle === "string" ? payload.lockTitle : "Archive Game #1 is locked",
            description: typeof payload.lockDescription === "string" ? payload.lockDescription : "Enter the shared password to open this retired archive game.",
            mode: payload.lockMode === "subscription" ? "subscription" : "password",
          });
          setError(null);
          return;
        }

        if (!response.ok) {
          if (response.status === 404) {
            if (!active) return;
            setPuzzle(null);
            setArchiveLock(null);
            setError(null);
            return;
          }
          throw new Error(payload.error || "Failed to load puzzle");
        }

        if (!active) return;
        const completionKey = `${completionPrefix}${payload.puzzleId}`;
        if (lockDailyCompletion) {
          const storedResult = await fetchStoredGameResult({
            gameSlug: "agegaple",
            puzzleId: payload.puzzleId,
            puzzleDate: payload.puzzleDate,
            isArchive: false,
          });
          if (!active) return;

          if (storedResult) {
            const localState = storedResult.resultPayload.localState;
            const storedLocalCompletion = localState && typeof localState === "object" && !Array.isArray(localState)
              ? localState as Partial<StoredCompletion>
              : null;
            const resultPayloadAnswer = getResultPayloadAnswer(storedResult);
            const storedAnswer = isPuzzleAnswer(storedLocalCompletion?.result)
              ? storedLocalCompletion.result
              : isPuzzleAnswer(resultPayloadAnswer)
                ? resultPayloadAnswer
                : null;

            if (storedAnswer) {
              const storedAttempts = Array.isArray(storedLocalCompletion?.attempts)
                ? storedLocalCompletion.attempts
                : getResultPayloadAttempts(storedResult) as RoundGuessFeedback[];
              const completion: StoredCompletion = {
                puzzleId: payload.puzzleId,
                guess: storedLocalCompletion?.guess || String(storedAnswer.guessYears),
                result: storedAnswer,
                fingerprint: getPuzzleFingerprint(payload),
                attempts: storedAttempts,
              };
              window.localStorage.setItem(completionKey, JSON.stringify(completion));
            }
          }
        }

        const restoredState = restoreAgegapleState({ puzzle: payload, completionPrefix, storagePrefix, lockDailyCompletion });
        setArchiveLock(null);
        setPuzzle(payload);
        setGuess(restoredState.guess);
        setAttempts(restoredState.attempts);
        setResult(restoredState.result);
        setIsCompleted(restoredState.isCompleted);
        setIsResultOpen(restoredState.isResultOpen);
        setCopyStatus("");
        hasHydratedProgressRef.current = true;
      } catch (loadError) {
        if (!active) return;
        setArchiveLock(null);
        setError(loadError instanceof Error ? loadError.message : "Could not load puzzle.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [apiUrl, completionPrefix, lockDailyCompletion, storagePrefix]);

  useEffect(() => {
    if (!puzzle || !hasHydratedProgressRef.current) return;
    const progressKey = `${storagePrefix}${puzzle.puzzleId}`;
    if (isCompleted) {
      window.localStorage.removeItem(progressKey);
      return;
    }
    const payload: StoredProgress = {
      puzzleId: puzzle.puzzleId,
      guess,
      attempts,
    };
    window.localStorage.setItem(progressKey, JSON.stringify(payload));
  }, [attempts, guess, isCompleted, puzzle, storagePrefix]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsResultOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const title = useMemo(() => (puzzle ? `${puzzle.personAName} + ${puzzle.personBName}` : "Agegaple"), [puzzle]);
  const formatExactGap = (exactYears: number) => {
    const daysPerYear = 365.2425;
    let years = Math.floor(exactYears);
    let days = Math.round((exactYears - years) * daysPerYear);

    if (days >= 365) {
      years += 1;
      days = 0;
    }

    const yearLabel = years === 1 ? "year" : "years";
    const dayLabel = days === 1 ? "day" : "days";
    if (years === 0) return `${days} ${dayLabel}`;
    return `${years} ${yearLabel}, ${days} ${dayLabel}`;
  };
  const latestAttempt = attempts[attempts.length - 1] ?? null;
  const earlierAttempts = attempts.slice(0, -1).reverse();
  const previousAttempt = attempts.length > 1 ? attempts[attempts.length - 2] : null;
  const hasFinishedAttempts = isCompleted || attempts.length >= maxGuesses;
  const nextGameCountdown = useNextGameCountdown(lockDailyCompletion && hasFinishedAttempts && !isArchiveView);
  const didWin = Boolean(latestAttempt?.gap.isCorrect || result?.isCorrect);
  const performanceLabel = getPerformanceLabel(didWin, attempts.length);
  const statusChipLabel = hasFinishedAttempts && lockDailyCompletion
    ? `Next game in ${nextGameCountdown || "--:--:--"}`
    : isArchiveView
      ? `ARCHIVE GAME #${puzzle?.archiveGameNumber ?? ""}`.trim()
      : "TODAY'S GAME";
  const hintHeat = latestAttempt && !latestAttempt.gap.isCorrect ? getHeatLabel(latestAttempt.gap.absErrorYears) : "";
  const hintTemperature = latestAttempt && previousAttempt && !latestAttempt.gap.isCorrect
    ? latestAttempt.gap.absErrorYears < previousAttempt.gap.absErrorYears
      ? "Warmer than your previous guess."
      : latestAttempt.gap.absErrorYears > previousAttempt.gap.absErrorYears
        ? "Colder than your previous guess."
        : "Same distance as your previous guess."
    : "";
  const shareBlocks = attempts.map((attempt) => {
    if (attempt.gap.absErrorYears <= 0.5) return "🟩";
    if (attempt.gap.absErrorYears <= 1) return "🟨";
    if (attempt.gap.absErrorYears <= 3) return "🟧";
    return "🟥";
  }).join("");
  const shareText = puzzle && result
    ? buildGameShareText({
        gameName: "Agegaple",
        isArchiveView,
        puzzleDate: puzzle.puzzleDate,
        didWin,
        guessesUsed: attempts.length,
        maxGuesses,
        visualRows: shareBlocks ? [shareBlocks] : [title],
        url: toPublicAppUrl("/agegaple"),
      })
    : "";

  const completeGame = ({ answer, nextAttempts }: { answer: PuzzleAnswer; nextAttempts: RoundGuessFeedback[] }) => {
    if (!puzzle) return;
    const completion: StoredCompletion = {
      puzzleId: puzzle.puzzleId,
      guess: String(answer.guessYears),
      result: answer,
      fingerprint: getPuzzleFingerprint(puzzle),
      attempts: nextAttempts,
    };
    setResult(answer);
    setIsCompleted(true);
    setIsResultOpen(true);
    recordGameCompletionQuietly({
      gameSlug: "agegaple",
      puzzleId: puzzle.puzzleId,
      puzzleDate: puzzle.puzzleDate,
      isArchive: isArchiveView,
      isWin: answer.isCorrect,
      guessesUsed: nextAttempts.length,
      maxGuesses,
      resultPayload: {
        ...buildResultPayload({
          attempts: nextAttempts,
          answer: { ...answer },
          final: {
            guessYears: answer.guessYears,
            absErrorYears: answer.absErrorYears,
            isCorrect: answer.isCorrect,
          },
          isWin: answer.isCorrect,
          guessesUsed: nextAttempts.length,
          maxGuesses,
        }),
        localState: completion,
      },
    });
    if (lockDailyCompletion) {
      window.localStorage.setItem(`${completionPrefix}${puzzle.puzzleId}`, JSON.stringify(completion));
    }
    window.localStorage.removeItem(`${storagePrefix}${puzzle.puzzleId}`);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!puzzle || hasFinishedAttempts) return;

    const numericGuess = Number(guess);
    if (!guess.trim() || !Number.isFinite(numericGuess)) {
      setError("Enter an age gap guess.");
      return;
    }

    trackGameStarted("agegaple", puzzle.puzzleDate, isArchiveView);

    setError(null);
    try {
      const response = await fetch("/api/agegaple/puzzle/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzleId: puzzle.puzzleId,
          guessType: "round",
          guessedAgeGap: numericGuess,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Submission failed");

      const round = payload as RoundGuessFeedback;
      const nextAttempts = [...attempts, round];
      setAttempts(nextAttempts);
      setCopyStatus("");

      if (round.gap.isCorrect || nextAttempts.length >= maxGuesses) {
        completeGame({ answer: round.gap, nextAttempts });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Submission failed");
    }
  };

  const handleShareResult = async () => {
    if (!shareText) return;
    const shareResult = await shareResultText("Agegaple", shareText);
    if (shareResult === "shared") setCopyStatus("Shared");
    if (shareResult === "copied") setCopyStatus("Copied to clipboard");
    if (shareResult === "failed") setCopyStatus("Share failed");
  };

  const mainClass = "min-h-screen text-[color:var(--foreground)]";
  const panelClass = "card border border-[color:var(--surface-container)] flex h-full min-h-0 flex-col gap-2 sm:gap-3";

  if (loading) {
    return (
      <div className="agegaple-shell">
        <main className={`${mainClass} flex flex-col`}>
          <DailydabbleNav
            subtitle="Agegaple"
            subtitleHref="/agegaple"
            subtitleAsHeading={!isArchiveView}
            homeHref="/"
            leftContent={<GameMenu todayHref="/agegaple" archiveHref={archiveHref} hideToday={!isArchiveView} />}
            rightContent={<AccountNav />}
          />
          <div className="container flex flex-1 min-h-0 flex-col gap-3 sm:gap-4">
            <section className={panelClass}>
              <p className="page-title" role="status"><LoadingLabel text="Loading puzzle" /></p>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="agegaple-shell">
      <main className={`${mainClass} flex flex-col`}>
        <DailydabbleNav
          subtitle="Agegaple"
          subtitleHref="/agegaple"
          subtitleAsHeading={!isArchiveView}
          homeHref="/"
          leftContent={<GameMenu todayHref="/agegaple" archiveHref={archiveHref} hideToday={!isArchiveView} />}
          rightContent={<AccountNav />}
        />

        <div className="container flex flex-1 min-h-0 flex-col gap-3 sm:gap-4">
          {!loading && archiveLock ? (
            <ArchiveLockGate archiveHref={archiveHref} title={archiveLock.title} description={archiveLock.description} mode={archiveLock.mode} />
          ) : null}

          {!loading && !archiveLock && !puzzle && !error ? (
            <DailydabbleUnavailable title="Agegaple unavailable" message="No puzzle available right now." />
          ) : null}

          {!loading && !archiveLock && puzzle ? (
            <section className={panelClass}>
              <div className="agegaple-meta-row">
                <span className="chip">{statusChipLabel}</span>
                <GuessProgressChip used={attempts.length} total={maxGuesses} active={!hasFinishedAttempts} />
                <button className="how-to-play-btn" type="button" onClick={openHowToPlay}>
                  ? How to play
                </button>
              </div>

              <div className="agegaple-duo-grid">
                <PersonCard person={puzzle.personA} />
                <PersonCard person={puzzle.personB} />
              </div>

              {puzzle.relationshipTimeline ? (
                <FitOneLineText
                  text={puzzle.relationshipTimeline}
                  className="agegaple-relationship-timeline"
                  maxFontSize={14}
                  minFontSize={8}
                />
              ) : null}

              <EditorialDrawer
                context={puzzle.editorialContext}
                personAName={puzzle.personAName}
                personBName={puzzle.personBName}
                isDarkMode={false}
              />

              <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSubmit}>
                <label className="flex-1 text-sm font-semibold text-[color:var(--foreground)]">
                  Your guess (years)
                  <div className="mt-1 flex items-center gap-3">
                    <input
                      value={guess}
                      onChange={(event) => setGuess(event.target.value)}
                      type="range"
                      min={0}
                      max={80}
                      step={1}
                      disabled={hasFinishedAttempts}
                      aria-label="Guess age gap slider"
                      className="h-11 w-full accent-[color:var(--primary)]"
                    />
                    <input
                      value={guess}
                      onChange={(event) => setGuess(event.target.value)}
                      type="number"
                      min={0}
                      max={80}
                      disabled={hasFinishedAttempts}
                      className="agegaple-guess-input no-native-spinner h-11 w-24 rounded-full border border-[color:var(--surface-container)] bg-[color:var(--surface-container-lowest)] px-3 text-lg font-bold text-[color:var(--foreground)] outline-none transition"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setGuess(String(Math.max(0, Number(guess || 0) - 1)))}
                        disabled={hasFinishedAttempts}
                        aria-label="Decrease guess by 1"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--surface-container)] bg-[color:var(--surface-container-lowest)] text-lg font-black text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-container-high)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => setGuess(String(Math.min(80, Number(guess || 0) + 1)))}
                        disabled={hasFinishedAttempts}
                        aria-label="Increase guess by 1"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--surface-container)] bg-[color:var(--surface-container-lowest)] text-lg font-black text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-container-high)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </label>
                {hasFinishedAttempts ? (
                  <button type="button" onClick={() => setIsResultOpen(true)} className="guess-submit-btn">
                    Review result
                  </button>
                ) : (
                  <button type="submit" className="guess-submit-btn" disabled={hasFinishedAttempts}>
                    Guess
                  </button>
                )}
              </form>

              {!isCompleted && latestAttempt && !latestAttempt.gap.isCorrect ? (
                <div className="temperature-hint-wrap">
                  <p className="temperature-hint-heat">{hintHeat}</p>
                  {hintTemperature ? <p className="temperature-hint-trend">{hintTemperature}</p> : null}
                </div>
              ) : null}

              {attempts.length > 0 ? (
                <div className="guess-history-wrap">
                  <button
                    type="button"
                    className="guess-history-toggle"
                    aria-expanded={isHistoryOpen}
                    aria-controls="agegaple-guess-history-panel"
                    onClick={() => setIsHistoryOpen((value) => !value)}
                  >
                    <span className="guess-history-title">Guess History</span>
                    <span className={`guess-history-toggle-icon ${isHistoryOpen ? "rotate-180" : ""}`} aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M6 14 12 8l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                  {latestAttempt ? (
                    <div className="guess-history-latest">
                      <span className="guess-history-guess">{latestAttempt.gap.guessYears} years</span>
                      {latestAttempt.gap.isCorrect ? (
                        <strong className="guess-history-status-correct">Correct</strong>
                      ) : (
                        <strong className="guess-history-status-wrong">Wrong</strong>
                      )}
                    </div>
                  ) : null}
                  {isHistoryOpen && earlierAttempts.length > 0 ? (
                    <ul id="agegaple-guess-history-panel" className="guess-history-list">
                      {earlierAttempts.map((attempt, index) => (
                        <li key={`${attempt.gap.guessYears}-${index}`} className="guess-history-item">
                          <span className="guess-history-guess">{attempt.gap.guessYears} years</span>
                          {attempt.gap.isCorrect ? (
                            <strong className="guess-history-status-correct">Correct</strong>
                          ) : (
                            <strong className="guess-history-status-wrong">Wrong</strong>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}
        </div>

        {isHowToPlayOpen ? (
          <HowToPlayDialog
            game="agegaple"
            maxGuesses={maxGuesses}
            preview={{ people: puzzle ? [puzzle.personA, puzzle.personB] : undefined }}
            onClose={closeHowToPlay}
          />
        ) : null}

        {puzzle && result && isResultOpen ? (
          <div
            className="result-modal-backdrop"
            onClick={() => setIsResultOpen(false)}
          >
            <div
              className="result-modal-panel"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Agegaple result"
            >
              <button type="button" onClick={() => setIsResultOpen(false)} aria-label="Close result dialog" className="result-modal-close">
                ×
              </button>
              <h3 className="result-modal-title">Result</h3>
              {lockDailyCompletion ? <p className="result-modal-timer">Next game in {nextGameCountdown || "--:--:--"}</p> : null}
              <div className="result-modal-summary">
                <p className="result-modal-copy result-modal-subtitle">{performanceLabel}</p>
                <p className="result-modal-copy result-modal-stat-line">
                  Guesses used: <strong>{attempts.length}/{maxGuesses}</strong>
                </p>
              </div>

              <div className="agegaple-result-grid">
                {[puzzle.personA, puzzle.personB].map((person) => (
                  <div key={person.key} className="agegaple-result-person">
                    <AsyncImage
                      src={person.imageUrl}
                      alt={person.imageAlt}
                      className="h-48 w-full rounded-lg border border-[color:var(--surface-container)] bg-[color:var(--surface-container-low)] object-contain"
                      overlayClassName="bg-[color:var(--surface-container-low)]/88 text-[color:var(--primary-dim)]"
                    />
                    <p>
                      <strong>{person.name}</strong> was{" "}
                      <strong>{person.key === "person_a" ? result.personAAgeInPhotoYear : result.personBAgeInPhotoYear}</strong> in {person.photoYear}.
                    </p>
                  </div>
                ))}
              </div>

              {puzzle.relationshipTimeline ? (
                <FitOneLineText
                  text={puzzle.relationshipTimeline}
                  className="agegaple-relationship-timeline"
                  maxFontSize={14}
                  minFontSize={8}
                />
              ) : null}

              <div className="agegaple-result-metrics">
                <p className="result-modal-copy">
                  {puzzle.personAName}: <strong>{result.personABirthDate}</strong>
                </p>
                <p className="result-modal-copy">
                  {puzzle.personBName}: <strong>{result.personBBirthDate}</strong>
                </p>
                <p className="result-modal-copy">
                  Exact gap: <strong>{formatExactGap(result.exactAgeGapYears)}</strong>
                </p>
              </div>

              <GapMeter guessYears={result.guessYears} correctYears={result.roundedAgeGapYears} isOpen={isResultOpen} />

              <p className="agegaple-result-attribution">Attribution: {result.attribution}</p>

              <ResultDialogActions currentGameSlug="agegaple" onShare={handleShareResult} />
              {copyStatus ? <p className="result-modal-copy">{copyStatus}</p> : null}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
