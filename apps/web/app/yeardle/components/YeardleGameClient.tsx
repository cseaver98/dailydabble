"use client";

import { trackGameStarted } from "../../../lib/analytics-client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import MainNav from "./MainNav";
import EditorialDrawer from "./EditorialDrawer";
import ArchiveLockGate from "../../components/ArchiveLockGate";
import AsyncImage from "../../components/AsyncImage";
import HowToPlayDialog from "../../components/HowToPlayDialog";
import ResultDialogActions from "../../components/ResultDialogActions";
import ResultOutcomeEffects from "../../components/ResultOutcomeEffects";
import { toPublicAppUrl } from "../../../lib/app-url";
import { recordGameCompletionQuietly } from "../../../lib/record-game-completion";
import { buildResultPayload } from "../../../lib/result-payload";
import { buildGameShareText, shareResultText } from "../../../lib/share-results";
import { fetchStoredGameResult, getResultPayloadAnswer, getResultPayloadAttempts } from "../../../lib/stored-game-result";
import { useNextGameCountdown } from "../../../lib/use-next-game-countdown";
import LoadingLabel from "../../components/LoadingLabel";
import GuessProgressChip from "../../components/GuessProgressChip";
import useHowToPlayDialog from "../../components/useHowToPlayDialog";

type YeardleGameClientProps = {
  apiUrl: string;
  navLabel?: string;
  hideToday?: boolean;
  archiveHref?: string;
  storagePrefix?: string;
  completionPrefix?: string;
  lockDailyCompletion?: boolean;
};
type Attempt = { guessYear: number; direction: string; distanceYears: number };
type YeardleGameState = "playing" | "won" | "lost";
type YeardlePuzzle = {
  puzzleId: string;
  puzzleDate: string;
  archiveGameNumber?: number;
  maxGuesses: number;
  eventTitle: string;
  eventYear?: number;
  eventMonth?: number | null;
  eventDay?: number | null;
  imageUrl?: string;
  imageAlt?: string;
  imageSourcePageUrl?: string | null;
  imageLicense?: string | null;
  imageLicenseUrl?: string | null;
  imageAuthor?: string | null;
  imageAttributionText?: string | null;
  wikipediaUrl?: string;
  editorialContext?: { description?: string | null };
  galleryImages?: Array<{ imageUrl?: string; imageAlt?: string }>;
};
type RestoredYeardleState = {
  guess: string;
  attempts: Attempt[];
  gameState: YeardleGameState;
  message: string;
  resolvedAnswer: string;
  isResultOpen: boolean;
};

const isValidYear = (value: string) => /^\d{4}$/.test(value.trim());
const formatMonthDay = (dateString: string | undefined) => {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return "";
  }

  const [, month, day] = dateString.split("-").map((part) => Number(part));
  if (!Number.isFinite(month) || !Number.isFinite(day)) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, month - 1, day)),
  );
};
const formatEventMonthDay = (month: number | null | undefined, day: number | null | undefined) => {
  if (typeof month !== "number" || typeof day !== "number" || !Number.isFinite(month) || !Number.isFinite(day)) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, Number(month) - 1, Number(day))),
  );
};
const formatFullEventDate = (
  month: number | null | undefined,
  day: number | null | undefined,
  year: number | undefined,
) => {
  if (typeof year !== "number" || !Number.isFinite(year)) {
    return "";
  }
  if (typeof month !== "number" || typeof day !== "number" || !Number.isFinite(month) || !Number.isFinite(day)) {
    return String(year);
  }

  const monthDay = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, Number(month) - 1, Number(day))),
  );
  return `${monthDay}, ${year}`;
};
const getDefaultRestoredYeardleState = (): RestoredYeardleState => ({
  guess: "",
  attempts: [],
  gameState: "playing",
  message: "",
  resolvedAnswer: "",
  isResultOpen: false,
});
const restoreYeardleState = ({
  puzzleId,
  progressKey,
  completionKey,
  lockDailyCompletion,
}: {
  puzzleId: string;
  progressKey: string;
  completionKey: string;
  lockDailyCompletion: boolean;
}): RestoredYeardleState => {
  const parseStored = (raw: string, key: string): RestoredYeardleState => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.puzzleId && parsed.puzzleId !== puzzleId) {
        return getDefaultRestoredYeardleState();
      }
      const parsedState = parsed.gameState;
      const gameState = parsedState === "won" || parsedState === "lost" ? parsedState : "playing";
      return {
        guess: typeof parsed.guess === "string" ? parsed.guess : "",
        attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
        gameState,
        message: typeof parsed.message === "string" ? parsed.message : "",
        resolvedAnswer: typeof parsed.resolvedAnswer === "string" ? parsed.resolvedAnswer : "",
        isResultOpen: gameState !== "playing",
      };
    } catch {
      window.localStorage.removeItem(key);
      return getDefaultRestoredYeardleState();
    }
  };

  if (lockDailyCompletion) {
    const completionRaw = window.localStorage.getItem(completionKey);
    if (completionRaw) {
      return parseStored(completionRaw, completionKey);
    }
  }

  const raw = window.localStorage.getItem(progressKey);
  if (!raw) {
    return getDefaultRestoredYeardleState();
  }

  const restored = parseStored(raw, progressKey);
  if (!lockDailyCompletion && restored.gameState !== "playing") {
    window.localStorage.removeItem(progressKey);
    return getDefaultRestoredYeardleState();
  }
  return restored;
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

