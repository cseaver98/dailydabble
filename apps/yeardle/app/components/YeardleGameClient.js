"use client";

import { useEffect, useMemo, useState } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import MainNav from "./MainNav";

const isValidYear = (value) => /^\d{4}$/.test(value.trim());

const buildDirectionCopy = (direction) => {
  if (direction === "earlier") {
    return "Earlier";
  }
  if (direction === "later") {
    return "Later";
  }
  return "Correct";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [gameState, setGameState] = useState("playing");
  const [message, setMessage] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

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
        setIsImageOpen(false);
        setSelectedImageIndex(0);
        setGuess("");
        setAttempts([]);
        setGameState("playing");
        setMessage("");
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
      setGuess(typeof parsed.guess === "string" ? parsed.guess : "");
      setAttempts(Array.isArray(parsed.attempts) ? parsed.attempts : []);
      setGameState(parsed.gameState === "won" || parsed.gameState === "lost" ? parsed.gameState : "playing");
      setMessage(typeof parsed.message === "string" ? parsed.message : "");
    } catch {
      window.localStorage.removeItem(progressKey);
    }
  }, [progressKey]);

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
    if (!progressKey || !puzzle) {
      return;
    }

    const payload = { guess, attempts, gameState, message };
    window.localStorage.setItem(progressKey, JSON.stringify(payload));
  }, [attempts, gameState, guess, message, progressKey, puzzle]);

  useEffect(() => {
    if (!isImageOpen) {
      return;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsImageOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isImageOpen]);

  const maxGuesses = Number.isFinite(puzzle?.maxGuesses) ? Number(puzzle.maxGuesses) : 5;
  const guessesLeft = Math.max(0, maxGuesses - attempts.length);
  const hints = Array.isArray(puzzle?.hints) ? puzzle.hints : [];
  const revealedHintCount = Math.min(maxGuesses, attempts.length);
  const visibleHints = hints.slice(0, revealedHintCount);
  const galleryImages = Array.isArray(puzzle?.galleryImages) && puzzle.galleryImages.length
    ? puzzle.galleryImages
    : [{ imageUrl: puzzle?.imageUrl, imageAlt: puzzle?.imageAlt }];
  const normalizedGallery = galleryImages.map((item, index) => ({
    imageUrl: item?.imageUrl || "/event-placeholder.svg",
    imageAlt: item?.imageAlt || `Historical event photo ${index + 1}`,
  }));
  const canNavigateGallery = normalizedGallery.length > 1;
  const activeImage = normalizedGallery[selectedImageIndex] ?? normalizedGallery[0];
  const imageSrc = !imageFailed && activeImage?.imageUrl ? activeImage.imageUrl : "/event-placeholder.svg";

  useEffect(() => {
    if (selectedImageIndex < normalizedGallery.length) {
      return;
    }
    setSelectedImageIndex(Math.max(0, normalizedGallery.length - 1));
  }, [normalizedGallery.length, selectedImageIndex]);

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
      };

      const nextAttempts = [...attempts, attempt];
      setAttempts(nextAttempts);
      setGuess("");

      if (payload.isCorrect) {
        const finalMessage = `Correct. The event happened in ${payload.answerYear}. ${payload.eventTitle}`;
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
        const finalMessage = `Out of guesses. The year was ${payload.answerYear}. ${payload.eventTitle}`;
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

      setMessage(`Try ${payload.direction}. Hint unlocked.`);
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
      return;
    }

    setMessage("Today’s puzzle is locked after completion. Try archive games.");
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
            <span className="chip">Attempts: {attempts.length}/{maxGuesses}</span>
            <span className="chip">Remaining: {guessesLeft}</span>
            <span className="chip">Date: {puzzle.puzzleDate}</span>
          </div>

          <button
            type="button"
            className="event-figure-button"
            onClick={() => setIsImageOpen(true)}
            aria-label="Open image fullscreen"
          >
            <figure className="event-figure">
              <img
                src={imageSrc}
                alt={puzzle.imageAlt || "Historical event"}
                className="event-image"
                onError={() => setImageFailed(true)}
              />
            </figure>
          </button>

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
            <button className="guess-submit-btn" type="submit" disabled={gameState !== "playing"}>
              Guess
            </button>
          </form>

          <p className="message" data-kind={gameState}>
            {message || "Guess the year to unlock earlier/later feedback and new hints."}
          </p>

          {attempts.length > 0 ? (
            <div className="guess-history-wrap">
              <p className="guess-history-title">Guess History</p>
              <ul className="guess-history-list">
                {attempts.map((attempt, index) => (
                  <li key={`${attempt.guessYear}-${index}`} className="guess-history-item">
                    <span>{attempt.guessYear}</span>
                    <strong>{buildDirectionCopy(attempt.direction)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="hints-wrap">
            <p className="guess-history-title">Hints</p>
            <ul className="hints-list">
              {visibleHints.map((hint, index) => (
                <li className="hint-item" key={`${hint.label}-${index}`}>
                  <span className="hint-label">{hint.label}</span>
                  <span>{hint.value}</span>
                </li>
              ))}
            </ul>
          </div>

          {gameState !== "playing" ? (
            <div className="post-actions">
              <button className="admin-btn-like" type="button" onClick={resetArchivePuzzle}>
                {lockDailyCompletion ? "Today Locked" : "Play Again"}
              </button>
              <a className="admin-btn-like primary" href={archiveHref}>Play Archive Games</a>
            </div>
          ) : null}
        </section>
      </main>

      {isImageOpen ? (
        <div className="image-modal-backdrop" onClick={() => setIsImageOpen(false)}>
          <div className="image-modal-stage" onClick={(event) => event.stopPropagation()}>
            {canNavigateGallery ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedImageIndex((current) => (current - 1 + normalizedGallery.length) % normalizedGallery.length)
                  }
                  className="image-modal-nav image-modal-prev"
                  aria-label="Previous photo"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedImageIndex((current) => (current + 1) % normalizedGallery.length)}
                  className="image-modal-nav image-modal-next"
                  aria-label="Next photo"
                >
                  ›
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="image-modal-close"
              onClick={() => setIsImageOpen(false)}
              aria-label="Close image"
            >
              ×
            </button>
            <div className="image-modal-viewport">
              <img
                src={imageSrc}
                alt={activeImage?.imageAlt || puzzle.imageAlt || "Historical event"}
                className="image-modal-image"
                onError={() => setImageFailed(true)}
              />
            </div>
            <p className="image-modal-caption">
              Photo {Math.min(selectedImageIndex + 1, normalizedGallery.length)} of {normalizedGallery.length}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
