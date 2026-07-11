"use client";

import { trackGameStarted } from "../../../lib/analytics-client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import ArchiveLockGate from "../../components/ArchiveLockGate";
import HowToPlayDialog from "../../components/HowToPlayDialog";
import LoadingLabel from "../../components/LoadingLabel";
import ResultDialogActions from "../../components/ResultDialogActions";
import EquadleCalculator from "./EquadleCalculator";
import MainNav from "./MainNav";
import { toPublicAppUrl } from "../../../lib/app-url";
import { recordGameCompletionQuietly } from "../../../lib/record-game-completion";
import { buildResultPayload } from "../../../lib/result-payload";
import { buildGameShareText, shareResultText } from "../../../lib/share-results";
import { fetchStoredGameResult, getResultPayloadAnswer, getResultPayloadAttempts } from "../../../lib/stored-game-result";
import { useNextGameCountdown } from "../../../lib/use-next-game-countdown";

const FLIP_DURATION_MS = 260;
const FLIP_STAGGER_MS = 208;
const KEY_ROWS = [
  ["7", "8", "9", "/"],
  ["4", "5", "6", "*"],
  ["1", "2", "3", "-"],
  ["Enter", "0", "Backspace", "+"],
];
const DISPLAY_OPERATORS: Record<string, string> = {
  "*": "×",
  "/": "÷",
};
const KEY_STRENGTH: Record<string, number> = {
  empty: 0,
  absent: 1,
  present: 2,
  correct: 3,
};
type EquadleGameClientProps = {
  apiUrl: string;
  navLabel?: string;
  hideToday?: boolean;
  archiveHref?: string;
  storagePrefix?: string;
  completionPrefix?: string;
  lockDailyCompletion?: boolean;
};
type EquadlePuzzle = {
  puzzleId: string;
  puzzleDate: string;
  archiveGameNumber?: number;
  equationLength: number;
  equalsIndex: number;
  maxGuesses: number;
  answer?: string;
};
type Attempt = {
  guess: string;
  feedback: string[];
};
type EquadleGameState = "playing" | "won" | "lost";
type RestoredEquadleState = {
  guess: string;
  attempts: Attempt[];
  gameState: EquadleGameState;
  message: string;
  resolvedAnswer: string;
  isResultOpen: boolean;
};

const normalizeEquationInput = (value: string) =>
  String(value || "")
    .replace(/[xX×]/g, "*")
    .replace(/÷/g, "/");

const toDisplayEquationChar = (char: string) => DISPLAY_OPERATORS[char] || char;

const isDisplayOperatorChar = (char: string) => ["+", "-", "×", "÷"].includes(char);

const toDisplayEquation = (value: string) =>
  String(value || "")
    .split("")
    .map(toDisplayEquationChar)
    .join("");

const toShareEquationBlock = (char: string, feedback: string) => {
  if (char === "=") return "=";
  if (feedback === "correct") return "🟩";
  if (feedback === "present") return "🟨";
  return "⬛";
};

const buildEquationShareRows = (attempts: Attempt[]) =>
  attempts.map((attempt) =>
    attempt.guess
      .split("")
      .map((char, index) => toShareEquationBlock(char, attempt.feedback[index] || "absent"))
      .join(""),
  );

const sanitizeEquationInput = (value: string, maxLength: number) =>
  normalizeEquationInput(value)
    .replace(/\s+/g, "")
    .replace(/[^0-9+\-*/]/g, "")
    .slice(0, maxLength);

const buildFullGuess = (inputValue: string, equationLength: number, equalsIndex: number) => {
  const chars = [];
  let inputIndex = 0;
  const safeValue = String(inputValue || "");
  for (let index = 0; index < equationLength; index += 1) {
    if (index === equalsIndex) {
      chars.push("=");
      continue;
    }
    chars.push(safeValue[inputIndex] || "");
    inputIndex += 1;
  }
  return chars.join("");
};

const getDefaultRestoredEquadleState = (): RestoredEquadleState => ({
  guess: "",
  attempts: [],
  gameState: "playing",
  message: "",
  resolvedAnswer: "",
  isResultOpen: false,
});