const getHeatLabel = (distanceYears: number) => {
  if (distanceYears <= 5) return "Very warm 🔥";
  if (distanceYears <= 15) return "Warm ☀️";
  if (distanceYears <= 40) return "Cold 🧊";
  return "Very cold 🥶";
};

const getShareHeatBlock = (attempt: Attempt) => {
  if (attempt.direction === "exact" || Number(attempt.distanceYears || 0) <= 0) return "🟩";
  if (Number(attempt.distanceYears || 0) <= 5) return "🟨";
  if (Number(attempt.distanceYears || 0) <= 15) return "🟧";
  return "🟥";
};

const isAttemptCorrect = (attempt: Attempt | null, gameState: string, resolvedAnswer: string) => {
  if (!attempt) {
    return false;
  }
  if (attempt.direction === "exact") {
    return true;
  }
  if (gameState !== "won" || !resolvedAnswer) {
    return false;
  }
  return resolvedAnswer.startsWith(String(attempt.guessYear));
};

export default function YeardleGameClient({
  apiUrl,
  navLabel = "Yeardle",
  hideToday = false,
  archiveHref = "/yeardle/archive",
  storagePrefix = "yeardle:v1:today",
  completionPrefix = "yeardle:v1:completed",
  lockDailyCompletion = true,
}: YeardleGameClientProps) {
  const isArchiveView = apiUrl.includes("/by-date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState<YeardlePuzzle | null>(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [gameState, setGameState] = useState<YeardleGameState>("playing");
  const [message, setMessage] = useState("");
  const [resolvedAnswer, setResolvedAnswer] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const { isHowToPlayOpen, openHowToPlay, closeHowToPlay } = useHowToPlayDialog("yeardle", Boolean(puzzle) && !loading);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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
          throw new Error(payload.error || "Failed to load Yeardle puzzle");
        }

        if (!active) {
          return;
        }

        const progressKey = `${storagePrefix}:${payload.puzzleId}`;
        const completionKey = `${completionPrefix}:${payload.puzzleId}`;
        const storedResult = await fetchStoredGameResult({
          gameSlug: "yeardle",
          puzzleId: payload.puzzleId,
          puzzleDate: payload.puzzleDate,
          isArchive: isArchiveView,
        });
        if (storedResult) {
          const answer = getResultPayloadAnswer(storedResult);
          const answerYear = typeof answer.year === "number" || typeof answer.year === "string" ? String(answer.year) : "";
          const eventTitle = typeof answer.eventTitle === "string" ? answer.eventTitle : "";
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: payload.puzzleId,
              guess: "",
              attempts: getResultPayloadAttempts(storedResult),
              gameState: storedResult.isWin ? "won" : "lost",
              message: storedResult.isWin
                ? `Correct. The event happened in ${answerYear}. ${eventTitle}`
                : `Out of guesses. The year was ${answerYear}. ${eventTitle}`,
              resolvedAnswer: `${answerYear} — ${eventTitle}`,
            }),
          );
        }

        const restoredState = restoreYeardleState({
          puzzleId: payload.puzzleId,
          progressKey,
          completionKey,
          lockDailyCompletion,
        });
        setPuzzle(payload);
        setArchiveLock(null);
        setImageFailed(false);
        setGuess(restoredState.guess);
        setAttempts(restoredState.attempts);
        setGameState(restoredState.gameState);
        setMessage(restoredState.message);
        setResolvedAnswer(restoredState.resolvedAnswer);
        setIsResultOpen(restoredState.isResultOpen);
        setCopyStatus("");
      } catch (loadError) {
        if (!active) {
          return;
        }
        setArchiveLock(null);
        setError(loadError instanceof Error ? loadError.message : "Failed to load Yeardle puzzle");
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

  const progressKey = useMemo(() => {
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
    if (!progressKey || !puzzle) {
      return;
    }

    const payload = { guess, attempts, gameState, message, resolvedAnswer };
    window.localStorage.setItem(progressKey, JSON.stringify(payload));
  }, [attempts, gameState, guess, message, progressKey, puzzle, resolvedAnswer]);

  const maxGuesses = Number.isFinite(puzzle?.maxGuesses) ? Number(puzzle?.maxGuesses) : 5;
  const galleryImages = Array.isArray(puzzle?.galleryImages) && puzzle.galleryImages.length
    ? puzzle.galleryImages
    : [{ imageUrl: puzzle?.imageUrl, imageAlt: puzzle?.imageAlt }];
  const normalizedGallery = galleryImages.map((item, index) => ({
    imageUrl: item?.imageUrl || "/event-placeholder.svg",
    imageAlt: item?.imageAlt || `Historical event photo ${index + 1}`,
  }));
  const activeImage = normalizedGallery[0];
  const imageSrc = !imageFailed && activeImage?.imageUrl ? activeImage.imageUrl : "/event-placeholder.svg";
  const imageAttributionLabel = puzzle?.imageAttributionText || [puzzle?.imageAuthor, puzzle?.imageLicense].filter(Boolean).join(" | ");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!puzzle || gameState !== "playing") {
      return;
    }

    const nextGuess = guess.trim();
    if (!isValidYear(nextGuess)) {
      setMessage("Enter a 4-digit year.");
      return;
    }

    trackGameStarted("yeardle", puzzle.puzzleDate, isArchiveView);

    const numericGuess = Number(nextGuess);
    try {
      const response = await fetch("/api/yeardle/puzzle/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.puzzleId, guessYear: numericGuess }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to submit guess");
      }

      const attempt = {
        guessYear: numericGuess,
        direction: payload.direction,
        distanceYears: Math.abs(Number(payload.answerYear) - numericGuess),
      };

      const nextAttempts = [...attempts, attempt];
      setAttempts(nextAttempts);

      if (payload.isCorrect) {
        const finalMessage = `Correct. The event happened in ${payload.answerYear}. ${payload.eventTitle}`;
        setGameState("won");
        setMessage(finalMessage);
        setResolvedAnswer(`${payload.answerYear} — ${payload.eventTitle}`);
        setIsResultOpen(true);
        recordGameCompletionQuietly({
          gameSlug: "yeardle",
          puzzleId: puzzle.puzzleId,
          puzzleDate: puzzle.puzzleDate,
          isArchive: isArchiveView,
          isWin: true,
          guessesUsed: nextAttempts.length,
          maxGuesses,
          resultPayload: buildResultPayload({
            attempts: nextAttempts,
            answer: { year: payload.answerYear, eventTitle: payload.eventTitle },
            final: { guessYear: numericGuess, distanceYears: attempt.distanceYears, direction: attempt.direction },
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
              resolvedAnswer: `${payload.answerYear} — ${payload.eventTitle}`,
            }),
          );
        }
        return;
      }

      if (nextAttempts.length >= maxGuesses) {
        const finalMessage = `Out of guesses. The year was ${payload.answerYear}. ${payload.eventTitle}`;
        setGameState("lost");
        setMessage(finalMessage);
        setResolvedAnswer(`${payload.answerYear} — ${payload.eventTitle}`);
        setIsResultOpen(true);
        recordGameCompletionQuietly({
          gameSlug: "yeardle",
          puzzleId: puzzle.puzzleId,
          puzzleDate: puzzle.puzzleDate,
          isArchive: isArchiveView,
          isWin: false,
          guessesUsed: nextAttempts.length,
          maxGuesses,
          resultPayload: buildResultPayload({
            attempts: nextAttempts,
            answer: { year: payload.answerYear, eventTitle: payload.eventTitle },
            final: { guessYear: numericGuess, distanceYears: attempt.distanceYears, direction: attempt.direction },
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
              resolvedAnswer: `${payload.answerYear} — ${payload.eventTitle}`,
            }),
          );
        }
        return;
      }

      setMessage("");
      setGuess("");
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : "Could not submit guess.");
    }
  };

  const effectiveAnswer = resolvedAnswer || "Unavailable";
  const performanceLabel = getPerformanceLabel(gameState === "won", attempts.length, maxGuesses);
  const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const previousAttempt = attempts.length > 1 ? attempts[attempts.length - 2] : null;
  const earlierAttempts = attempts.length > 1 ? attempts.slice(0, -1).reverse() : [];
  const eventTitleLabel = puzzle?.eventTitle || "";
  const monthDayLabel = formatEventMonthDay(puzzle?.eventMonth, puzzle?.eventDay) || formatMonthDay(puzzle?.puzzleDate);
  const fullEventDateLabel = formatFullEventDate(puzzle?.eventMonth, puzzle?.eventDay, puzzle?.eventYear);
  const resultAnswerLabel = (() => {
    if (gameState === "won" || gameState === "lost") {
      const title = puzzle?.eventTitle || "";
      if (title && fullEventDateLabel) {
        return `${title} - ${fullEventDateLabel}`;
      }
    }
    return effectiveAnswer;
  })();
  const hintHeat = latestAttempt && latestAttempt.direction !== "exact"
    ? getHeatLabel(Number(latestAttempt.distanceYears || 0))
    : null;
  const hintTemperature = latestAttempt && previousAttempt && latestAttempt.direction !== "exact"
    ? Number(latestAttempt.distanceYears || 0) < Number(previousAttempt.distanceYears || 0)
      ? "Warmer than your previous guess."
      : Number(latestAttempt.distanceYears || 0) > Number(previousAttempt.distanceYears || 0)
        ? "Colder than your previous guess."
        : "Same distance as your previous guess."
    : null;
  const shareBlocks = attempts.map(getShareHeatBlock).join("");
  const shareText = buildGameShareText({
    gameName: "Yeardle",
    isArchiveView,
    puzzleDate: puzzle?.puzzleDate,
    didWin: gameState === "won",
    guessesUsed: attempts.length,
    maxGuesses,
    visualRows: shareBlocks ? [shareBlocks] : [],
    url: toPublicAppUrl("/yeardle"),
  });
  const handleShareResult = async () => {
    const shareResult = await shareResultText("Yeardle", shareText);
    if (shareResult === "shared") setCopyStatus("Shared");
    if (shareResult === "copied") setCopyStatus("Copied to clipboard");
    if (shareResult === "failed") setCopyStatus("Share failed");
  };

  if (loading) {
    return (
      <div className="yeardle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <section className="card yeardle-card">
            <p className="page-title" role="status"><LoadingLabel text="Loading puzzle" /></p>
          </section>
        </main>
      </div>
    );
  }

  if (archiveLock) {
    return (
      <div className="yeardle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <ArchiveLockGate archiveHref={archiveHref} title={archiveLock.title} description={archiveLock.description} mode={archiveLock.mode} />
        </main>
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="yeardle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <DailydabbleUnavailable title="Yeardle unavailable" message={error || "No puzzle available right now."} />
        </main>
      </div>
    );
  }

  return (
    <div className="yeardle-shell">
      <MainNav label={navLabel} hideToday={hideToday} />

      <main className="container">
        <section className="card yeardle-card">
          <div className="game-meta-row">
            <span className="chip">{statusChipLabel}</span>
            <GuessProgressChip used={attempts.length} total={maxGuesses} active={gameState === "playing"} />
            <button className="how-to-play-btn" type="button" onClick={openHowToPlay}>
              ? How to play
            </button>
          </div>

          {monthDayLabel ? <p className="puzzle-kicker">On This Day: {monthDayLabel}</p> : null}
          {eventTitleLabel ? <h2 className="puzzle-title">{eventTitleLabel}</h2> : null}

          <figure className="event-figure">
            <AsyncImage
              src={imageSrc}
              alt={puzzle.imageAlt || "Historical event"}
              className="event-image"
              wrapperClassName="event-image-frame"
              overlayClassName="bg-[#faf9ff]/88 text-[color:var(--brand-strong)]"
              onError={() => setImageFailed(true)}
            />
          </figure>

          <EditorialDrawer editorialContext={puzzle?.editorialContext} />

          <form className="guess-form" onSubmit={handleSubmit}>
            <input
              value={guess}
              onChange={(event) => setGuess(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
              className="guess-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              placeholder="Guess the year (e.g. 1969)"
              aria-label="Guess the year"
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

          {gameState === "playing" && message ? (
            <p className="message" data-kind={gameState}>
              {message}
            </p>
          ) : null}

          {gameState === "playing" && hintHeat ? (
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
                aria-controls="yeardle-guess-history-panel"
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
              {latestAttempt ? (
                <div className="guess-history-latest">
                  <span className="guess-history-guess">{latestAttempt.guessYear}</span>
                  {isAttemptCorrect(latestAttempt, gameState, resolvedAnswer) ? (
                    <strong className="guess-history-status-correct">Correct</strong>
                  ) : (
                    <strong className="guess-history-status-wrong">Wrong</strong>
                  )}
                </div>
              ) : null}
              {isHistoryOpen && earlierAttempts.length > 0 ? (
                <ul id="yeardle-guess-history-panel" className="guess-history-list">
                  {earlierAttempts.map((attempt, index) => (
                    <li key={`${attempt.guessYear}-${index}`} className="guess-history-item">
                      <span className="guess-history-guess">{attempt.guessYear}</span>
                      {isAttemptCorrect(attempt, gameState, resolvedAnswer) ? (
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
      </main>

      {isResultOpen && gameState !== "playing" ? (
        <div className="result-modal-backdrop" onClick={() => setIsResultOpen(false)}>
          <section
            className="result-modal-panel result-outcome-panel"
            data-outcome={gameState === "won" ? "win" : "loss"}
            onClick={(event) => event.stopPropagation()}
          >
            <ResultOutcomeEffects didWin={gameState === "won"} />
            <button
              className="result-modal-close"
              type="button"
              onClick={() => setIsResultOpen(false)}
              aria-label="Close result dialog"
            >
              ×
            </button>
            <h2 className="result-modal-title">
              Result: <span className="result-modal-outcome-label" data-outcome={gameState === "won" ? "win" : "loss"}>{gameState === "won" ? "Won" : "Lost"}</span>
            </h2>
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
            {imageSrc ? (
              <AsyncImage
                src={imageSrc}
                alt={activeImage.imageAlt || "Historical event"}
                className="result-modal-image"
                overlayClassName="bg-[color:var(--surface-low)]/88 text-[color:var(--brand-strong)]"
                onError={() => setImageFailed(true)}
              />
            ) : null}
            <p className="result-modal-answer">{resultAnswerLabel}</p>
            {puzzle?.editorialContext?.description ? (
              <p className="result-modal-copy result-modal-detail">
                <strong>Description:</strong> {puzzle.editorialContext.description}
              </p>
            ) : null}
            {imageAttributionLabel ? (
              <p className="result-modal-attribution">
                Attribution: {imageAttributionLabel}
              </p>
            ) : null}
            <ResultDialogActions currentGameSlug="yeardle" onShare={handleShareResult} />
            {copyStatus ? <p className="result-modal-copy">{copyStatus}</p> : null}
          </section>
        </div>
      ) : null}

      {isHowToPlayOpen ? (
        <HowToPlayDialog
          game="yeardle"
          maxGuesses={maxGuesses}
          preview={{
            image: {
              url: imageSrc,
              alt: activeImage?.imageAlt || puzzle.imageAlt || "Historical event",
              title: eventTitleLabel,
            },
          }}
          onClose={closeHowToPlay}
        />
      ) : null}
    </div>
  );
}
