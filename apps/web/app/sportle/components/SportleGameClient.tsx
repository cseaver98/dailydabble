"use client";

import { trackGameStarted } from "../../../lib/analytics-client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import MainNav from "./MainNav";
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

const CLUE_TILE_COUNT = 6;
const CLUE_FLIP_DURATION_MS = 640;
const CLUE_FLIP_STAGGER_MS = 160;
type SportleGameClientProps = {
  apiUrl: string;
  navLabel?: string;
  hideToday?: boolean;
  archiveHref?: string;
  storagePrefix?: string;
  completionPrefix?: string;
  lockDailyCompletion?: boolean;
};
type Attempt = { guess: string; isCorrect?: boolean };
type SportleGameState = "playing" | "won" | "lost";
type SportlePuzzle = {
  puzzleId: string;
  puzzleDate: string;
  archiveGameNumber?: number;
  maxGuesses: number;
  clues: Array<{ label: string; value: string; logoUrl?: string | null; imageUrl?: string | null }>;
};
type RestoredSportleState = {
  guess: string;
  attempts: Attempt[];
  gameState: SportleGameState;
  message: string;
  resolvedAnswer: string;
  isResultOpen: boolean;
};


const getDefaultRestoredSportleState = (): RestoredSportleState => ({
  guess: "",
  attempts: [],
  gameState: "playing",
  message: "",
  resolvedAnswer: "",
  isResultOpen: false,
});

