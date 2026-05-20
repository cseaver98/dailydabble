"use client";

import { useEffect, useMemo, useState } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import MainNav from "./MainNav";
import EditorialDrawer from "./EditorialDrawer";

const isValidYear = (value) => /^\d{4}$/.test(value.trim());
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

const getPerformanceLabel = (didWin, attemptsUsed, maxGuesses) => {
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

const getHeatLabel = (distanceYears) => {
  if (distanceYears <= 5) return "Very warm 🔥";
  if (distanceYears <= 15) return "Warm ☀️";
  if (distanceYears <= 40) return "Cold 🧊";
  return "Very cold 🥶";
};

export default function YeardleGameClient({
  apiUrl,
  navLabel = "Yeardle",
  hideToday = false,
  archiveHref = "/archive",
  storagePrefix = "yeardle:v1:today",
  completionPrefix = "yeardle:v1:completed",
  lockDailyCompletion = true,
}) {
  const isArchiveView = apiUrl.includes("/by-date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [gameState, setGameState] = useState("playing");
  const [message, setMessage] = useState("");
  const [resolvedAnswer, setResolvedAnswer] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [nextGameCountdown, setNextGameCountdown] = useState("");
  const contextChipLabel = isArchiveView ? "Archive game" : "Today's game";

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
          throw new Error(payload.error || "Failed to load Yeardle puzzle");
        }

        if (!active) {
          return;
        }

        setPuzzle(payload);
        setImageFailed(false);
        setGuess("");
        setAttempts([]);
        setGameState("playing");
        setMessage("");
        setResolvedAnswer("");
        setIsResultOpen(false);
        setCopyStatus("");
      } catch (loadError) {
        if (!active) {
          return;
        }
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
  }, [apiUrl]);

  const progressKey = useMemo(() => {
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
    if (!progressKey) {
      return;
    }

    const raw = window.localStorage.getItem(progressKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const parsedState = parsed.gameState;
      if (!lockDailyCompletion && (parsedState === "won" || parsedState === "lost")) {
        window.localStorage.removeItem(progressKey);
        return;
      }
      setGuess(typeof parsed.guess === "string" ? parsed.guess : "");
      setAttempts(Array.isArray(parsed.attempts) ? parsed.attempts : []);
      setGameState(parsedState === "won" || parsedState === "lost" ? parsedState : "playing");
      setMessage(typeof parsed.message === "string" ? parsed.message : "");
      setResolvedAnswer(typeof parsed.resolvedAnswer === "string" ? parsed.resolvedAnswer : "");
    } catch {
      window.localStorage.removeItem(progressKey);
    }
  }, [lockDailyCompletion, progressKey]);

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
      setResolvedAnswer(typeof parsed.resolvedAnswer === "string" ? parsed.resolvedAnswer : "");
    } catch {
      window.localStorage.removeItem(completionKey);
    }
  }, [completionKey, lockDailyCompletion, puzzle?.puzzleId]);

  useEffect(() => {
    if (!progressKey || !puzzle) {
      return;
    }

    const payload = { guess, attempts, gameState, message, resolvedAnswer };
    window.localStorage.setItem(progressKey, JSON.stringify(payload));
  }, [attempts, gameState, guess, message, progressKey, puzzle, resolvedAnswer]);

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

  const maxGuesses = Number.isFinite(puzzle?.maxGuesses) ? Number(puzzle.maxGuesses) : 5;
  const galleryImages = Array.isArray(puzzle?.galleryImages) && puzzle.galleryImages.length
    ? puzzle.galleryImages
    : [{ imageUrl: puzzle?.imageUrl, imageAlt: puzzle?.imageAlt }];
  const normalizedGallery = galleryImages.map((item, index) => ({
    imageUrl: item?.imageUrl || "/event-placeholder.svg",
    imageAlt: item?.imageAlt || `Historical event photo ${index + 1}`,
  }));
  const activeImage = normalizedGallery[0];
  const imageSrc = !imageFailed && activeImage?.imageUrl ? activeImage.imageUrl : "/event-placeholder.svg";

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!puzzle || gameState !== "playing") {
      return;
    }

    const nextGuess = guess.trim();
    if (!isValidYear(nextGuess)) {
      setMessage("Enter a 4-digit year.");
      return;
    }

    const numericGuess = Number(nextGuess);
    try {
      const response = await fetch("/api/puzzle/submit", {
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
      setGuess("");

      if (payload.isCorrect) {
        const finalMessage = `Correct. The event happened in ${payload.answerYear}. ${payload.eventTitle}`;
        setGameState("won");
        setMessage(finalMessage);
        setResolvedAnswer(`${payload.answerYear} — ${payload.eventTitle}`);
        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
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
        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
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
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : "Could not submit guess.");
    }
  };

  const resetArchivePuzzle = () => {
    if (!lockDailyCompletion) {
      setGuess("");
      setAttempts([]);
      setGameState("playing");
      setMessage("");
      setResolvedAnswer("");
      setIsResultOpen(false);
      setCopyStatus("");
      return;
    }

    setMessage("Today’s puzzle is locked after completion. Try archive games.");
  };

  const effectiveAnswer = resolvedAnswer || "Unavailable";
  const performanceLabel = getPerformanceLabel(gameState === "won", attempts.length, maxGuesses);
  const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const previousAttempt = attempts.length > 1 ? attempts[attempts.length - 2] : null;
  const earlierAttempts = attempts.length > 1 ? attempts.slice(0, -1).reverse() : [];
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
  const shareText = [
    `Yeardle ${isArchiveView ? `(Archive ${puzzle?.puzzleDate || ""})` : `(Today ${puzzle?.puzzleDate || ""})`}`.trim(),
    `${attempts.length}/${maxGuesses} tries`,
    `Answer: ${effectiveAnswer}`,
  ].join("\n");
  const handleShareResult = async () => {
    if (!shareText) {
      return;
    }
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Yeardle", text: shareText });
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

  if (loading) {
    return (
      <>
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <section className="card yeardle-card">
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
          <DailydabbleUnavailable title="Yeardle unavailable" message={error || "No puzzle available right now."} />
        </main>
      </>
    );
  }

  return (
    <>
      <MainNav label={navLabel} hideToday={hideToday} />

      <main className="container">
        <section className="card yeardle-card">
          <div className="game-meta-row">
            <span className="chip">{contextChipLabel}</span>
            <span className="chip">Attempts: {attempts.length}/{maxGuesses}</span>
          </div>

          {puzzle?.eventTitle ? <h2 className="puzzle-title">{puzzle.eventTitle}</h2> : null}

          <figure className="event-figure">
            <img
              src={imageSrc}
              alt={puzzle.imageAlt || "Historical event"}
              className="event-image"
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

          <p className="message" data-kind={gameState}>
            {message || "Guess the year to get earlier/later feedback."}
          </p>

          {gameState === "playing" && hintHeat ? (
            <div className="temperature-hint-wrap">
              <p className="temperature-hint-heat">{hintHeat}</p>
              {hintTemperature ? <p className="temperature-hint-trend">{hintTemperature}</p> : null}
            </div>
          ) : null}

          {lockDailyCompletion && !isArchiveView && gameState !== "playing" ? (
            <p className="next-game-copy">Next game in {nextGameCountdown || "--:--:--"}</p>
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
                  {latestAttempt.direction === "exact" ? (
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
                      {attempt.direction === "exact" ? (
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
            <p className="result-modal-copy">{performanceLabel}</p>
            <p className="result-modal-answer">{effectiveAnswer}</p>
            {activeImage?.imageUrl ? (
              <img
                src={activeImage.imageUrl}
                alt={activeImage.imageAlt || "Historical event"}
                className="result-modal-image"
              />
            ) : null}
            <div className="result-modal-actions">
              <button className="admin-btn-like" type="button" onClick={handleShareResult}>
                Share
              </button>
              <a className="admin-btn-like" href="https://dailydabble.app">DailyDabble</a>
              <a className="admin-btn-like primary" href={archiveHref}>Play Archive Games</a>
            </div>
            {copyStatus ? <p className="result-modal-copy">{copyStatus}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
