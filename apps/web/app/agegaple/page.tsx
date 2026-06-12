"use client";

import Link from "next/link";
import { DailydabbleMenu, DailydabbleNav, DailydabbleUnavailable } from "@dailydabble/ui";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toPublicAppUrl } from "@/lib/app-url";
import AsyncImage from "../components/AsyncImage";
import HowToPlayDialog from "../components/HowToPlayDialog";
import LoadingLabel from "../components/LoadingLabel";

import EditorialDrawer from "./components/EditorialDrawer";
import type { PuzzleAnswer, PuzzlePublic } from "@/lib/agegaple/types";

const completionStoragePrefix = "agegaple:v2:completed:";
const progressStoragePrefix = "agegaple:v1:progress:";
const maxGuesses = 5;

type GuessAttempt = {
  guessYears: number;
  absErrorYears: number;
  direction: "higher" | "lower" | "exact";
};

type StoredCompletion = {
  puzzleId: string;
  guess: string;
  result: PuzzleAnswer;
  fingerprint: string;
  attempts?: GuessAttempt[];
};

type StoredProgress = {
  puzzleId: string;
  guess: string;
  attempts: GuessAttempt[];
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
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

function GapMeter({
  guessYears,
  correctYears,
  isDarkMode,
  isOpen,
}: {
  guessYears: number;
  correctYears: number;
  isDarkMode: boolean;
  isOpen: boolean;
}) {
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

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

  const surfaceClass = isDarkMode ? "border-zinc-700 bg-zinc-800/40" : "border-[color:var(--surface-container)] bg-[color:var(--surface-container-low)]";
  const tickClass = isDarkMode ? "text-zinc-400" : "text-[color:var(--outline)]";

  return (
    <div className={`rounded-xl border p-2.5 ${surfaceClass}`}>
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
      <div className={`mt-0.5 flex items-center justify-between text-[10px] font-semibold ${tickClass}`}>
        <span>0y</span>
        <span>{maxYears}y</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [puzzle, setPuzzle] = useState<PuzzlePublic | null>(null);
  const [guess, setGuess] = useState("10");
  const [result, setResult] = useState<PuzzleAnswer | null>(null);
  const [attempts, setAttempts] = useState<GuessAttempt[]>([]);
  const [copyStatus, setCopyStatus] = useState("");
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isDarkMode = false;
  const [nextGameCountdown, setNextGameCountdown] = useState("");
  const hasHydratedProgressRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/agegaple/puzzle/today");
        if (!response.ok) {
          if (response.status === 404) {
            setPuzzle(null);
            setError(null);
            return;
          }
          throw new Error("Failed to load puzzle");
        }
        const data = (await response.json()) as PuzzlePublic;
        setPuzzle(data);
      } catch {
        setError("Could not load today’s puzzle.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (!puzzle) {
      return;
    }

    hasHydratedProgressRef.current = false;
    const storageKey = `${completionStoragePrefix}${puzzle.puzzleId}`;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      const progressRaw = window.localStorage.getItem(`${progressStoragePrefix}${puzzle.puzzleId}`);
      if (progressRaw) {
        try {
          const parsedProgress = JSON.parse(progressRaw) as StoredProgress;
          if (parsedProgress.puzzleId === puzzle.puzzleId) {
            setGuess(parsedProgress.guess || "10");
            setAttempts(Array.isArray(parsedProgress.attempts) ? parsedProgress.attempts : []);
          }
        } catch {
          window.localStorage.removeItem(`${progressStoragePrefix}${puzzle.puzzleId}`);
        }
      } else {
        setGuess("10");
        setAttempts([]);
      }
      setIsCompleted(false);
      setResult(null);
      setIsResultOpen(false);
      hasHydratedProgressRef.current = true;
      return;
    }

    try {
      const parsed = JSON.parse(raw) as StoredCompletion;
      const expectedFingerprint = getPuzzleFingerprint(puzzle);
      if (
        parsed.puzzleId !== puzzle.puzzleId ||
        !parsed.result ||
        parsed.fingerprint !== expectedFingerprint
      ) {
        window.localStorage.removeItem(storageKey);
        setIsCompleted(false);
        setResult(null);
        setAttempts([]);
        setIsResultOpen(false);
        return;
      }

      setGuess(parsed.guess);
      setResult(parsed.result);
      setAttempts(
        Array.isArray(parsed.attempts) && parsed.attempts.length
          ? parsed.attempts
          : [
              {
                guessYears: Number(parsed.guess),
                absErrorYears: parsed.result.absErrorYears,
                direction:
                  Number(parsed.guess) === parsed.result.roundedAgeGapYears
                    ? "exact"
                    : Number(parsed.guess) > parsed.result.roundedAgeGapYears
                      ? "higher"
                      : "lower",
              },
            ],
      );
      setIsCompleted(true);
      setIsResultOpen(true);
      hasHydratedProgressRef.current = true;
    } catch {
      setIsCompleted(false);
      setResult(null);
      setAttempts([]);
      setIsResultOpen(false);
      hasHydratedProgressRef.current = true;
    }
  }, [puzzle]);

  useEffect(() => {
    if (!puzzle || !hasHydratedProgressRef.current) {
      return;
    }

    const progressKey = `${progressStoragePrefix}${puzzle.puzzleId}`;
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
  }, [attempts, guess, isCompleted, puzzle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsResultOpen(false);
      }

      if (!puzzle) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTypingTarget) {
        return;
      }

    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCompleted, attempts, puzzle]);

  useEffect(() => {
    if (!result || !puzzle) {
      setNextGameCountdown("");
      return;
    }

    const getNextGameDate = () => {
      const base = new Date(`${puzzle.puzzleDate}T00:00:00`);
      base.setDate(base.getDate() + 1);
      return base;
    };

    const formatCountdown = (millisecondsLeft: number) => {
      const safeMs = Math.max(0, millisecondsLeft);
      const totalSeconds = Math.floor(safeMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    };

    const tick = () => {
      const nextGameAt = getNextGameDate().getTime();
      const now = Date.now();
      setNextGameCountdown(formatCountdown(nextGameAt - now));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [result, puzzle]);

  const title = useMemo(() => {
    if (!puzzle) {
      return "Agegaple";
    }
    return `${puzzle.personAName} + ${puzzle.personBName}`;
  }, [puzzle]);

  const getPuzzleFingerprint = (target: PuzzlePublic) =>
    `${target.puzzleDate}|${target.personAName}|${target.personBName}|${target.imageUrl}`;

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
    if (years === 0) {
      return `${days} ${dayLabel}`;
    }

    return `${years} ${yearLabel}, ${days} ${dayLabel}`;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!puzzle || isCompleted || attempts.length >= maxGuesses) {
      return;
    }

    setError(null);
    const numericGuess = Number(guess);

    try {
      const response = await fetch("/api/agegaple/puzzle/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzleId: puzzle.puzzleId,
          guessYears: numericGuess,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Submission failed");
      }

      const data = (await response.json()) as PuzzleAnswer;
      const attempt: GuessAttempt = {
        guessYears: numericGuess,
        absErrorYears: data.absErrorYears,
        direction:
          numericGuess === data.roundedAgeGapYears
            ? "exact"
            : numericGuess > data.roundedAgeGapYears
              ? "higher"
              : "lower",
      };

      const nextAttempts = [...attempts, attempt];
      setAttempts(nextAttempts);
      setCopyStatus("");

      const didWin = attempt.direction === "exact";
      const isFinalAttempt = nextAttempts.length >= maxGuesses;
      if (!didWin && !isFinalAttempt) {
        return;
      }

      setResult(data);
      setIsResultOpen(true);
      const completion: StoredCompletion = {
        puzzleId: puzzle.puzzleId,
        guess,
        result: data,
        fingerprint: getPuzzleFingerprint(puzzle),
        attempts: nextAttempts,
      };
      window.localStorage.setItem(`${completionStoragePrefix}${puzzle.puzzleId}`, JSON.stringify(completion));
      window.localStorage.removeItem(`${progressStoragePrefix}${puzzle.puzzleId}`);
      setIsCompleted(true);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Submission failed";
      setError(message);
    }
  };

  const activeImage = puzzle ? { imageUrl: puzzle.imageUrl, imageAlt: puzzle.imageAlt } : null;
  const lastAttempt = attempts[attempts.length - 1];
  const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const earlierAttempts = attempts.slice(0, -1).reverse();
  const previousAttempt = attempts.length > 1 ? attempts[attempts.length - 2] : null;
  const hasFinishedAttempts = isCompleted || attempts.length >= maxGuesses;
  const didWin = attempts[attempts.length - 1]?.direction === "exact";
  const performanceLabel = getPerformanceLabel(Boolean(didWin), attempts.length, maxGuesses);
  const hintHeat = lastAttempt
    ? lastAttempt.absErrorYears <= 1
      ? "Very warm 🔥"
      : lastAttempt.absErrorYears <= 3
        ? "Warm ☀️"
        : lastAttempt.absErrorYears <= 7
          ? "Cold 🧊"
          : "Very cold 🥶"
    : "";
  const hintTemperature = lastAttempt && previousAttempt
    ? lastAttempt.absErrorYears < previousAttempt.absErrorYears
      ? "Warmer than your previous guess."
      : lastAttempt.absErrorYears > previousAttempt.absErrorYears
        ? "Colder than your previous guess."
        : "Same distance as your previous guess."
    : "";
  const shareBlocks = attempts.map((attempt) => {
    if (attempt.absErrorYears <= 0.5) return "🟩";
    if (attempt.absErrorYears <= 1) return "🟨";
    if (attempt.absErrorYears <= 3) return "🟧";
    return "🟥";
  }).join("");
  const shareText = puzzle
    ? [
        `${puzzle.personAName} + ${puzzle.personBName}`,
        `${attempts.length}/${maxGuesses} tries`,
        shareBlocks,
        toPublicAppUrl("/agegaple"),
      ].join("\n")
    : "";
  const handleShareResult = async () => {
    if (!shareText) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Agegaple",
          text: shareText,
        });
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

  const mainClass = "min-h-screen text-[color:var(--foreground)]";
  const mutedTextClass = "text-[color:var(--outline)]";
  const panelClass = "card border border-[color:var(--surface-container)] flex h-full min-h-0 flex-col gap-2 sm:gap-3";

  if (loading) {
    return (
      <div className="agegaple-shell">
        <main className={`${mainClass} flex flex-col`}>
          <DailydabbleNav
            subtitle="Agegaple"
            subtitleHref="/agegaple"
            homeHref="/"
            rightContent={
              <DailydabbleMenu
                items={[
                  { label: "DailyDabble", href: "/", brand: true },
                  { label: "Archive games", href: "/agegaple/archive" },
                ]}
              />
            }
          />

          <div className="container flex flex-1 min-h-0 flex-col gap-3 sm:gap-4">
            <section className={panelClass}>
              <h1 className="page-title"><LoadingLabel text="Loading puzzle" /></h1>
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
        homeHref="/"
        rightContent={
          <DailydabbleMenu
            items={[
              { label: "DailyDabble", href: "/", brand: true },
              { label: "Archive games", href: "/agegaple/archive" },
            ]}
          />
        }
      />

      <div className="container flex flex-1 min-h-0 flex-col gap-3 sm:gap-4">
        {!loading && !puzzle && !error && (
          <DailydabbleUnavailable title="Agegaple unavailable" message="No puzzle available right now." />
        )}

        {!loading && puzzle && (
          <section className={panelClass}>
            {isCompleted && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className={`text-sm font-semibold ${isDarkMode ? "text-zinc-300" : "text-[color:var(--outline)]"}`}>
                  {attempts[attempts.length - 1]?.direction === "exact"
                    ? "You completed today’s puzzle. Come back for the next one."
                    : "You used all attempts for today. Come back for the next one."}
                </p>
                <p className="text-sm font-bold text-[color:var(--primary-dim)]">
                  {nextGameCountdown || "--:--:--"}
                </p>
              </div>
            )}
            <div className="agegaple-meta-row">
              <span className="chip">TODAY&apos;S GAME</span>
              <span className="chip">Guesses {attempts.length}/{maxGuesses}</span>
              <button className="how-to-play-btn" type="button" onClick={() => setIsHowToPlayOpen(true)}>
                ? How to play
              </button>
            </div>
            <h2 className="puzzle-title">
              {title}
            </h2>
            <div className="agegaple-image-frame h-[min(48vh,360px)]">
              <AsyncImage
                className="agegaple-image select-none"
                src={activeImage?.imageUrl}
                alt={activeImage?.imageAlt || "Celebrity couple"}
                wrapperClassName="flex h-full w-full items-center justify-center"
                overlayClassName="bg-[color:var(--surface-container-lowest)]/80 text-[color:var(--primary-dim)]"
              />
            </div>
            <EditorialDrawer
              context={puzzle.editorialContext}
              personAName={puzzle.personAName}
              personBName={puzzle.personBName}
              isDarkMode={false}
            />
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSubmit}>
              <label className={`flex-1 text-sm font-semibold ${isDarkMode ? "text-zinc-300" : "text-[color:var(--foreground)]"}`}>
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
                    className={`no-native-spinner h-11 w-24 rounded-full border-2 px-3 text-lg font-bold outline-none transition focus:border-[color:var(--primary)] ${
                      isDarkMode
                        ? "border-zinc-600 bg-zinc-950 text-zinc-100"
                        : "border-[color:var(--surface-container)] bg-[color:var(--surface-container-lowest)] text-[color:var(--foreground)]"
                    }`}
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
                <button
                  type="button"
                  onClick={() => setIsResultOpen(true)}
                  className="rounded-full bg-[color:var(--primary)] px-5 py-2.5 font-extrabold text-white shadow-[0_10px_20px_rgba(158,78,109,0.28)] transition hover:bg-[color:var(--primary-dim)]"
                >
                  Review result
                </button>
              ) : (
                <button
                  type="submit"
                  className="rounded-full bg-[color:var(--primary)] px-5 py-2.5 font-extrabold text-white shadow-[0_10px_20px_rgba(158,78,109,0.28)] transition hover:bg-[color:var(--primary-dim)] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={hasFinishedAttempts}
                >
                  Guess
                </button>
              )}
            </form>
            {!isCompleted && lastAttempt && lastAttempt.direction !== "exact" && (
              <div className="space-y-1 text-sm">
                <p className={`font-semibold ${isDarkMode ? "text-zinc-200" : "text-[color:var(--foreground)]"}`}>{hintHeat}</p>
                {hintTemperature && <p className={mutedTextClass}>{hintTemperature}</p>}
              </div>
            )}
            {attempts.length > 0 && latestAttempt && (
              <div className="guess-history-wrap">
                <button
                  type="button"
                  className="guess-history-toggle"
                  aria-expanded={isHistoryOpen}
                  aria-controls="agegaple-guess-history-panel"
                  onClick={() => setIsHistoryOpen((current) => !current)}
                >
                  <span className="guess-history-title">Guess history</span>
                  <span
                    className={`guess-history-toggle-icon ${isHistoryOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M6 14 12 8l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
                <div className="guess-history-latest">
                  <span className="guess-history-guess">{latestAttempt.guessYears} years</span>
                  {latestAttempt.direction === "exact" ? (
                    <strong className="guess-history-status-correct">Correct</strong>
                  ) : (
                    <strong className="guess-history-status-wrong">Wrong</strong>
                  )}
                </div>
                {isHistoryOpen && earlierAttempts.length > 0 && (
                  <ul id="agegaple-guess-history-panel" className="guess-history-list">
                    {earlierAttempts.map((attempt, index) => (
                      <li key={`${attempt.guessYears}-${index}`} className="guess-history-item">
                        <span className="guess-history-guess">{attempt.guessYears} years</span>
                        {attempt.direction === "exact" ? (
                          <strong className="guess-history-status-correct">Correct</strong>
                        ) : (
                          <strong className="guess-history-status-wrong">Wrong</strong>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        {error && (
          <p
            className={`rounded-md border p-3 ${
              isDarkMode
                ? "border-rose-400/50 bg-rose-950/40 text-rose-200"
                : "border-rose-300 bg-rose-50 text-rose-700"
            }`}
          >
            {error}
          </p>
        )}

      </div>
      {isHowToPlayOpen ? (
        <HowToPlayDialog
          title="How to play Agegaple"
          subtitle="Guess the celebrity couple age gap."
          steps={[
            "After each guess, hot and cold hints show how close your guess was.",
            "Use the picture, hot/cold hints, and your prior guesses to narrow it down.",
            "Read the editorial content to learn more about the couple.",
            `Find the exact rounded age gap in ${maxGuesses} guesses.`,
          ]}
          buttonClassName="guess-submit-btn"
          onClose={() => setIsHowToPlayOpen(false)}
        />
      ) : null}

      {result && isResultOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4"
          onClick={() => setIsResultOpen(false)}
        >
          <div
            className={`relative max-h-[88vh] w-full max-w-2xl overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border p-4 shadow-xl sm:p-5 ${
              isDarkMode ? "border-zinc-700 bg-zinc-900 text-zinc-100" : "border-[color:var(--surface-container)] bg-white text-[color:var(--foreground)]"
            }`}
            style={{ position: "relative" }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Guess result"
          >
            <button
              type="button"
              onClick={() => setIsResultOpen(false)}
              aria-label="Close result dialog"
              className="result-modal-close"
              style={{
                position: "absolute",
                top: "0.55rem",
                right: "0.55rem",
                left: "auto",
                width: "2.25rem",
                height: "2.25rem",
                cursor: "pointer",
                zIndex: 5,
              }}
            >
              ×
            </button>
            <div className="mb-3 space-y-2">
              <h3 className="result-modal-title">Result</h3>
              <p className={mutedTextClass}>Next game in {nextGameCountdown || "--:--:--"}</p>
            </div>
            <div className="space-y-2">
              <div className="result-modal-summary">
                <p className={`${mutedTextClass} result-modal-subtitle`}>{performanceLabel}</p>
                <p className={`${mutedTextClass} result-modal-stat-line`}>
                  Guesses used:{" "}
                  <span className={isDarkMode ? "font-bold text-zinc-100" : "font-bold text-[color:var(--foreground)]"}>
                    {attempts.length}/{maxGuesses}
                  </span>
                </p>
              </div>
              {activeImage && (
                <div className="mb-2">
                  <AsyncImage
                    src={activeImage.imageUrl}
                    alt={activeImage.imageAlt || "Celebrity couple"}
                    className="max-h-[260px] w-full rounded-lg border border-[color:var(--surface-container)] bg-[color:var(--surface-container-low)] object-contain object-center"
                    overlayClassName="bg-[color:var(--surface-container-low)]/88 text-[color:var(--primary-dim)]"
                  />
                </div>
              )}
              {puzzle && (
                <p className={mutedTextClass}>
                  {puzzle.personAName}:{" "}
                  <span className={isDarkMode ? "font-bold text-zinc-100" : "font-bold text-[color:var(--foreground)]"}>
                    {result.personABirthDate}
                  </span>
                </p>
              )}
              {puzzle && (
                <p className={mutedTextClass}>
                  {puzzle.personBName}:{" "}
                  <span className={isDarkMode ? "font-bold text-zinc-100" : "font-bold text-[color:var(--foreground)]"}>
                    {result.personBBirthDate}
                  </span>
                </p>
              )}
              <GapMeter
                guessYears={result.guessYears}
                correctYears={result.roundedAgeGapYears}
                isDarkMode={isDarkMode}
                isOpen={isResultOpen}
              />
              <p className={mutedTextClass}>
                Exact age gap:{" "}
                <span className={isDarkMode ? "font-bold text-zinc-100" : "font-bold text-[color:var(--foreground)]"}>
                  {formatExactGap(result.exactAgeGapYears)}
                </span>
              </p>
            </div>
            <div className={`result-modal-actions mt-4 border-t pt-3 ${isDarkMode ? "border-zinc-700" : "border-[color:var(--surface-container)]"}`}>
              <button
                type="button"
                onClick={handleShareResult}
                className="admin-btn-like"
              >
                Share
              </button>
              <Link
                href="/"
                className="admin-btn-like"
              >
                DailyDabble
              </Link>
              <Link
                href="/agegaple/archive"
                className="admin-btn-like primary"
              >
                Play Archive Games
              </Link>
            </div>
            {copyStatus && <p className={`mt-2 text-sm font-semibold ${mutedTextClass}`}>{copyStatus}</p>}
          </div>
        </div>
      )}
    </main>
    </div>
  );
}