const restoreSportleState = ({
  puzzleId,
  progressKey,
  completionKey,
  lockDailyCompletion,
}: {
  puzzleId: string;
  progressKey: string;
  completionKey: string;
  lockDailyCompletion: boolean;
}): RestoredSportleState => {
  const parseStored = (raw: string, key: string): RestoredSportleState => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.puzzleId && parsed.puzzleId !== puzzleId) {
        return getDefaultRestoredSportleState();
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
      return getDefaultRestoredSportleState();
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
    return getDefaultRestoredSportleState();
  }

  const restored = parseStored(raw, progressKey);
  if (!lockDailyCompletion && restored.gameState !== "playing") {
    window.localStorage.removeItem(progressKey);
    return getDefaultRestoredSportleState();
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

const normalizeGuessName = (value: string) => value.trim().toLowerCase();

export default function SportleGameClient({
  apiUrl,
  navLabel = "Sportle",
  hideToday = false,
  archiveHref = "/sportle/archive",
  storagePrefix = "sportle:v1:today",
  completionPrefix = "sportle:v1:completed",
  lockDailyCompletion = true,
}: SportleGameClientProps) {
  const isArchiveView = apiUrl.includes("/by-date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState<SportlePuzzle | null>(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [gameState, setGameState] = useState<SportleGameState>("playing");
  const [message, setMessage] = useState("");
  const [resolvedAnswer, setResolvedAnswer] = useState("");
  const [isResultOpen, setIsResultOpen] = useState(false);
  const { isHowToPlayOpen, openHowToPlay, closeHowToPlay } = useHowToPlayDialog("sportle", Boolean(puzzle) && !loading);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [archiveLock, setArchiveLock] = useState<{ title: string; description: string; mode?: "password" | "subscription" } | null>(null);
  const [animatingClueIndexes, setAnimatingClueIndexes] = useState<number[]>([]);
  const [visibleClueCountOverride, setVisibleClueCountOverride] = useState<number | null>(null);
  const clueAnimationTimeoutRef = useRef<number | null>(null);
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
          throw new Error(payload.error || "Failed to load Sportle puzzle");
        }

        if (!active) {
          return;
        }

        const progressKey = `${storagePrefix}:${payload.puzzleId}`;
        const completionKey = `${completionPrefix}:${payload.puzzleId}`;
        const storedResult = await fetchStoredGameResult({
          gameSlug: "sportle",
          puzzleId: payload.puzzleId,
          puzzleDate: payload.puzzleDate,
          isArchive: isArchiveView,
        });
        if (storedResult) {
          const answer = getResultPayloadAnswer(storedResult);
          const answerName = typeof answer.name === "string" ? answer.name : "";
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: payload.puzzleId,
              guess: "",
              attempts: getResultPayloadAttempts(storedResult),
              gameState: storedResult.isWin ? "won" : "lost",
              message: storedResult.isWin ? `Correct. Athlete: ${answerName}` : `Out of guesses. Athlete: ${answerName}`,
              resolvedAnswer: answerName,
            }),
          );
        }

        const restoredState = restoreSportleState({
          puzzleId: payload.puzzleId,
          progressKey,
          completionKey,
          lockDailyCompletion,
        });
        setPuzzle(payload);
        setArchiveLock(null);
        setGuess(restoredState.guess);
        setAttempts(restoredState.attempts);
        setGameState(restoredState.gameState);
        setMessage(restoredState.message);
        setResolvedAnswer(restoredState.resolvedAnswer);
        setIsResultOpen(restoredState.isResultOpen);
        setIsHistoryOpen(false);
        setCopyStatus("");
        setAnimatingClueIndexes([]);
        setVisibleClueCountOverride(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setArchiveLock(null);
        setError(loadError instanceof Error ? loadError.message : "Failed to load Sportle puzzle");
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

  useEffect(() => () => {
    if (clueAnimationTimeoutRef.current) {
      window.clearTimeout(clueAnimationTimeoutRef.current);
    }
  }, []);

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

    window.localStorage.setItem(progressKey, JSON.stringify({ guess, attempts, gameState, message, resolvedAnswer }));
  }, [attempts, gameState, guess, message, progressKey, puzzle, resolvedAnswer]);

  const clues = Array.isArray(puzzle?.clues) ? (puzzle?.clues ?? []) : [];
  const targetVisibleClueCount =
    gameState === "won" ? clues.length : Math.min(clues.length, 1 + attempts.length);
  const visibleClueCount = visibleClueCountOverride ?? targetVisibleClueCount;


  const maxGuesses = Number.isFinite(puzzle?.maxGuesses) ? Number(puzzle?.maxGuesses) : 6;
  const isClueAnimationActive = animatingClueIndexes.length > 0;
  const queueClueFlip = (fromIndex: number, toIndexExclusive: number, openResultWhenDone = false) => {
    const nextIndexes = Array.from(
      { length: Math.max(0, toIndexExclusive - fromIndex) },
      (_, offset) => fromIndex + offset,
    ).filter((index) => index < clues.length);

    if (nextIndexes.length === 0) {
      setVisibleClueCountOverride(null);
      return;
    }

    if (clueAnimationTimeoutRef.current) {
      window.clearTimeout(clueAnimationTimeoutRef.current);
    }

    setVisibleClueCountOverride(toIndexExclusive);
    setAnimatingClueIndexes(nextIndexes);
    clueAnimationTimeoutRef.current = window.setTimeout(() => {
      setAnimatingClueIndexes([]);
      setVisibleClueCountOverride(null);
      if (openResultWhenDone) {
        setIsResultOpen(true);
      }
      clueAnimationTimeoutRef.current = null;
    }, CLUE_FLIP_DURATION_MS + CLUE_FLIP_STAGGER_MS * Math.max(0, nextIndexes.length - 1) + 80);
  };

  const clueTiles = Array.from({ length: CLUE_TILE_COUNT }, (_, index) => {
    const clue = clues[index] || null;
    const animationOrder = animatingClueIndexes.indexOf(index);
    return {
      index,
      clue,
      isRevealed: Boolean(clue) && index < visibleClueCount,
      isAnimating: animationOrder !== -1,
      animationDelay: animationOrder >= 0 ? animationOrder * CLUE_FLIP_STAGGER_MS : 0,
    };
  });
  const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const earlierAttempts = attempts.slice(0, -1).reverse();
  const isAttemptCorrect = (attempt: Attempt | null) => {
    if (!attempt) {
      return false;
    }
    if (typeof attempt.isCorrect === "boolean") {
      return attempt.isCorrect;
    }
    if (gameState !== "won" || !resolvedAnswer) {
      return false;
    }
    return normalizeGuessName(attempt.guess) === normalizeGuessName(resolvedAnswer);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!puzzle || gameState !== "playing") {
      return;
    }

    const guessName = guess.trim();
    if (!guessName) {
      setMessage("Select an athlete guess.");
      return;
    }

    trackGameStarted("sportle", puzzle.puzzleDate, isArchiveView);

    try {
      const response = await fetch("/api/sportle/puzzle/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.puzzleId, guessName }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not submit guess");
      }

      const nextAttempts = [
        ...attempts,
        {
          guess: payload.guess,
          isCorrect: Boolean(payload.isCorrect),
        },
      ];
      const currentRevealedHintCount = visibleClueCount;

      setAttempts(nextAttempts);

      if (payload.isCorrect) {
        queueClueFlip(currentRevealedHintCount, clues.length, true);
        const finalMessage = `Correct. Athlete: ${payload.answerName}`;
        setGameState("won");
        setMessage(finalMessage);
        setResolvedAnswer(payload.answerName || "");
        setIsResultOpen(false);
        recordGameCompletionQuietly({
          gameSlug: "sportle",
          puzzleId: puzzle.puzzleId,
          puzzleDate: puzzle.puzzleDate,
          isArchive: isArchiveView,
          isWin: true,
          guessesUsed: nextAttempts.length,
          maxGuesses,
          resultPayload: buildResultPayload({
            attempts: nextAttempts,
            answer: { name: payload.answerName },
            final: { guess: payload.guess, isCorrect: true },
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
              guess: guessName,
              attempts: nextAttempts,
              gameState: "won",
              message: finalMessage,
              resolvedAnswer: payload.answerName || "",
            }),
          );
        }
        return;
      }

      queueClueFlip(currentRevealedHintCount, Math.min(clues.length, 1 + nextAttempts.length));

      if (nextAttempts.length >= maxGuesses) {
        const finalMessage = `Out of guesses. Athlete: ${payload.answerName}`;
        setGameState("lost");
        setMessage(finalMessage);
        setResolvedAnswer(payload.answerName || "");
        setIsResultOpen(true);
        recordGameCompletionQuietly({
          gameSlug: "sportle",
          puzzleId: puzzle.puzzleId,
          puzzleDate: puzzle.puzzleDate,
          isArchive: isArchiveView,
          isWin: false,
          guessesUsed: nextAttempts.length,
          maxGuesses,
          resultPayload: buildResultPayload({
            attempts: nextAttempts,
            answer: { name: payload.answerName },
            final: { guess: payload.guess, isCorrect: false },
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
              guess: guessName,
              attempts: nextAttempts,
              gameState: "lost",
              message: finalMessage,
              resolvedAnswer: payload.answerName || "",
            }),
          );
        }
        return;
      }

      setMessage("Incorrect. Another clue unlocked.");
      setGuess("");
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : "Could not submit guess");
    }
  };

  const effectiveAnswer = resolvedAnswer || "Unavailable";
  const performanceLabel = getPerformanceLabel(gameState === "won", attempts.length, maxGuesses);
  const headshotClue = clues.find((clue) => typeof clue?.imageUrl === "string" && clue.imageUrl);
  const answerImageUrl = typeof headshotClue?.imageUrl === "string" ? headshotClue.imageUrl : "";
  const shareText = buildGameShareText({
    gameName: "Sportle",
    isArchiveView,
    puzzleDate: puzzle?.puzzleDate,
    didWin: gameState === "won",
    guessesUsed: attempts.length,
    maxGuesses,
    url: toPublicAppUrl("/sportle"),
  });
  const handleShareResult = async () => {
    const shareResult = await shareResultText("Sportle", shareText);
    if (shareResult === "shared") setCopyStatus("Shared");
    if (shareResult === "copied") setCopyStatus("Copied to clipboard");
    if (shareResult === "failed") setCopyStatus("Share failed");
  };

  if (loading) {
    return (
      <div className="sportle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <section className="card sportle-card">
            <p className="page-title" role="status"><LoadingLabel text="Loading puzzle" /></p>
          </section>
        </main>
      </div>
    );
  }

  if (archiveLock) {
    return (
      <div className="sportle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <ArchiveLockGate archiveHref={archiveHref} title={archiveLock.title} description={archiveLock.description} mode={archiveLock.mode} />
        </main>
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="sportle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <DailydabbleUnavailable title="Sportle unavailable" message={error || "No puzzle available right now."} />
        </main>
      </div>
    );
  }

  return (
    <div className="sportle-shell">
      <MainNav label={navLabel} hideToday={hideToday} />

      <main className="container">
        <section className="card sportle-card">
          <div className="game-meta-row">
            <span className="chip">{statusChipLabel}</span>
            <GuessProgressChip used={attempts.length} total={maxGuesses} />
            <button className="how-to-play-btn" type="button" onClick={openHowToPlay}>
              ? How to play
            </button>
          </div>

          <div className="hints-wrap">
            <ul className="clues-grid">
              {clueTiles.map(({ index, clue, isRevealed, isAnimating, animationDelay }) => (
                <li
                  key={`clue-tile-${index}`}
                  className={`clue-tile ${isRevealed ? "is-revealed" : "is-locked"} ${isAnimating ? "reveal" : ""}`}
                  style={
                    isAnimating
                      ? ({
                          "--flip-delay": `${animationDelay}ms`,
                          "--flip-duration": `${CLUE_FLIP_DURATION_MS}ms`,
                        } as CSSProperties)
                      : undefined
                  }
                >
                  <div className="clue-tile-inner">
                    <div className="clue-tile-face clue-tile-front">
                      <span className="hint-label">Clue {index + 1}</span>
                      <span className="clue-lock-copy">Locked</span>
                    </div>
                    <div className="clue-tile-face clue-tile-back">
                      {clue ? (
                        <>
                          {index === 0 ? <span className="hint-label">TEAM</span> : clue.imageUrl ? <span className="hint-label">PHOTO</span> : <span className="hint-label">{clue.label}</span>}
                          {index === 0 && clue.logoUrl ? (
                            <div className="clue-team-row">
                              <AsyncImage
                                src={clue.logoUrl}
                                alt={clue.value || "Team logo"}
                                className="team-logo"
                                wrapperClassName="clue-media-frame clue-logo-frame"
                                overlayClassName="clue-image-loading-overlay"
                                spinnerClassName="clue-image-spinner"
                              />
                              <span className="clue-value">{clue.value}</span>
                            </div>
                          ) : clue.imageUrl ? (
                            <div className="clue-team-row clue-image-row">
                              <AsyncImage
                                src={clue.imageUrl}
                                alt={clue.value || "Athlete headshot"}
                                className="team-logo headshot-logo"
                                wrapperClassName="clue-media-frame clue-headshot-frame"
                                overlayClassName="clue-image-loading-overlay"
                                spinnerClassName="clue-image-spinner"
                              />
                            </div>
                          ) : (
                            <span className="clue-value">{clue?.value}</span>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <form className="guess-form" onSubmit={onSubmit}>
            <input
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              className="guess-input"
              type="text"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Guess the athlete"
              aria-label="Guess athlete"
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
                onClick={() => setIsResultOpen(true)}
                disabled={gameState === "won" && isClueAnimationActive}
              >
                Review result
              </button>
            )}
          </form>

          {gameState === "playing" ? (
            <p className="message" data-kind={gameState}>
              {message || "Start with clue 1. Wrong guesses unlock more clues."}
            </p>
          ) : null}
          <div className="guess-history-wrap">
            <button
              type="button"
              className="guess-history-toggle"
              aria-expanded={isHistoryOpen}
              aria-controls="sportle-guess-history-panel"
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
                {isAttemptCorrect(latestAttempt) ? (
                  <strong className="guess-history-status-correct">Correct</strong>
                ) : (
                  <strong className="guess-history-status-wrong">Wrong</strong>
                )}
              </div>
            ) : (
              <div className="guess-history-latest">
                <span className="guess-history-guess">No guesses yet.</span>
              </div>
            )}
            {isHistoryOpen && earlierAttempts.length > 0 ? (
              <ul id="sportle-guess-history-panel" className="guess-history-list">
                {earlierAttempts.map((attempt, index) => (
                  <li key={`${attempt.guess}-${index}`} className="guess-history-item">
                    <span className="guess-history-guess">{attempt.guess}</span>
                    {isAttemptCorrect(attempt) ? (
                      <strong className="guess-history-status-correct">Correct</strong>
                    ) : (
                      <strong className="guess-history-status-wrong">Wrong</strong>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

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
            {answerImageUrl ? (
              <AsyncImage
                src={answerImageUrl}
                alt={effectiveAnswer}
                className="result-modal-image"
                wrapperClassName="result-modal-image-frame"
                overlayClassName="result-modal-image-loading-overlay"
                spinnerClassName="result-modal-image-spinner"
              />
            ) : null}
            <p className="result-modal-answer">{effectiveAnswer}</p>
            <ResultDialogActions currentGameSlug="sportle" onShare={handleShareResult} />
            {copyStatus ? <p className="result-modal-copy">{copyStatus}</p> : null}
          </section>
        </div>
      ) : null}

      {isHowToPlayOpen ? (
        <HowToPlayDialog
          game="sportle"
          maxGuesses={maxGuesses}
          onClose={closeHowToPlay}
        />
      ) : null}
    </div>
  );
}
