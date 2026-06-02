"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import MainNav from "./MainNav";
import { normalizePhrase } from "../../lib/puzzle-repository";

type DabbleGameClientProps = {
  apiUrl: string;
  navLabel?: string;
  hideToday?: boolean;
  archiveHref?: string;
  storagePrefix?: string;
  completionPrefix?: string;
  lockDailyCompletion?: boolean;
};

type Slot = {
  index: number;
  length: number;
  separator: string;
};

type DabblePuzzle = {
  puzzleId: string;
  puzzleDate: string;
  phraseTemplate: string;
  slots: Slot[];
  maxGuesses: number;
  answerWords: string[];
};

type LetterFeedback = "correct" | "present" | "absent";
type KeyboardState = "unknown" | "absent" | "present" | "resolved";
type GameState = "playing" | "won" | "lost";

type WordAttempt = {
  slotIndex: number;
  guess: string;
  feedback: LetterFeedback[];
};

type SlotDrafts = Record<number, string[]>;
type SlotLocks = Record<number, boolean[]>;
type SlotMarks = Record<number, Array<LetterFeedback | "empty">>;

type GuessWordResponse = {
  feedback?: LetterFeedback[];
  isCorrect?: boolean;
  normalizedGuess?: string;
  error?: string;
};

const ALPHA_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const FLIP_DURATION_MS = 260;
const FLIP_STAGGER_MS = 208;
const GLOBAL_REVEAL_DELAY_MS = 180;
const DAB_REVEAL_DURATION_MS = 880;

const normalizeWord = (value: string): string => value.toLowerCase().replace(/[^a-z]/g, "");

const getPerformanceLabel = (didWin: boolean, attemptsUsed: number, maxGuesses: number) => {
  if (!didWin) return "Better luck next time.";
  if (attemptsUsed <= 1) return "Amazing!";
  if (attemptsUsed === 2) return "Nice!";
  if (attemptsUsed === 3) return "Great!";
  if (attemptsUsed === 4) return "Good!";
  if (maxGuesses >= 6 && attemptsUsed === 5) return "Not bad!";
  return "Phew, close!";
};

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

