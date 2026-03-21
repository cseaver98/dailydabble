"use client";

import Link from "next/link";
import { DailydabbleMenu, DailydabbleNav } from "@dailydabble/ui";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import EditorialDrawer from "@/components/editorial-drawer";
import type { PuzzleAnswer, PuzzlePublic } from "@/lib/types";

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
  selectedImageIndex: number;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

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
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isMagnifierActive, setIsMagnifierActive] = useState(false);
  const [isMagnifierDragging, setIsMagnifierDragging] = useState(false);
  const [magnifierLens, setMagnifierLens] = useState({
    xPx: 0,
    yPx: 0,
    bgPosX: 0,
    bgPosY: 0,
    bgWidthPx: 0,
    bgHeightPx: 0,
  });
  const isDarkMode = false;
  const [nextGameCountdown, setNextGameCountdown] = useState("");
  const imageViewportRef = useRef<HTMLDivElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const hasHydratedProgressRef = useRef(false);
  const magnifierSize = 180;
  const magnifierZoom = 2.8;

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/puzzle/today");
        if (!response.ok) {
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

    setSelectedImageIndex(0);
  }, [puzzle]);

  useEffect(() => {
    setIsMagnifierActive(false);
    setIsMagnifierDragging(false);
  }, [isImageOpen, selectedImageIndex]);

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
            setSelectedImageIndex(
              Number.isFinite(parsedProgress.selectedImageIndex) ? parsedProgress.selectedImageIndex : 0,
            );
          }
        } catch {
          window.localStorage.removeItem(`${progressStoragePrefix}${puzzle.puzzleId}`);
        }
      } else {
        setGuess("10");
        setAttempts([]);
        setSelectedImageIndex(0);
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
      selectedImageIndex,
    };
    window.localStorage.setItem(progressKey, JSON.stringify(payload));
  }, [attempts, guess, isCompleted, puzzle, selectedImageIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsImageOpen(false);
        setIsResultOpen(false);
      }

      if (!puzzle) {
        return;
      }
      const allImages = puzzle.galleryImages.length
        ? puzzle.galleryImages
        : [{ imageUrl: puzzle.imageUrl, imageAlt: puzzle.imageAlt }];
      const wrongCount = attempts.filter((attempt) => attempt.direction !== "exact").length;
      const revealedCount = isCompleted ? allImages.length : Math.min(allImages.length, Math.max(1, 1 + wrongCount));
      if (revealedCount < 2) {
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

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setSelectedImageIndex((current) => (current + 1) % revealedCount);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setSelectedImageIndex((current) =>
          (current - 1 + revealedCount) % revealedCount,
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isImageOpen, isCompleted, attempts, puzzle]);

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
      const response = await fetch("/api/puzzle/submit", {
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
        const nextWrongCount = nextAttempts.filter((entry) => entry.direction !== "exact").length;
        const nextRevealedCount = Math.min(galleryImages.length, Math.max(1, 1 + nextWrongCount));
        setSelectedImageIndex(Math.max(0, nextRevealedCount - 1));
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

  const galleryImages = puzzle?.galleryImages.length
    ? puzzle.galleryImages
    : puzzle
      ? [{ imageUrl: puzzle.imageUrl, imageAlt: puzzle.imageAlt }]
      : [];
  const wrongAttemptCount = attempts.filter((attempt) => attempt.direction !== "exact").length;
  const revealedPhotoCount = isCompleted
    ? galleryImages.length
    : Math.min(galleryImages.length, Math.max(1, 1 + wrongAttemptCount));
  const visibleGalleryImages = galleryImages.slice(0, revealedPhotoCount);
  const activeImage = visibleGalleryImages[selectedImageIndex] ?? visibleGalleryImages[0];
  const primaryImage = galleryImages[0];
  const canNavigateGallery = visibleGalleryImages.length > 1;
  const attemptsRemaining = Math.max(0, maxGuesses - attempts.length);
  const lastAttempt = attempts[attempts.length - 1];
  const previousAttempt = attempts.length > 1 ? attempts[attempts.length - 2] : null;
  const hasFinishedAttempts = isCompleted || attempts.length >= maxGuesses;
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
        `Agegaple ${puzzle.puzzleDate}`,
        `${puzzle.personAName} + ${puzzle.personBName}`,
        `${attempts.length}/${maxGuesses} tries`,
        shareBlocks,
      ].join("\n")
    : "";
  const handleShareResult = async () => {
    if (!shareText) return;
    const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    if (isMobileDevice && typeof navigator.share === "function") {
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

  useEffect(() => {
    if (!visibleGalleryImages.length) {
      return;
    }
    if (selectedImageIndex >= visibleGalleryImages.length) {
      setSelectedImageIndex(visibleGalleryImages.length - 1);
    }
  }, [selectedImageIndex, visibleGalleryImages.length]);

  const updateMagnifier = (clientX: number, clientY: number) => {
    const viewport = imageViewportRef.current;
    const imageElement = imageElementRef.current;
    if (!viewport || !imageElement) {
      return false;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const imageRect = imageElement.getBoundingClientRect();
    if (viewportRect.width <= 0 || viewportRect.height <= 0 || imageRect.width <= 0 || imageRect.height <= 0) {
      return false;
    }

    const halfLens = magnifierSize / 2;
    const rawX = clientX - viewportRect.left;
    const rawY = clientY - viewportRect.top;
    const imageOffsetX = imageRect.left - viewportRect.left;
    const imageOffsetY = imageRect.top - viewportRect.top;
    const imageX = clientX - imageRect.left;
    const imageY = clientY - imageRect.top;
    const isInsideImage = imageX >= 0 && imageX <= imageRect.width && imageY >= 0 && imageY <= imageRect.height;

    if (!isInsideImage && !isMagnifierDragging) {
      setIsMagnifierActive(false);
      return false;
    }

    const clampedImageX = Math.min(Math.max(imageX, 0), imageRect.width);
    const clampedImageY = Math.min(Math.max(imageY, 0), imageRect.height);
    const lensMinX = imageOffsetX + Math.min(halfLens, imageRect.width / 2);
    const lensMaxX = imageOffsetX + Math.max(imageRect.width - halfLens, imageRect.width / 2);
    const lensMinY = imageOffsetY + Math.min(halfLens, imageRect.height / 2);
    const lensMaxY = imageOffsetY + Math.max(imageRect.height - halfLens, imageRect.height / 2);
    const xPx = Math.min(Math.max(rawX, lensMinX), lensMaxX);
    const yPx = Math.min(Math.max(rawY, lensMinY), lensMaxY);

    setMagnifierLens({
      xPx,
      yPx,
      bgPosX: -(clampedImageX * magnifierZoom - halfLens),
      bgPosY: -(clampedImageY * magnifierZoom - halfLens),
      bgWidthPx: imageRect.width * magnifierZoom,
      bgHeightPx: imageRect.height * magnifierZoom,
    });
    setIsMagnifierActive(true);
    return true;
  };

  const mainClass = "min-h-screen text-[color:var(--foreground)]";
  const mutedTextClass = "text-[color:var(--outline)]";
  const panelClass = "rounded-[2rem] border border-[color:var(--surface-container)] bg-white p-3 shadow-[0_20px_40px_rgba(44,47,49,0.06)] sm:p-4";
  const imageFrameClass = "relative overflow-hidden rounded-[2rem] border border-[color:var(--surface-container)] bg-[color:var(--surface-container-high)]";

  return (
    <main className={`${mainClass} flex flex-col`}>
      <DailydabbleNav
        subtitle="Agegaple"
        label="Guess the celebrity couple age gap"
        rightContent={
          <DailydabbleMenu
            items={[
              { label: "Archive games", href: "/archive" },
            ]}
            legalLinks={[
              { label: "Terms", href: "/terms" },
              { label: "Privacy", href: "/privacy" },
            ]}
          />
        }
      />

      <div className="mx-auto flex w-full max-w-3xl flex-1 min-h-0 flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-5 sm:py-4">
        {loading && <p className={mutedTextClass}>Loading puzzle...</p>}

        {!loading && puzzle && (
          <section className={`${panelClass} flex h-full min-h-0 flex-col gap-2 sm:gap-3`}>
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              <div className="rounded-full bg-[color:color-mix(in_srgb,var(--primary-container)_52%,white)] px-2.5 py-1 text-center shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_20%,transparent)]">
                <p className="font-headline text-[0.6rem] font-extrabold uppercase tracking-[0.05em] text-[color:var(--primary-dim)]">Attempts</p>
                <p className="text-[0.88rem] font-black text-[color:var(--foreground)]">
                  {attempts.length}
                  <span className={`text-[0.72rem] font-semibold ${mutedTextClass}`}> / {maxGuesses}</span>
                </p>
              </div>
              <div className="rounded-full bg-[color:color-mix(in_srgb,var(--primary-container)_52%,white)] px-2.5 py-1 text-center shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_20%,transparent)]">
                <p className="font-headline text-[0.6rem] font-extrabold uppercase tracking-[0.05em] text-[color:var(--primary-dim)]">Remaining</p>
                <p className="text-[0.88rem] font-black text-[color:var(--primary-dim)]">{attemptsRemaining}</p>
              </div>
              <div className="rounded-full bg-[color:color-mix(in_srgb,var(--primary-container)_52%,white)] px-2.5 py-1 text-center shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_20%,transparent)]">
                <p className="font-headline text-[0.6rem] font-extrabold uppercase tracking-[0.05em] text-[color:var(--primary-dim)]">Photos</p>
                <p className="text-[0.88rem] font-black text-[color:var(--primary-dim)]">
                  {revealedPhotoCount}
                  <span className={`text-[0.72rem] font-semibold ${mutedTextClass}`}> / {galleryImages.length || 0}</span>
                </p>
              </div>
            </div>
            <h2 className="px-1 text-xl font-bold tracking-tight text-[color:var(--foreground)]">{title}</h2>
            <div className={`${imageFrameClass} flex h-[min(48vh,360px)] min-h-[170px] items-center justify-center p-2`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="cursor-zoom-in select-none"
                src={activeImage?.imageUrl}
                alt={activeImage?.imageAlt}
                onClick={() => setIsImageOpen(true)}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  width: "auto",
                  height: "auto",
                  objectFit: "contain",
                  objectPosition: "center",
                }}
              />
              {canNavigateGallery && (
                <>
                  <button
                    type="button"
                    className="absolute left-3 top-1/2 z-10 flex h-[2.2rem] w-[2.2rem] -translate-y-1/2 items-center justify-center rounded-full border-0 bg-white/92 text-[1.08rem] leading-none text-[color:var(--foreground)] shadow-[0_10px_18px_rgba(44,47,49,0.16)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={() => setSelectedImageIndex((current) => Math.max(0, current - 1))}
                    aria-label="Previous photo"
                    disabled={selectedImageIndex <= 0}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 z-10 flex h-[2.2rem] w-[2.2rem] -translate-y-1/2 items-center justify-center rounded-full border-0 bg-white/92 text-[1.08rem] leading-none text-[color:var(--foreground)] shadow-[0_10px_18px_rgba(44,47,49,0.16)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={() =>
                      setSelectedImageIndex((current) => Math.min(visibleGalleryImages.length - 1, current + 1))
                    }
                    aria-label="Next photo"
                    disabled={selectedImageIndex >= visibleGalleryImages.length - 1}
                  >
                    →
                  </button>
                </>
              )}
            </div>
            {galleryImages.length > 1 && (
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {galleryImages.map((image, index) => {
                  const isLocked = index >= revealedPhotoCount;
                  return (
                  <button
                    key={`${image.imageUrl}-${index}`}
                    type="button"
                    className={`relative aspect-square overflow-hidden rounded-full border bg-[color:var(--surface-container-low)] ${
                      !isLocked && index === selectedImageIndex
                        ? "border-[color:var(--primary)] ring-2 ring-[color:var(--primary-container)]"
                        : isDarkMode
                          ? "border-zinc-700 bg-zinc-800"
                          : "border-[color:var(--surface-container)]"
                    }`}
                    onClick={() => {
                      if (isLocked) return;
                      setSelectedImageIndex(index);
                    }}
                    aria-label={isLocked ? `Photo ${index + 1} locked` : `View photo ${index + 1}`}
                    disabled={isLocked}
                  >
                    {isLocked ? (
                      <div className={`flex h-full w-full items-center justify-center ${
                        isDarkMode ? "bg-zinc-800 text-zinc-300" : "bg-[color:var(--surface-container)] text-[color:var(--outline)]"
                      }`}>
                        <span aria-hidden="true" className="text-xl">🔒</span>
                      </div>
                    ) : (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.imageUrl}
                          alt={image.imageAlt}
                          className="h-full w-full object-cover object-top"
                        />
                      </>
                    )}
                  </button>
                  );
                })}
              </div>
            )}
            <EditorialDrawer
              context={puzzle.editorialContext}
              personAName={puzzle.personAName}
              personBName={puzzle.personBName}
              isDarkMode={false}
            />
            {!isCompleted && lastAttempt && lastAttempt.direction !== "exact" && (
              <div
                className={`rounded-md border px-3 py-2 text-sm ${
                  isDarkMode ? "border-zinc-700 bg-zinc-800/50 text-zinc-200" : "border-[color:var(--surface-container)] bg-[color:var(--surface-container-low)] text-[color:var(--foreground)]"
                }`}
              >
                <p className="font-semibold">{hintHeat}</p>
                {hintTemperature && <p>{hintTemperature}</p>}
              </div>
            )}
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
                    className={`h-11 w-24 rounded-full border-2 px-3 text-lg font-bold outline-none transition focus:border-[color:var(--primary)] ${
                      isDarkMode
                        ? "border-zinc-600 bg-zinc-950 text-zinc-100"
                        : "border-[color:var(--surface-container)] bg-[color:var(--surface-container-lowest)] text-[color:var(--foreground)]"
                    }`}
                  />
                </div>
              </label>
              {hasFinishedAttempts ? (
                <button
                  type="button"
                  onClick={() => setIsResultOpen(true)}
                    className={`h-11 rounded-full border px-5 font-bold transition ${
                    isDarkMode
                      ? "border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                      : "border-[color:var(--surface-container)] bg-[color:var(--surface-container-lowest)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-container-high)]"
                  }`}
                >
                  Review result
                </button>
              ) : (
                <button
                  type="submit"
                  className="rounded-full bg-[color:var(--primary)] px-5 py-2.5 font-extrabold text-white transition hover:bg-[color:var(--primary-dim)] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={hasFinishedAttempts}
                >
                  {attempts.length === maxGuesses - 1 ? "Final Guess" : "Submit Guess"}
                </button>
              )}
            </form>
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
      {isImageOpen && puzzle && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setIsImageOpen(false)}
        >
          <div
            className="relative flex h-[calc(100vh-2rem)] w-full max-w-6xl flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            {canNavigateGallery && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedImageIndex(
                      (current) => (current - 1 + visibleGalleryImages.length) % visibleGalleryImages.length,
                    )
                  }
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-500 bg-zinc-900/90 px-3 py-2 text-lg font-bold text-zinc-100 hover:bg-zinc-800"
                  aria-label="Previous photo"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedImageIndex((current) => (current + 1) % visibleGalleryImages.length)}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-500 bg-zinc-900/90 px-3 py-2 text-lg font-bold text-zinc-100 hover:bg-zinc-800"
                  aria-label="Next photo"
                >
                  ›
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setIsImageOpen(false)}
              className="absolute right-2 top-2 rounded-md border border-zinc-500 bg-zinc-900/90 px-2 py-1 text-sm font-semibold text-zinc-100 hover:bg-zinc-800"
            >
              Close
            </button>
            <div
              ref={imageViewportRef}
              className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 ${
                isMagnifierDragging ? "cursor-grabbing" : "cursor-zoom-in"
              }`}
              onPointerEnter={(event) => {
                if (event.pointerType !== "mouse") {
                  return;
                }
                updateMagnifier(event.clientX, event.clientY);
              }}
              onPointerMove={(event) => {
                if (event.pointerType !== "mouse") {
                  return;
                }
                updateMagnifier(event.clientX, event.clientY);
              }}
              onPointerDown={(event) => {
                if (event.pointerType !== "mouse") {
                  return;
                }
                const didUpdate = updateMagnifier(event.clientX, event.clientY);
                if (!didUpdate) {
                  return;
                }
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                setIsMagnifierDragging(true);
              }}
              onPointerUp={(event) => {
                if (event.pointerType !== "mouse") {
                  return;
                }
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                setIsMagnifierDragging(false);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType !== "mouse") {
                  return;
                }
                if (!isMagnifierDragging) {
                  setIsMagnifierActive(false);
                }
              }}
              onPointerCancel={() => {
                setIsMagnifierDragging(false);
                setIsMagnifierActive(false);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageElementRef}
                className="max-h-full max-w-full select-none object-contain object-center"
                src={activeImage?.imageUrl}
                alt={activeImage?.imageAlt}
                draggable={false}
              />
              {isMagnifierActive && activeImage?.imageUrl && (
                <div
                  className="pointer-events-none absolute rounded-full border-2 border-zinc-100/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]"
                  style={{
                    width: `${magnifierSize}px`,
                    height: `${magnifierSize}px`,
                    left: `${magnifierLens.xPx}px`,
                    top: `${magnifierLens.yPx}px`,
                    transform: "translate(-50%, -50%)",
                    backgroundImage: `url("${activeImage.imageUrl}")`,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: `${magnifierLens.bgWidthPx}px ${magnifierLens.bgHeightPx}px`,
                    backgroundPosition: `${magnifierLens.bgPosX}px ${magnifierLens.bgPosY}px`,
                  }}
                />
              )}
            </div>
            <p className="mt-2 shrink-0 text-center text-sm text-zinc-300">
              Photo {Math.min(selectedImageIndex + 1, visibleGalleryImages.length)} of {visibleGalleryImages.length}
            </p>
            <button
              type="button"
              onClick={() => setIsImageOpen(false)}
              className="mt-2 shrink-0 rounded-md border border-zinc-500 bg-zinc-900/90 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-800"
            >
              Exit fullscreen
            </button>
          </div>
        </div>
      )}
      {result && isResultOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/70 p-3 sm:items-center sm:p-4"
          onClick={() => setIsResultOpen(false)}
        >
          <div
            className={`my-3 w-full max-w-2xl rounded-2xl border p-4 shadow-xl sm:my-0 sm:p-5 ${
              isDarkMode ? "border-zinc-700 bg-zinc-900 text-zinc-100" : "border-[color:var(--surface-container)] bg-white text-[color:var(--foreground)]"
            }`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Guess result"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-bold text-[color:var(--primary-dim)]">
                Next game in {nextGameCountdown || "--:--:--"}
              </h3>
              <button
                type="button"
                onClick={() => setIsResultOpen(false)}
                aria-label="Close result dialog"
                className={`rounded-md border px-2 py-1 text-sm font-bold leading-none ${
                  isDarkMode
                    ? "border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                    : "border-[color:var(--surface-container)] bg-[color:var(--surface-container-lowest)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-container-high)]"
                }`}
              >
                ×
              </button>
            </div>
            <div className="space-y-2">
              <p className={mutedTextClass}>
                Attempts used:{" "}
                <span className={isDarkMode ? "font-bold text-zinc-100" : "font-bold text-[color:var(--foreground)]"}>
                  {attempts.length}/{maxGuesses}
                </span>
              </p>
              {primaryImage && (
                <div className="mb-2 h-48 overflow-hidden rounded-lg border border-zinc-600/40 bg-zinc-950/30 sm:h-52">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={primaryImage.imageUrl}
                    alt={primaryImage.imageAlt}
                    className="h-full w-full object-contain object-top"
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
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleShareResult}
                className={`inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  isDarkMode
                    ? "border-zinc-500 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                    : "border-[color:var(--surface-container)] bg-[color:var(--surface-container-low)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-container-high)]"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  Share
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="2" />
                    <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                    <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="2" />
                    <path d="M8.7 10.7 15.3 6.3M8.7 13.3l6.6 4.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
              <Link
                href="/archive"
                className={`inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  isDarkMode
                    ? "border-zinc-500 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                    : "border-[color:var(--surface-container)] bg-[color:var(--surface-container-low)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-container-high)]"
                }`}
              >
                Play Archive Games
              </Link>
            </div>
            {copyStatus && <p className={`mt-2 text-sm font-semibold ${mutedTextClass}`}>{copyStatus}</p>}
          </div>
        </div>
      )}
    </main>
  );
}