const restoreEquadleState = ({
  puzzleId,
  progressKey,
  completionKey,
  lockDailyCompletion,
}: {
  puzzleId: string;
  progressKey: string;
  completionKey: string;
  lockDailyCompletion: boolean;
}): RestoredEquadleState => {
  if (lockDailyCompletion) {
    const completionRaw = window.localStorage.getItem(completionKey);
    if (completionRaw) {
      try {
        const parsed = JSON.parse(completionRaw);
        if (parsed?.puzzleId === puzzleId) {
          const gameState = parsed.gameState === "won" || parsed.gameState === "lost" ? parsed.gameState : "playing";
          return {
            guess: "",
            attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
            gameState,
            message: typeof parsed.message === "string" ? parsed.message : "",
            resolvedAnswer: typeof parsed.resolvedAnswer === "string" ? parsed.resolvedAnswer : "",
            isResultOpen: gameState !== "playing",
          };
        }
      } catch {
        window.localStorage.removeItem(completionKey);
      }
    }
  }

  const raw = window.localStorage.getItem(progressKey);
  if (!raw) {
    return getDefaultRestoredEquadleState();
  }

  try {
    const parsed = JSON.parse(raw);
    const parsedState = parsed.gameState;
    if (!lockDailyCompletion && (parsedState === "won" || parsedState === "lost")) {
      window.localStorage.removeItem(progressKey);
      return getDefaultRestoredEquadleState();
    }
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
    window.localStorage.removeItem(progressKey);
    return getDefaultRestoredEquadleState();
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

export default function EquadleGameClient({
  apiUrl,
  navLabel = "Equadle",
  hideToday = false,
  archiveHref = "/equadle/archive",
  storagePrefix = "equadle:v1:today",
  completionPrefix = "equadle:v1:completed",
  lockDailyCompletion = true,
}: EquadleGameClientProps) {
  const isArchiveView = apiUrl.includes("/by-date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState<EquadlePuzzle | null>(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [gameState, setGameState] = useState<EquadleGameState>("playing");
  const [message, setMessage] = useState("");
  const [resolvedAnswer, setResolvedAnswer] = useState("");
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [revealingRowIndex, setRevealingRowIndex] = useState<number | null>(null);
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
          throw new Error(payload.error || "Failed to load Equadle puzzle");
        }

        if (!active) {
          return;
        }

        const progressKey = `${storagePrefix}:${payload.puzzleId}`;
        const completionKey = `${completionPrefix}:${payload.puzzleId}`;
        const storedResult = await fetchStoredGameResult({
          gameSlug: "equadle",
          puzzleId: payload.puzzleId,
          puzzleDate: payload.puzzleDate,
          isArchive: isArchiveView,
        });
        if (storedResult) {
          const answer = getResultPayloadAnswer(storedResult);
          window.localStorage.setItem(
            completionKey,
            JSON.stringify({
              puzzleId: payload.puzzleId,
              attempts: getResultPayloadAttempts(storedResult),
              gameState: storedResult.isWin ? "won" : "lost",
              message: "",
              resolvedAnswer: typeof answer.equation === "string" ? answer.equation : payload.equation,
            }),
          );
        }

        const restoredState = restoreEquadleState({
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
        setIsHowToPlayOpen(false);
        setRevealingRowIndex(null);
        setCopyStatus("");
      } catch (loadError) {
        if (!active) {
          return;
        }
        setArchiveLock(null);
        setError(loadError instanceof Error ? loadError.message : "Failed to load Equadle puzzle");
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

    window.localStorage.setItem(
      progressKey,
      JSON.stringify({ guess, attempts, gameState, message, resolvedAnswer }),
    );
  }, [attempts, gameState, guess, message, progressKey, puzzle, resolvedAnswer]);

  useEffect(() => {
    if (gameState === "playing" || revealingRowIndex === null) {
      return;
    }

    const revealLength = Number.isFinite(puzzle?.equationLength) ? Number(puzzle?.equationLength) : 8;
    const revealTotalMs = Math.max(0, (revealLength - 1) * FLIP_STAGGER_MS + FLIP_DURATION_MS);
    const timeoutId = window.setTimeout(() => setIsResultOpen(true), revealTotalMs);
    return () => window.clearTimeout(timeoutId);
  }, [gameState, puzzle?.equationLength, revealingRowIndex]);


  const maxGuesses = Number.isFinite(puzzle?.maxGuesses) ? Number(puzzle?.maxGuesses) : 6;
  const equationLength = Number.isFinite(puzzle?.equationLength) ? Number(puzzle?.equationLength) : 8;
  const equalsIndex = Number.isFinite(puzzle?.equalsIndex)
    ? Number(puzzle?.equalsIndex)
    : 4;
  const guessInputLength = Math.max(1, equationLength - 1);

  const boardRows = useMemo(() => {
    const rows = attempts.map((attempt) =>
      attempt.guess.split("").map((char, index) => ({
        char: toDisplayEquationChar(char),
        state: index === equalsIndex ? "locked" : (attempt.feedback[index] || "absent"),
      })),
    );

    if (gameState === "playing") {
      const draft = [];
      let guessCursor = 0;
      for (let index = 0; index < equationLength; index += 1) {
        if (index === equalsIndex) {
          draft.push({ char: "=", state: "locked" });
          continue;
        }
        const nextChar = guess[guessCursor] || "";
        draft.push({ char: nextChar ? toDisplayEquationChar(nextChar) : "", state: nextChar ? "draft" : "empty" });
        guessCursor += 1;
      }

      rows.push(draft);
    }

    while (rows.length < maxGuesses) {
      const emptyRow = [];
      for (let index = 0; index < equationLength; index += 1) {
        emptyRow.push(index === equalsIndex ? { char: "=", state: "locked" } : { char: "", state: "empty" });
      }
      rows.push(emptyRow);
    }

    return rows;
  }, [attempts, equationLength, equalsIndex, gameState, guess, maxGuesses]);

  const keyStates = useMemo(() => {
    const states = new Map();
    for (const attempt of attempts) {
      const chars = String(attempt?.guess || "").split("");
      const feedback = Array.isArray(attempt?.feedback) ? attempt.feedback : [];
      for (let index = 0; index < chars.length; index += 1) {
        const key = chars[index];
        const nextState = feedback[index] || "absent";
        const currentState = states.get(key) || "empty";
        if ((KEY_STRENGTH[nextState] || 0) > (KEY_STRENGTH[currentState] || 0)) {
          states.set(key, nextState);
        }
      }
    }
    return states;
  }, [attempts]);

  const canSubmitGuess = gameState === "playing" && guess.length === guessInputLength;
  const canDeleteGuess = gameState === "playing" && guess.length > 0;

  const appendGuessChar = useCallback((char: string) => {
    if (gameState !== "playing" || isCalculatorOpen) {
      return;
    }
    setGuess((current) => sanitizeEquationInput(`${current}${normalizeEquationInput(char)}`, guessInputLength));
  }, [gameState, guessInputLength, isCalculatorOpen]);

  const removeGuessChar = useCallback(() => {
    if (gameState !== "playing" || isCalculatorOpen) {
      return;
    }
    setGuess((current) => current.slice(0, -1));
  }, [gameState, isCalculatorOpen]);

  const onSubmit = useCallback(async (event: { preventDefault: () => void }) => {
    event.preventDefault();

    if (!puzzle || gameState !== "playing") {
      return;
    }

    const guessEquation = buildFullGuess(guess.trim(), equationLength, equalsIndex);
    trackGameStarted("equadle", puzzle.puzzleDate, isArchiveView);
    try {
      const response = await fetch("/api/equadle/puzzle/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.puzzleId, guessEquation }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Guess must be a valid equation");
      }

      const nextAttempts = [
        ...attempts,
        {
          guess: payload.guess,
          feedback: Array.isArray(payload.feedback) ? payload.feedback : [],
        },
      ];

      setAttempts(nextAttempts);
      setRevealingRowIndex(nextAttempts.length - 1);
      setGuess("");
      setIsResultOpen(false);

      if (payload.isCorrect) {
        setGameState("won");
        setMessage("");
        setResolvedAnswer(payload.answer || "");
        recordGameCompletionQuietly({
          gameSlug: "equadle",
          puzzleId: puzzle.puzzleId,
          puzzleDate: puzzle.puzzleDate,
          isArchive: isArchiveView,
          isWin: true,
          guessesUsed: nextAttempts.length,
          maxGuesses,
          resultPayload: buildResultPayload({
            attempts: nextAttempts,
            answer: { equation: toDisplayEquation(payload.answer || "") },
            final: { guess: toDisplayEquation(payload.guess || ""), feedback: nextAttempts.at(-1)?.feedback ?? [] },
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
              attempts: nextAttempts,
              gameState: "won",
              message: "",
              resolvedAnswer: payload.answer || "",
            }),
          );
        }
        return;
      }

      if (nextAttempts.length >= maxGuesses) {
        setGameState("lost");
        setMessage("");
        setResolvedAnswer(payload.answer || "");
        recordGameCompletionQuietly({
          gameSlug: "equadle",
          puzzleId: puzzle.puzzleId,
          puzzleDate: puzzle.puzzleDate,
          isArchive: isArchiveView,
          isWin: false,
          guessesUsed: nextAttempts.length,
          maxGuesses,
          resultPayload: buildResultPayload({
            attempts: nextAttempts,
            answer: { equation: toDisplayEquation(payload.answer || "") },
            final: { guess: toDisplayEquation(payload.guess || ""), feedback: nextAttempts.at(-1)?.feedback ?? [] },
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
              attempts: nextAttempts,
              gameState: "lost",
              message: "",
              resolvedAnswer: payload.answer || "",
            }),
          );
        }
        return;
      }

    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : "Guess must be a valid equation");
    }
  }, [attempts, completionKey, equationLength, equalsIndex, gameState, guess, isArchiveView, lockDailyCompletion, maxGuesses, puzzle]);

  useEffect(() => {
    if (gameState !== "playing" || isCalculatorOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (key === "Enter") {
        event.preventDefault();
        if (canSubmitGuess) {
          void onSubmit(event);
        }
        return;
      }
      if (key === "Backspace" || key === "Delete") {
        event.preventDefault();
        removeGuessChar();
        return;
      }
      if (/^[0-9+\-*/xX×÷]$/.test(key)) {
        event.preventDefault();
        appendGuessChar(key);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appendGuessChar, canSubmitGuess, gameState, isCalculatorOpen, onSubmit, removeGuessChar]);

  const answerEquation = resolvedAnswer || puzzle?.answer || "";
  const effectiveAnswer = answerEquation || "Unavailable";
  const displayEffectiveAnswer = toDisplayEquation(effectiveAnswer);
  const resultEquationTiles = answerEquation
    ? answerEquation.split("").map((char) => {
        const displayChar = toDisplayEquationChar(char);
        return {
          char: displayChar,
          state: char === "=" ? "locked" : "correct",
        };
      })
    : [];
  const performanceLabel = getPerformanceLabel(gameState === "won", attempts.length, maxGuesses);
  const shareText = buildGameShareText({
    gameName: "Equadle",
    isArchiveView,
    puzzleDate: puzzle?.puzzleDate,
    didWin: gameState === "won",
    guessesUsed: attempts.length,
    maxGuesses,
    visualRows: buildEquationShareRows(attempts),
    url: toPublicAppUrl("/equadle"),
  });
  const handleShareResult = async () => {
    const shareResult = await shareResultText("Equadle", shareText);
    if (shareResult === "shared") setCopyStatus("Shared");
    if (shareResult === "copied") setCopyStatus("Copied to clipboard");
    if (shareResult === "failed") setCopyStatus("Share failed");
  };

  if (loading) {
    return (
      <div className="equadle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <section className="card equadle-card">
            <h1 className="page-title"><LoadingLabel text="Loading puzzle" /></h1>
          </section>
        </main>
      </div>
    );
  }

  if (archiveLock) {
    return (
      <div className="equadle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <ArchiveLockGate archiveHref={archiveHref} title={archiveLock.title} description={archiveLock.description} mode={archiveLock.mode} />
        </main>
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="equadle-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <DailydabbleUnavailable title="Equadle unavailable" message={error || "No puzzle available right now."} />
        </main>
      </div>
    );
  }

  return (
    <div className="equadle-shell">
      <MainNav label={navLabel} hideToday={hideToday} />

      <main className="container">
        <section className="card equadle-card">
          <div className="game-meta-row">
            <span className="chip">{statusChipLabel}</span>
            <span className="chip">Guesses {attempts.length}/{maxGuesses}</span>
            <button className="how-to-play-btn" type="button" onClick={() => setIsHowToPlayOpen(true)}>
              ? How to play
            </button>
          </div>

          <div className="board">
            {boardRows.map((row, rowIndex) => (
              <div
                key={`row-${rowIndex}`}
                className="board-row"
                style={{ gridTemplateColumns: `repeat(${equationLength}, minmax(0, 1fr))` }}
              >
                {row.map((cell, colIndex) => (
                  <div
                    key={`cell-${rowIndex}-${colIndex}`}
                    className={`board-cell ${cell.state} ${
                      revealingRowIndex === rowIndex && (cell.state === "correct" || cell.state === "present" || cell.state === "absent")
                        ? "reveal"
                        : ""
                    }`}
                    style={
                      revealingRowIndex === rowIndex
                        ? ({
                            "--flip-delay": `${colIndex * FLIP_STAGGER_MS}ms`,
                            "--flip-duration": `${FLIP_DURATION_MS}ms`,
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    {cell.char ? (
                      <span className={isDisplayOperatorChar(cell.char) ? "equadle-operator-symbol" : undefined}>
                        {cell.char}
                      </span>
                    ) : " "}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="equadle-keyboard-wrap">
            {gameState !== "playing" ? (
              <button
                type="button"
                className="guess-submit-btn equadle-review-result-btn"
                onClick={() => setIsResultOpen(true)}
              >
                Review result
              </button>
            ) : null}
            <div className="equadle-keyboard" aria-label="Equation keyboard">
              {KEY_ROWS.map((row, rowIndex) => (
                <div key={`kb-row-${rowIndex}`} className="equadle-keyboard-row">
                  {row.map((keyLabel) => (
                    keyLabel === "Enter" ? (
                      <button
                        key={keyLabel}
                        type="button"
                        className="equadle-key wide enter-key"
                        onClick={(event) => {
                          if (!canSubmitGuess) return;
                          void onSubmit(event);
                        }}
                        disabled={!canSubmitGuess}
                      >
                        Enter
                      </button>
                    ) : keyLabel === "Backspace" ? (
                      <button
                        key={keyLabel}
                        type="button"
                        className="equadle-key"
                        onClick={() => removeGuessChar()}
                        disabled={!canDeleteGuess}
                        aria-label="Backspace"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="equadle-backspace-icon">
                          <path
                            d="M20 5H9L3 12l6 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="m10 9 6 6m0-6-6 6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    ) : (
                      <button
                        key={keyLabel}
                        type="button"
                        className={`equadle-key ${isDisplayOperatorChar(toDisplayEquationChar(keyLabel)) ? "has-operator-symbol" : ""}`}
                        data-state={keyStates.get(keyLabel) || "empty"}
                        onClick={() => appendGuessChar(keyLabel)}
                        disabled={gameState !== "playing"}
                        aria-label={`Type ${toDisplayEquationChar(keyLabel)}`}
                      >
                        <span className={isDisplayOperatorChar(toDisplayEquationChar(keyLabel)) ? "equadle-operator-symbol" : undefined}>
                          {toDisplayEquationChar(keyLabel)}
                        </span>
                      </button>
                    )
                  ))}
                </div>
              ))}
            </div>
            <button
              aria-label="Open calculator"
              className="calculator-trigger"
              onClick={() => setIsCalculatorOpen(true)}
              type="button"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <rect x="5" y="2.75" width="14" height="18.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M8 6.5h8v3H8z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {gameState === "playing" && message ? <p className="message" data-kind={gameState}>{message}</p> : null}
        </section>
      </main>

      <EquadleCalculator isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />

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
            {resultEquationTiles.length > 0 ? (
              <div
                className="result-equation-row"
                aria-label={`Answer: ${displayEffectiveAnswer}`}
                style={{ gridTemplateColumns: `repeat(${resultEquationTiles.length}, minmax(0, 1fr))` }}
              >
                {resultEquationTiles.map((cell, index) => (
                  <span key={`${cell.char}-${index}`} className={`board-cell result-equation-cell ${cell.state}`}>
                    <span className={isDisplayOperatorChar(cell.char) ? "equadle-operator-symbol" : undefined}>
                      {cell.char}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="result-modal-answer">{displayEffectiveAnswer}</p>
            )}
            <ResultDialogActions currentGameSlug="equadle" onShare={handleShareResult} />
            {copyStatus ? <p className="result-modal-copy">{copyStatus}</p> : null}
          </section>
        </div>
      ) : null}

      {isHowToPlayOpen ? (
        <HowToPlayDialog
          title="How to play Equadle"
          subtitle="Guess the hidden arithmetic equation."
          steps={[
            <>
              Build a true equation using digits, <span className="how-to-play-math-symbol">+</span>,{" "}
              <span className="how-to-play-math-symbol">-</span>,{" "}
              <span className="how-to-play-math-symbol">×</span>, and{" "}
              <span className="how-to-play-math-symbol">÷</span>.
            </>,
            `Your guess must fit the ${equationLength}-character board.`,
            "Green tiles are correct. Yellow tiles are in the equation, but in another spot. Grey tiles are not in the equation.",
            "Standard PEMDAS order applies.",
            `Solve the equation in ${maxGuesses} guesses.`,
          ]}
          buttonClassName="admin-btn-like primary"
          onClose={() => setIsHowToPlayOpen(false)}
        />
      ) : null}
    </div>
  );
}