export default function DabbleGameClient({
  apiUrl,
  navLabel = "Dabble",
  hideToday = false,
  archiveHref = "/archive",
  storagePrefix = "dabble:v1:today",
  completionPrefix = "dabble:v1:completed",
  lockDailyCompletion = true,
}: DabbleGameClientProps) {
  const isArchiveView = apiUrl.includes("/by-date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState<DabblePuzzle | null>(null);
  const [gameState, setGameState] = useState<GameState>("playing");
  const [message, setMessage] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [phraseGuess, setPhraseGuess] = useState("");
  const [wordAttempts, setWordAttempts] = useState<WordAttempt[]>([]);
  const [solvedWords, setSolvedWords] = useState<Record<number, string>>({});
  const [slotDrafts, setSlotDrafts] = useState<SlotDrafts>({});
  const [slotLocks, setSlotLocks] = useState<SlotLocks>({});
  const [slotMarks, setSlotMarks] = useState<SlotMarks>({});
  const [guessesUsed, setGuessesUsed] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const [nextGameCountdown, setNextGameCountdown] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [revealState, setRevealState] = useState<{
    slotIndex: number;
    letters: string[];
    feedback: LetterFeedback[];
  } | null>(null);
  const [globalRevealState, setGlobalRevealState] = useState<{
    letter: string;
    slots: Array<{ slotIndex: number; indices: number[] }>;
  } | null>(null);
  const [isResolvingGuess, setIsResolvingGuess] = useState(false);

  const createInitialSlotDrafts = (slots: Slot[]): SlotDrafts =>
    Object.fromEntries(slots.map((slot) => [slot.index, Array.from({ length: slot.length }, () => "")]));

  const createInitialSlotLocks = (slots: Slot[]): SlotLocks =>
    Object.fromEntries(slots.map((slot) => [slot.index, Array.from({ length: slot.length }, () => false)]));

  const createInitialSlotMarks = (slots: Slot[]): SlotMarks =>
    Object.fromEntries(slots.map((slot) => [slot.index, Array.from({ length: slot.length }, () => "empty")]));

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
          throw new Error(payload.error || "Failed to load Dabble puzzle");
        }
        if (!active) return;

        setPuzzle(payload);
        setGameState("playing");
        setMessage("");
        setPhraseGuess("");
        setWordAttempts([]);
        setSolvedWords({});
        setSlotDrafts(createInitialSlotDrafts(payload.slots || []));
        setSlotLocks(createInitialSlotLocks(payload.slots || []));
        setSlotMarks(createInitialSlotMarks(payload.slots || []));
        setGuessesUsed(0);
        setSelectedSlot(null);
        setCopyStatus("");
        setIsHistoryOpen(false);
        setRevealState(null);
        setGlobalRevealState(null);
        setIsResolvingGuess(false);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load Dabble puzzle");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadPuzzle();
    return () => {
      active = false;
    };
  }, [apiUrl]);

  const progressKey = useMemo(() => {
    if (!puzzle?.puzzleId) return null;
    return `${storagePrefix}:${puzzle.puzzleId}`;
  }, [puzzle?.puzzleId, storagePrefix]);

  const completionKey = useMemo(() => {
    if (!puzzle?.puzzleId) return null;
    return `${completionPrefix}:${puzzle.puzzleId}`;
  }, [completionPrefix, puzzle?.puzzleId]);

  useEffect(() => {
    if (!progressKey) return;
    const raw = window.localStorage.getItem(progressKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const parsedState = parsed.gameState;
      if (!lockDailyCompletion && (parsedState === "won" || parsedState === "lost")) {
        window.localStorage.removeItem(progressKey);
        return;
      }
      setGameState(parsedState === "won" || parsedState === "lost" ? parsedState : "playing");
      setMessage(typeof parsed.message === "string" ? parsed.message : "");
      setSelectedSlot(typeof parsed.selectedSlot === "number" ? parsed.selectedSlot : null);
      setPhraseGuess(typeof parsed.phraseGuess === "string" ? parsed.phraseGuess : "");
      setWordAttempts(Array.isArray(parsed.wordAttempts) ? parsed.wordAttempts : []);
      setSolvedWords(parsed.solvedWords && typeof parsed.solvedWords === "object" ? parsed.solvedWords : {});
      setSlotDrafts(parsed.slotDrafts && typeof parsed.slotDrafts === "object" ? parsed.slotDrafts : {});
      setSlotLocks(parsed.slotLocks && typeof parsed.slotLocks === "object" ? parsed.slotLocks : {});
      setSlotMarks(parsed.slotMarks && typeof parsed.slotMarks === "object" ? parsed.slotMarks : {});
      setGuessesUsed(Number.isFinite(parsed.guessesUsed) ? Number(parsed.guessesUsed) : 0);
    } catch {
      window.localStorage.removeItem(progressKey);
    }
  }, [lockDailyCompletion, progressKey]);

  useEffect(() => {
    if (!completionKey || !lockDailyCompletion) return;
    const raw = window.localStorage.getItem(completionKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.puzzleId !== puzzle?.puzzleId) return;
      setGameState(parsed.gameState === "won" || parsed.gameState === "lost" ? parsed.gameState : "playing");
      setMessage(typeof parsed.message === "string" ? parsed.message : "");
      setWordAttempts(Array.isArray(parsed.wordAttempts) ? parsed.wordAttempts : []);
      setSolvedWords(parsed.solvedWords && typeof parsed.solvedWords === "object" ? parsed.solvedWords : {});
      setSlotDrafts(parsed.slotDrafts && typeof parsed.slotDrafts === "object" ? parsed.slotDrafts : {});
      setSlotLocks(parsed.slotLocks && typeof parsed.slotLocks === "object" ? parsed.slotLocks : {});
      setSlotMarks(parsed.slotMarks && typeof parsed.slotMarks === "object" ? parsed.slotMarks : {});
      setGuessesUsed(Number.isFinite(parsed.guessesUsed) ? Number(parsed.guessesUsed) : 0);
    } catch {
      window.localStorage.removeItem(completionKey);
    }
  }, [completionKey, lockDailyCompletion, puzzle?.puzzleId]);

  useEffect(() => {
    if (!progressKey || !puzzle) return;
    window.localStorage.setItem(
      progressKey,
      JSON.stringify({
        gameState,
        message,
        selectedSlot,
        phraseGuess,
        wordAttempts,
        solvedWords,
        slotDrafts,
        slotLocks,
        slotMarks,
        guessesUsed,
      }),
    );
  }, [gameState, message, selectedSlot, phraseGuess, wordAttempts, solvedWords, slotDrafts, slotLocks, slotMarks, guessesUsed, progressKey, puzzle]);

  useEffect(() => {
    if (!completionKey || !lockDailyCompletion || gameState === "playing" || !puzzle) return;
    window.localStorage.setItem(
      completionKey,
      JSON.stringify({ puzzleId: puzzle.puzzleId, gameState, message, wordAttempts, solvedWords, guessesUsed }),
    );
  }, [completionKey, gameState, guessesUsed, lockDailyCompletion, message, puzzle, solvedWords, wordAttempts]);

  useEffect(() => {
    if (!lockDailyCompletion || isArchiveView || gameState === "playing") {
      setNextGameCountdown("");
      return;
    }
    setNextGameCountdown(getNextGameCountdown());
    const intervalId = window.setInterval(() => setNextGameCountdown(getNextGameCountdown()), 1000);
    return () => window.clearInterval(intervalId);
  }, [gameState, isArchiveView, lockDailyCompletion]);

  useEffect(() => {
    if (!revealState) {
      return;
    }

    const revealTotalMs = Math.max(0, (revealState.letters.length - 1) * FLIP_STAGGER_MS + FLIP_DURATION_MS + 120);
    const timeoutId = window.setTimeout(() => setRevealState(null), revealTotalMs);
    return () => window.clearTimeout(timeoutId);
  }, [revealState]);

  useEffect(() => {
    if (!globalRevealState) {
      return;
    }

    const timeoutId = window.setTimeout(() => setGlobalRevealState(null), DAB_REVEAL_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [globalRevealState]);

  const maxGuesses = Number.isFinite(puzzle?.maxGuesses) ? Number(puzzle?.maxGuesses) : 6;
  const allSolved = puzzle ? puzzle.slots.every((slot) => Boolean(solvedWords[slot.index])) : false;
  const selectedSlotMeta = puzzle?.slots.find((slot) => slot.index === selectedSlot);
  const selectedSlotDraft = selectedSlotMeta ? slotDrafts[selectedSlotMeta.index] || Array.from({ length: selectedSlotMeta.length }, () => "") : [];
  const selectedSlotLockState = selectedSlotMeta ? slotLocks[selectedSlotMeta.index] || Array.from({ length: selectedSlotMeta.length }, () => false) : [];
  const selectedWordGuess = selectedSlotDraft.join("");
  const canSubmitWordGuess =
    gameState === "playing"
    && !isResolvingGuess
    && Boolean(selectedSlotMeta)
    && selectedSlotDraft.length === (selectedSlotMeta?.length || 0)
    && selectedSlotDraft.every((letter) => Boolean(letter));

  const updateSelectedDraft = (updater: (current: string[], locks: boolean[]) => string[]) => {
    if (!selectedSlotMeta || selectedSlot === null || gameState !== "playing" || isResolvingGuess || Boolean(solvedWords[selectedSlot])) {
      return;
    }

    setSlotDrafts((current) => {
      const currentDraft = current[selectedSlotMeta.index] || Array.from({ length: selectedSlotMeta.length }, () => "");
      const currentLocks = slotLocks[selectedSlotMeta.index] || Array.from({ length: selectedSlotMeta.length }, () => false);
      const nextDraft = updater([...currentDraft], [...currentLocks]).slice(0, selectedSlotMeta.length);
      while (nextDraft.length < selectedSlotMeta.length) {
        nextDraft.push("");
      }
      return {
        ...current,
        [selectedSlotMeta.index]: nextDraft.map((letter) => normalizeWord(letter).slice(-1)),
      };
    });
  };

  const appendWordGuessChar = (char: string) => {
    if (isLetterBlocked(char)) {
      return;
    }
    updateSelectedDraft((current, locks) => {
      const next = [...current];
      const openIndex = next.findIndex((letter, index) => !locks[index] && !letter);
      if (openIndex === -1) {
        return next;
      }
      next[openIndex] = char;
      return next;
    });
  };

  const removeWordGuessChar = () => {
    updateSelectedDraft((current, locks) => {
      const next = [...current];
      for (let index = next.length - 1; index >= 0; index -= 1) {
        if (!locks[index] && next[index]) {
          next[index] = "";
          break;
        }
      }
      return next;
    });
  };

  const clearWordGuess = () => {
    updateSelectedDraft((current, locks) => current.map((letter, index) => (locks[index] ? letter : "")));
  };

  const keyboardState = useMemo(() => {
    if (!puzzle) return {} as Record<string, KeyboardState>;
    const answerCounts: Record<string, number> = {};
    puzzle.answerWords.forEach((word) => {
      word.split("").forEach((ch) => {
        answerCounts[ch] = (answerCounts[ch] || 0) + 1;
      });
    });

    const resolvedCounts: Record<string, number> = {};
    Object.values(solvedWords).forEach((word) => {
      String(word).split("").forEach((ch) => {
        resolvedCounts[ch] = (resolvedCounts[ch] || 0) + 1;
      });
    });

    const seenLetters = new Set<string>();
    wordAttempts.forEach((attempt) => {
      attempt.guess.split("").forEach((ch) => seenLetters.add(ch));
    });

    const presentHints = new Set<string>();
    wordAttempts.forEach((attempt) => {
      attempt.guess.split("").forEach((ch, idx) => {
        const mark = attempt.feedback[idx];
        if (mark === "correct" || mark === "present") {
          presentHints.add(ch);
        }
      });
    });

    const states: Record<string, KeyboardState> = {};
    for (let code = 97; code <= 122; code += 1) {
      const ch = String.fromCharCode(code);
      const total = answerCounts[ch] || 0;
      const resolved = resolvedCounts[ch] || 0;
      const seen = seenLetters.has(ch);
      const knowsPresent = presentHints.has(ch) || resolved > 0;

      if (total > 0 && resolved >= total) {
        states[ch] = "resolved";
      } else if (knowsPresent) {
        states[ch] = "present";
      } else if (seen && total === 0) {
        states[ch] = "absent";
      } else {
        states[ch] = "unknown";
      }
    }

    return states;
  }, [puzzle, solvedWords, wordAttempts]);

  const isLetterBlocked = (letter: string): boolean => {
    const normalized = normalizeWord(letter);
    if (!normalized) {
      return false;
    }
    const state = keyboardState[normalized];
    return state === "absent" || state === "resolved";
  };

  const submitWordGuess = async () => {
    if (!puzzle || gameState !== "playing" || !selectedSlotMeta || isResolvingGuess) return;

    const normalizedGuess = normalizeWord(selectedWordGuess);
    if (normalizedGuess.length !== selectedSlotMeta.length) {
      setMessage(`Word must be ${selectedSlotMeta.length} letters for this slot.`);
      return;
    }

    let responsePayload: GuessWordResponse = {};
    try {
      const response = await fetch("/api/puzzle/guess-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzleId: puzzle.puzzleId,
          slotIndex: selectedSlotMeta.index,
          guessWord: normalizedGuess,
        }),
      });
      responsePayload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responsePayload.error || "Could not validate guess");
      }
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : "Could not validate guess");
      return;
    }

    const feedback = Array.isArray(responsePayload.feedback) ? responsePayload.feedback : [];
    const appliedGuess = responsePayload.normalizedGuess || normalizedGuess;
    const isCorrect = Boolean(responsePayload.isCorrect);
    const nextAttempts = [...wordAttempts, { slotIndex: selectedSlotMeta.index, guess: appliedGuess, feedback }];
    const nextSolved = { ...solvedWords };
    const persistedGuessDraft = appliedGuess.split("").map((letter, index) => (feedback[index] === "correct" ? letter : ""));
    const nextSlotLocks = {
      ...slotLocks,
      [selectedSlotMeta.index]: feedback.map((state) => state === "correct"),
    };
    const nextSlotMarks = {
      ...slotMarks,
      [selectedSlotMeta.index]: feedback.map((state) => (state === "correct" ? "correct" : "empty")),
    };
    const nextSlotDrafts = {
      ...slotDrafts,
      [selectedSlotMeta.index]: persistedGuessDraft,
    };
    const postGuessSolved = { ...nextSolved };
    const postGuessSlotDrafts = { ...nextSlotDrafts };
    const postGuessSlotLocks = { ...nextSlotLocks };
    const postGuessSlotMarks = { ...nextSlotMarks };

    setIsResolvingGuess(true);
    setRevealState({
      slotIndex: selectedSlotMeta.index,
      letters: appliedGuess.split(""),
      feedback,
    });

    if (isCorrect) {
      nextSolved[selectedSlotMeta.index] = puzzle.answerWords[selectedSlotMeta.index];
    }

    setWordAttempts(nextAttempts);
    setSolvedWords(postGuessSolved);
    setSlotDrafts(postGuessSlotDrafts);
    setSlotLocks(postGuessSlotLocks);
    setSlotMarks(postGuessSlotMarks);
    setMessage("");

    const nextGuessesUsed = guessesUsed + 1;
    setGuessesUsed(nextGuessesUsed);

    if (isCorrect) {
      const solvedAll = puzzle.slots.every((slot) => postGuessSolved[slot.index]);
      setIsResolvingGuess(false);
      if (solvedAll) {
        setGameState("won");
        return;
      }

      if (nextGuessesUsed >= maxGuesses) {
        setGameState("lost");
        return;
      }

      setSelectedSlot(null);
      return;
    }

    const finalSolved = { ...postGuessSolved };
    const finalSlotDrafts = { ...postGuessSlotDrafts };
    const finalSlotLocks = { ...postGuessSlotLocks };
    const finalSlotMarks = { ...postGuessSlotMarks };
    const revealedSlots: Array<{ slotIndex: number; indices: number[] }> = [];
    const guessedLetters = Array.from(new Set(appliedGuess.split("")));
    const newlyRevealedLetters = new Set<string>();

    puzzle.slots.forEach((slot) => {
      if (finalSolved[slot.index]) {
        return;
      }
      const answer = puzzle.answerWords[slot.index] || "";
      if (!answer) {
        return;
      }

      const currentLocks = [...(finalSlotLocks[slot.index] || Array.from({ length: slot.length }, () => false))];
      const currentDraft = [...(finalSlotDrafts[slot.index] || Array.from({ length: slot.length }, () => ""))];
      const currentMarks = [...(finalSlotMarks[slot.index] || Array.from({ length: slot.length }, () => "empty"))];
      const justRevealedIndices: number[] = [];

      answer.split("").forEach((letter, letterIndex) => {
        if (!guessedLetters.includes(letter) || currentLocks[letterIndex]) {
          return;
        }
        currentDraft[letterIndex] = answer[letterIndex];
        currentLocks[letterIndex] = true;
        currentMarks[letterIndex] = "correct";
        justRevealedIndices.push(letterIndex);
        newlyRevealedLetters.add(letter);
      });

      finalSlotDrafts[slot.index] = currentDraft;
      finalSlotLocks[slot.index] = currentLocks;
      finalSlotMarks[slot.index] = currentMarks;

      if (justRevealedIndices.length > 0) {
        revealedSlots.push({ slotIndex: slot.index, indices: justRevealedIndices });
      }

      if (currentLocks.every(Boolean)) {
        finalSolved[slot.index] = answer;
      }
    });

    const revealTotalMs = Math.max(0, (appliedGuess.length - 1) * FLIP_STAGGER_MS + FLIP_DURATION_MS + GLOBAL_REVEAL_DELAY_MS);
    window.setTimeout(() => {
      if (revealedSlots.length > 0) {
        setGlobalRevealState({
          letter: Array.from(newlyRevealedLetters).join(""),
          slots: revealedSlots,
        });
      }
      setSolvedWords(finalSolved);
      setSlotDrafts(finalSlotDrafts);
      setSlotLocks(finalSlotLocks);
      setSlotMarks(finalSlotMarks);
      const revealedLabel = Array.from(newlyRevealedLetters).map((letter) => letter.toUpperCase()).join(", ");
      setMessage(revealedLabel ? `New letters revealed: ${revealedLabel}` : "");

      const solvedAll = puzzle.slots.every((slot) => finalSolved[slot.index]);
      if (solvedAll) {
        setGameState("won");
        setIsResolvingGuess(false);
        return;
      }

      if (nextGuessesUsed >= maxGuesses) {
        setGameState("lost");
        setIsResolvingGuess(false);
        return;
      }

      setSelectedSlot(null);
      setIsResolvingGuess(false);
    }, revealTotalMs);
  };

  const submitPhraseGuess = () => {
    if (!puzzle || gameState !== "playing") return;

    const normalized = normalizePhrase(phraseGuess);
    if (!normalized) {
      setMessage("Enter a phrase guess first.");
      return;
    }

    const target = puzzle.answerWords.join(" ");
    if (normalized === target) {
      const all: Record<number, string> = {};
      puzzle.answerWords.forEach((word, idx) => {
        all[idx] = word;
      });
      setSolvedWords(all);
      setGameState("won");
      return;
    }

    setGuessesUsed(maxGuesses);
    setGameState("lost");
  };

  const shareResult = async () => {
    if (!puzzle || gameState === "playing") return;
    const status = gameState === "won" ? `${guessesUsed}/${maxGuesses}` : "X";
    const lines = [
      `Dabble ${puzzle.puzzleDate}`,
      `Result: ${status}`,
      `https://dailydabble.app`,
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Copied result.");
    } catch {
      setCopyStatus("Could not copy.");
    }
  };

  useEffect(() => {
    if (gameState !== "playing" || !selectedSlotMeta || isResolvingGuess) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (document.activeElement instanceof HTMLInputElement && document.activeElement.name === "phraseGuess") {
        if (event.key === "Enter") {
          event.preventDefault();
          submitPhraseGuess();
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (canSubmitWordGuess) {
          void submitWordGuess();
        }
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        removeWordGuessChar();
        return;
      }

      if (/^[a-z]$/i.test(event.key)) {
        if (isLetterBlocked(event.key)) {
          return;
        }
        event.preventDefault();
        appendWordGuessChar(event.key.toLowerCase());
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSubmitWordGuess, gameState, isResolvingGuess, keyboardState, selectedSlotMeta, selectedWordGuess, phraseGuess]);
 
  const latestAttempt = wordAttempts.length > 0 ? wordAttempts[wordAttempts.length - 1] : null;
  const earlierAttempts = wordAttempts.slice(0, -1).reverse();

  if (loading) {
    return (
      <>
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container"><section className="card"><p className="message">Loading Dabble...</p></section></main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container"><section className="card"><p className="message" data-kind="lost">{error}</p></section></main>
      </>
    );
  }

  if (!puzzle) {
    return (
      <>
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <DailydabbleUnavailable
            title="No Dabble puzzle yet"
            message="There is no puzzle scheduled for this date yet."
          />
        </main>
      </>
    );
  }

  const resultLabel = getPerformanceLabel(gameState === "won", guessesUsed, maxGuesses);

  return (
    <>
      <MainNav label={navLabel} hideToday={hideToday} />
      <main className="container">
        <section className="card dabble-card">
          <div className="game-meta-row">
            <span className="chip">{isArchiveView ? "ARCHIVE GAME" : "TODAY'S GAME"}</span>
            <span className="chip">{`Guesses ${guessesUsed}/${maxGuesses}`}</span>
          </div>

          <h1 className="puzzle-title">Guess the phrase</h1>
          <p className="rule-copy">Pick one unsolved slot, guess one word, or risk a full-phrase guess.</p>

          <div className="phrase-layout">
            {puzzle.slots.map((slot) => {
              const solved = solvedWords[slot.index];
              const isSelected = selectedSlot === slot.index;
              const isPlayable = gameState === "playing" && !solved && !isResolvingGuess;
              const isRevealing = revealState?.slotIndex === slot.index;
              const globalRevealForSlot = globalRevealState?.slots.find((entry) => entry.slotIndex === slot.index);
              const persistedLocks = slotLocks[slot.index] || Array.from({ length: slot.length }, () => false);
              const persistedMarks = slotMarks[slot.index] || Array.from({ length: slot.length }, () => "empty");
              const tileLetters = solved
                ? solved.split("")
                : isRevealing
                  ? revealState.letters
                  : (slotDrafts[slot.index] || Array.from({ length: slot.length }, () => ""));
              return (
                <div key={slot.index} className="slot-cluster">
                  <button
                    type="button"
                    className={`slot-word-button ${solved ? "solved" : ""} ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      if (!isPlayable) {
                        return;
                      }
                      setSelectedSlot(slot.index);
                      setMessage("");
                    }}
                    onFocus={() => {
                      if (!isPlayable) {
                        return;
                      }
                      setSelectedSlot(slot.index);
                      setMessage("");
                    }}
                    disabled={!isPlayable}
                  >
                    <span className="slot-tiles">
                      {tileLetters.map((letter, index) => (
                        <span
                          key={`${slot.index}-${index}`}
                          className={`slot-tile ${solved ? "solved" : ""} ${isSelected ? "selected" : ""} ${letter ? "filled" : ""} ${!solved && !isRevealing ? persistedMarks[index] || "empty" : ""} ${isRevealing ? revealState?.feedback[index] || "absent" : ""} ${isRevealing ? "reveal" : ""} ${persistedLocks[index] ? "locked" : ""} ${globalRevealForSlot?.indices.includes(index) ? "dab-reveal" : ""}`}
                          style={
                            isRevealing || globalRevealForSlot?.indices.includes(index)
                              ? ({
                                  "--flip-delay": `${index * FLIP_STAGGER_MS}ms`,
                                  "--flip-duration": `${FLIP_DURATION_MS}ms`,
                                  "--dab-delay": `${(globalRevealForSlot?.indices.indexOf(index) || 0) * 120}ms`,
                                } as CSSProperties)
                              : undefined
                          }
                        >
                          {letter || ""}
                        </span>
                      ))}
                    </span>
                    <span className="slot-len">{slot.index + 1}</span>
                  </button>
                  {slot.separator ? <span className="slot-sep">{slot.separator}</span> : null}
                </div>
              );
            })}
          </div>

          <div className="phrase-submit-row">
            <input
              className="guess-input phrase-submit-input"
              type="text"
              name="phraseGuess"
              value={phraseGuess}
              onChange={(event) => setPhraseGuess(event.target.value)}
              placeholder="Guess the full phrase. All or nothing."
              disabled={gameState !== "playing"}
            />
            <button
              className="guess-submit-btn danger"
              type="button"
              disabled={gameState !== "playing"}
              onClick={submitPhraseGuess}
            >
              Submit
            </button>
          </div>

          <div className="keyboard" aria-label="Global phrase keyboard">
            {ALPHA_ROWS.map((row) => (
              <div className="keyboard-row" key={row}>
                {row.split("").map((letter) => {
                  const state = keyboardState[letter.toLowerCase()] || "unknown";
                  const isDisabled = gameState !== "playing"
                    || isResolvingGuess
                    || state === "absent"
                    || state === "resolved"
                    || !selectedSlotMeta
                    || selectedSlotDraft.every((letter, index) => selectedSlotLockState[index] || Boolean(letter));
                  return (
                    <button
                      type="button"
                      key={letter}
                      className="key alpha-key"
                      data-state={state}
                      onClick={() => {
                        if (isDisabled) return;
                        appendWordGuessChar(letter.toLowerCase());
                      }}
                      disabled={isDisabled}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="keyboard-row controls">
              <button type="button" className="key wide control-key" onClick={() => void submitWordGuess()} disabled={!canSubmitWordGuess}>Enter</button>
              <button
                type="button"
                className="key wide control-key backspace-key"
                onClick={removeWordGuessChar}
                disabled={gameState !== "playing" || isResolvingGuess || !selectedSlotDraft.some((letter, index) => !selectedSlotLockState[index] && Boolean(letter))}
                aria-label="Backspace"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="dabble-backspace-icon">
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
              <button type="button" className="key wide control-key" onClick={clearWordGuess} disabled={gameState !== "playing" || isResolvingGuess || !selectedSlotDraft.some((letter, index) => !selectedSlotLockState[index] && Boolean(letter))}>Clear</button>
            </div>
          </div>

          <p className="message" data-kind={gameState === "won" ? "won" : gameState === "lost" ? "lost" : globalRevealState ? "hint" : "playing"}>{message}</p>

          {gameState !== "playing" ? (
            <div className="result-card">
              <p className="result-title">{gameState === "won" ? "You solved Dabble" : "Dabble complete"}</p>
              <p className="result-subtle">{resultLabel}</p>
              <p className="answer-line">Answer: {puzzle.answerWords.join(" ")}</p>
              {nextGameCountdown ? <p className="next-game-copy">Next game in {nextGameCountdown}</p> : null}
              <div className="post-actions">
                <button type="button" className="guess-submit-btn" onClick={() => void shareResult()}>Copy Result</button>
                <a className="admin-btn-like" href={archiveHref}>Browse Archive</a>
              </div>
              {copyStatus ? <p className="copy-status">{copyStatus}</p> : null}
            </div>
          ) : null}

          {allSolved && gameState === "playing" ? <p className="message" data-kind="won">All words solved.</p> : null}

          {wordAttempts.length > 0 ? (
            <div className="guess-history-wrap">
              <button
                type="button"
                className="guess-history-toggle"
                aria-expanded={isHistoryOpen}
                aria-controls="dabble-guess-history-panel"
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
                  <span className="attempt-label">{`Word #${latestAttempt.slotIndex + 1}`}</span>
                  <div className="guess-history-attempt-tiles">
                    {latestAttempt.guess.split("").map((letter, index) => (
                      <span key={`latest-${latestAttempt.slotIndex}-${index}`} className={`attempt-cell ${latestAttempt.feedback[index]}`}>
                        {letter}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {isHistoryOpen && earlierAttempts.length > 0 ? (
                <ul id="dabble-guess-history-panel" className="guess-history-list">
                  {earlierAttempts.map((attempt, index) => (
                    <li key={`${attempt.slotIndex}-${attempt.guess}-${index}`} className="guess-history-item">
                      <span className="attempt-label">{`Word #${attempt.slotIndex + 1}`}</span>
                      <div className="guess-history-attempt-tiles">
                        {attempt.guess.split("").map((letter, tileIndex) => (
                          <span key={`${attempt.slotIndex}-${index}-${tileIndex}`} className={`attempt-cell ${attempt.feedback[tileIndex]}`}>
                            {letter}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
