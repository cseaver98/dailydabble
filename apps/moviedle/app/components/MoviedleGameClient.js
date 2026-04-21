"use client";

import { useEffect, useMemo, useState } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import MainNav from "./MainNav";

const normalizeGuess = (value) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

export default function MoviedleGameClient({
  apiUrl,
  navLabel = "Moviedle",
  hideToday = false,
  archiveHref = "/archive",
  storagePrefix = "moviedle:v1:today",
  completionPrefix = "moviedle:v1:completed",
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
  const [revealedAnswer, setRevealedAnswer] = useState("");
  const [revealedDetails, setRevealedDetails] = useState(null);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [nextGameCountdown, setNextGameCountdown] = useState("");
  const [suggestions, setSuggestions] = useState([]);
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
          throw new Error(payload.error || "Failed to load Moviedle puzzle");
        }

        if (!active) {
          return;
        }

        setPuzzle(payload);
        setGuess("");
        setAttempts([]);
        setGameState("playing");
        setMessage("");
        setRevealedAnswer("");
        setRevealedDetails(null);
        setIsImageOpen(false);
        setIsResultOpen(false);
        setIsHistoryOpen(false);
        setCopyStatus("");
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load Moviedle puzzle");
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
      setRevealedAnswer(typeof parsed.revealedAnswer === "string" ? parsed.revealedAnswer : "");
      setRevealedDetails(
        parsed?.revealedDetails && typeof parsed.revealedDetails === "object" ? parsed.revealedDetails : null,
      );
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
      setRevealedAnswer(typeof parsed.revealedAnswer === "string" ? parsed.revealedAnswer : "");
      setRevealedDetails(
        parsed?.revealedDetails && typeof parsed.revealedDetails === "object" ? parsed.revealedDetails : null,
      );
    } catch {
      window.localStorage.removeItem(completionKey);
    }
  }, [completionKey, lockDailyCompletion, puzzle?.puzzleId]);

  useEffect(() => {
    if (!progressKey || !puzzle) {
      return;
    }

    const payload = { guess, attempts, gameState, message, revealedAnswer, revealedDetails };
    window.localStorage.setItem(progressKey, JSON.stringify(payload));
  }, [attempts, gameState, guess, message, progressKey, puzzle, revealedAnswer, revealedDetails]);

  useEffect(() => {
    let active = true;
    if (gameState !== "playing") {
      setSuggestions([]);
      return () => {};
    }

    const trimmed = guess.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return () => {};
    }

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/puzzle/suggest?q=${encodeURIComponent(trimmed)}&limit=8`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load suggestions");
        }
        if (!active) {
          return;
        }
        setSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
      } catch {
        if (active) {
          setSuggestions([]);
        }
      }
    }, 120);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [gameState, guess]);

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
  const stills = Array.isArray(puzzle?.stillImages) ? puzzle.stillImages : [];
  const revealedStillCount = Math.max(1, Math.min(stills.length || 1, 1 + attempts.length));
  const visibleStill = stills[Math.max(0, revealedStillCount - 1)] || null;
  const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const earlierAttempts = attempts.slice(0, -1).reverse();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!puzzle || gameState !== "playing") {
      return;
    }

    const trimmed = guess.trim();
    if (!trimmed) {
      setMessage("Enter a movie title.");
      return;
    }

    try {
      const response = await fetch("/api/puzzle/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzleId: puzzle.puzzleId,
          guessTitle: trimmed,
          guessCount: attempts.length,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to submit guess");
      }

      const nextAttempts = [
        ...attempts,
        {
          guess: trimmed,
          normalizedGuess: normalizeGuess(trimmed),
          isCorrect: Boolean(payload.isCorrect),
        },
      ];

      setAttempts(nextAttempts);
      setGuess("");
      setSuggestions([]);

      if (payload.isCorrect) {
        const title = payload.answerTitle || "the movie";
        const finalMessage = `Correct! It was ${title}.`;
        setGameState("won");
        setRevealedAnswer(title);
        setRevealedDetails(payload.answerDetails || null);
        setMessage(finalMessage);

        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
              attempts: nextAttempts,
              gameState: "won",
              message: finalMessage,
              revealedAnswer: title,
              revealedDetails: payload.answerDetails || null,
            }),
          );
        }
        return;
      }

      if (nextAttempts.length >= maxGuesses) {
        const title = payload.answerTitle || "Unavailable";
        const finalMessage = `Out of guesses. The movie was ${title}.`;
        setGameState("lost");
        setRevealedAnswer(title);
        setRevealedDetails(payload.answerDetails || null);
        setMessage(finalMessage);

        if (completionKey && lockDailyCompletion) {
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: puzzle.puzzleId,
              attempts: nextAttempts,
              gameState: "lost",
              message: finalMessage,
              revealedAnswer: title,
              revealedDetails: payload.answerDetails || null,
            }),
          );
        }
        return;
      }

      setMessage("Not quite. Another still has been revealed.");
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
      setRevealedAnswer("");
      setRevealedDetails(null);
      setIsResultOpen(false);
      setIsHistoryOpen(false);
      setCopyStatus("");
      return;
    }

    setMessage("Today’s puzzle is locked after completion. Try archive games.");
  };

  const shareText = [
    `Moviedle ${isArchiveView ? `(Archive ${puzzle?.puzzleDate || ""})` : `(Today ${puzzle?.puzzleDate || ""})`}`.trim(),
    `${attempts.length}/${maxGuesses} tries`,
    `Answer: ${revealedAnswer || revealedDetails?.title || "Unavailable"}`,
  ].join("\n");
  const handleShareResult = async () => {
    if (!shareText) {
      return;
    }
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Moviedle", text: shareText });
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
          <section className="card moviedle-card">
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
          <DailydabbleUnavailable title="Moviedle unavailable" message={error || "No puzzle available right now."} />
        </main>
      </>
    );
  }

  return (
    <>
      <MainNav label={navLabel} hideToday={hideToday} />

      <main className="container">
        <section className="card moviedle-card">
          <div className="game-meta-row">
            <span className="chip">{contextDateLabel}</span>
            <span className="chip">Attempts: {attempts.length}/{maxGuesses}</span>
            <span className="chip">Still: {revealedStillCount}/{Math.max(1, stills.length)}</span>
          </div>

          <button
            type="button"
            className="still-figure-button"
            onClick={() => setIsImageOpen(true)}
            aria-label="Open still fullscreen"
            disabled={!visibleStill}
          >
            <figure className="still-figure">
              {visibleStill ? (
                <img src={visibleStill.url} alt={visibleStill.alt || "Movie still"} className="still-image" />
              ) : (
                <p className="page-subtle">No still image available.</p>
              )}
            </figure>
          </button>

          <form className="guess-form" onSubmit={handleSubmit}>
            <input
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              className="guess-input"
              type="text"
              placeholder="Guess the movie title"
              aria-label="Guess the movie title"
              disabled={gameState !== "playing"}
              autoCapitalize="words"
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
          {gameState === "playing" && suggestions.length > 0 ? (
            <div className="suggestions-wrap" role="listbox" aria-label="Movie title suggestions">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="suggestion-item"
                  onClick={() => {
                    setGuess(item.title);
                    setSuggestions([]);
                  }}
                >
                  {item.title}
                </button>
              ))}
            </div>
          ) : null}

          <p className="message" data-kind={gameState}>
            {message || "Guess the movie. Wrong guesses reveal additional stills."}
          </p>

          {lockDailyCompletion && !isArchiveView && gameState !== "playing" ? (
            <p className="next-game-copy">Next game in {nextGameCountdown || "--:--:--"}</p>
          ) : null}

          {revealedAnswer ? (
            <p className="answer-banner">
              Answer: <strong>{revealedAnswer}</strong>
            </p>
          ) : null}

          {attempts.length > 0 ? (
            <div className="guess-history-wrap">
              <button
                type="button"
                className="guess-history-toggle"
                aria-expanded={isHistoryOpen}
                aria-controls="moviedle-guess-history-panel"
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
                  <span className="guess-history-guess">{latestAttempt.guess}</span>
                  {latestAttempt.isCorrect ? (
                    <strong className="guess-history-status-correct">Correct</strong>
                  ) : (
                    <strong className="guess-history-status-wrong">Wrong</strong>
                  )}
                </div>
              ) : null}
              {isHistoryOpen && earlierAttempts.length > 0 ? (
                <ul id="moviedle-guess-history-panel" className="guess-history-list">
                  {earlierAttempts.map((attempt, index) => (
                    <li key={`${attempt.normalizedGuess}-${index}`} className="guess-history-item">
                      <span className="guess-history-guess">{attempt.guess}</span>
                      {attempt.isCorrect ? (
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

      {isImageOpen && visibleStill ? (
        <div className="image-modal-backdrop" onClick={() => setIsImageOpen(false)}>
          <div className="image-modal-panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="image-modal-close"
              onClick={() => setIsImageOpen(false)}
              aria-label="Close image"
            >
              Close
            </button>
            <img src={visibleStill.url} alt={visibleStill.alt || "Movie still"} className="image-modal-image" />
          </div>
        </div>
      ) : null}

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
            <p className="result-modal-answer">{revealedAnswer || revealedDetails?.title || "Unknown title"}</p>
            {visibleStill ? (
              <img src={visibleStill.url} alt={visibleStill.alt || "Movie still"} className="result-modal-image" />
            ) : null}
            {Number.isFinite(revealedDetails?.releaseYear) ? (
              <p className="result-modal-copy"><strong>Year:</strong> {revealedDetails.releaseYear}</p>
            ) : null}
            {Array.isArray(revealedDetails?.leadActors) && revealedDetails.leadActors.length > 0 ? (
              <p className="result-modal-copy">
                <strong>Lead actors:</strong> {revealedDetails.leadActors.join(", ")}
              </p>
            ) : null}
            {revealedDetails?.summary ? (
              <p className="result-modal-copy">{revealedDetails.summary}</p>
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
