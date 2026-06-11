"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { DailydabbleUnavailable } from "@dailydabble/ui";
import ArchiveLockGate from "../../components/ArchiveLockGate";
import HowToPlayDialog from "../../components/HowToPlayDialog";
import MainNav from "./MainNav";
import { normalizePhraseWithPunctuation } from "../../../lib/verble/puzzle-repository";
import { toPublicAppUrl } from "../../../lib/app-url";
import LoadingLabel from "../../components/LoadingLabel";

type VerbleGameClientProps = {
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
  display: string;
  separator: string;
};

type DisplayChar =
  | { kind: "letter"; value: string; letterIndex: number; trailingFixed: string }
  | { kind: "fixed"; value: string; letterIndex: null; trailingFixed?: never };

type VerblePuzzle = {
  puzzleId: string;
  puzzleDate: string;
  archiveGameNumber?: number;
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
const WORD_REVEAL_STAGGER_MS = 180;
const GLOBAL_REVEAL_DELAY_MS = 180;
const SLOW_FLIP_DURATION_MS = FLIP_DURATION_MS * 2;

const normalizeWord = (value: string): string => value.toLowerCase().replace(/[^a-z]/g, "");

const getFlipVisual = (feedback: LetterFeedback | "empty") => {
  if (feedback === "correct") {
    return { bg: "#65b84d", border: "#5aa545", color: "#ffffff" };
  }
  if (feedback === "present") {
    return { bg: "#e4bc4d", border: "#c7a340", color: "#ffffff" };
  }
  if (feedback === "absent") {
    return { bg: "#b5bbc5", border: "#a3a9b4", color: "#ffffff" };
  }
  return { bg: "#ffffff", border: "#d8dce2", color: "#2c2f31" };
};

const buildDisplayedWordChars = (slot: Slot, letters: string[]): DisplayChar[] => {
  let letterCursor = 0;
  return slot.display.split("").reduce<DisplayChar[]>((items, char) => {
    if (/[A-Za-z]/.test(char)) {
      const next = letters[letterCursor] || "";
      const currentIndex = letterCursor;
      letterCursor += 1;
      items.push({ kind: "letter", value: next, letterIndex: currentIndex, trailingFixed: "" });
      return items;
    }
    const previous = items[items.length - 1];
    if (previous?.kind === "letter") {
      previous.trailingFixed += char;
      return items;
    }
    items.push({ kind: "fixed", value: char, letterIndex: null });
    return items;
  }, []);
};

const buildSurfaceWordGuess = (slot: Slot, letters: string[]): string => {
  let letterCursor = 0;
  return slot.display.split("").map((char) => {
    if (/[A-Za-z]/.test(char)) {
      const next = letters[letterCursor] || "";
      letterCursor += 1;
      return next;
    }
    return char;
  }).join("");
};

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

export default function VerbleGameClient({
  apiUrl,
  navLabel = "Verble",
  hideToday = false,
  archiveHref = "/verble/archive",
  storagePrefix = "verble:v1:today",
  completionPrefix = "verble:v1:completed",
  lockDailyCompletion = true,
}: VerbleGameClientProps) {
  const isArchiveView = apiUrl.includes("/by-date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzle, setPuzzle] = useState<VerblePuzzle | null>(null);
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
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isPhraseDialogOpen, setIsPhraseDialogOpen] = useState(false);
  const [phraseGuessError, setPhraseGuessError] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [archiveLock, setArchiveLock] = useState<{ title: string; description: string } | null>(null);
  const [revealState, setRevealState] = useState<{
    slotIndex: number;
    letters: string[];
    feedback: LetterFeedback[];
    revealIndices: number[];
    startFeedback: Array<LetterFeedback | "empty">;
  } | null>(null);
  const [heldRevealState, setHeldRevealState] = useState<{
    slotIndex: number;
    letters: string[];
    feedback: LetterFeedback[];
    revealIndices: number[];
    startFeedback: Array<LetterFeedback | "empty">;
  } | null>(null);
  const [phraseRevealState, setPhraseRevealState] = useState<Array<{
    slotIndex: number;
    letters: string[];
    feedback: LetterFeedback[];
    wordDelayMs: number;
    revealIndices: number[];
  }> | null>(null);
  const [globalRevealState, setGlobalRevealState] = useState<{
    entries: Array<{
      slotIndex: number;
      letters: string[];
      feedback: LetterFeedback[];
      revealIndices: number[];
      wordDelayMs: number;
    }>;
  } | null>(null);
  const [postRevealState, setPostRevealState] = useState<{
    slotIndex: number;
    letters: string[];
    feedback: Array<LetterFeedback | "empty">;
    revealIndices: number[];
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
        if (response.status === 423) {
          if (active) {
            setPuzzle(null);
            setArchiveLock({
              title: typeof payload.lockTitle === "string" ? payload.lockTitle : "Archive Game #1 is locked",
              description: typeof payload.lockDescription === "string" ? payload.lockDescription : "Enter the shared password to open this retired archive game.",
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
          throw new Error(payload.error || "Failed to load Verble puzzle");
        }
        if (!active) return;

        setPuzzle(payload);
        setArchiveLock(null);
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
        setIsResultOpen(false);
        setIsHowToPlayOpen(false);
        setIsPhraseDialogOpen(false);
        setPhraseGuessError("");
        setIsHistoryOpen(false);
        setRevealState(null);
        setHeldRevealState(null);
        setPhraseRevealState(null);
        setGlobalRevealState(null);
        setPostRevealState(null);
        setIsResolvingGuess(false);
      } catch (loadError) {
        if (!active) return;
        setArchiveLock(null);
        setError(loadError instanceof Error ? loadError.message : "Failed to load Verble puzzle");
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
    if (gameState === "playing") {
      setIsResultOpen(false);
      return;
    }
    setIsResultOpen(true);
  }, [gameState]);

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

    const revealTotalMs = Math.max(0, (revealState.revealIndices.length - 1) * FLIP_STAGGER_MS + FLIP_DURATION_MS + 120);
    const timeoutId = window.setTimeout(() => setRevealState(null), revealTotalMs);
    return () => window.clearTimeout(timeoutId);
  }, [revealState]);

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

    const applyDraftUpdate = (current: SlotDrafts) => {
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
    };

    setSlotDrafts(applyDraftUpdate);
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
    puzzle.slots.forEach((slot) => {
      const draft = slotDrafts[slot.index] || Array.from({ length: slot.length }, () => "");
      const locks = slotLocks[slot.index] || Array.from({ length: slot.length }, () => false);
      draft.forEach((ch, index) => {
        if (!locks[index] || !ch) {
          return;
        }
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
      const knowsPresent = (seen && total > 0) || presentHints.has(ch) || resolved > 0;

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
  }, [puzzle, slotDrafts, slotLocks, wordAttempts]);

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

    const surfacedGuess = buildSurfaceWordGuess(selectedSlotMeta, selectedSlotDraft);
    const normalizedGuess = normalizeWord(surfacedGuess);
    if (normalizedGuess.length !== selectedSlotMeta.length) {
      setMessage(`Word must be ${selectedSlotMeta.length} letters for this slot.`);
      return;
    }

    let responsePayload: GuessWordResponse = {};
    try {
      const response = await fetch("/api/verble/puzzle/guess-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzleId: puzzle.puzzleId,
          slotIndex: selectedSlotMeta.index,
          guessWord: surfacedGuess,
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
    const submittedLetters = [...selectedSlotDraft];
    const isCorrect = Boolean(responsePayload.isCorrect);
    const nextAttempts = [...wordAttempts, { slotIndex: selectedSlotMeta.index, guess: appliedGuess, feedback }];
    const nextSolved = { ...solvedWords };
    const existingDraft = slotDrafts[selectedSlotMeta.index] || Array.from({ length: selectedSlotMeta.length }, () => "");
    const existingLocks = slotLocks[selectedSlotMeta.index] || Array.from({ length: selectedSlotMeta.length }, () => false);
    const animatedGuessDraft = submittedLetters.map((letter, index) => (existingLocks[index] ? existingDraft[index] || letter : letter));
    const persistedGuessDraft = submittedLetters.map((letter, index) => (
      existingLocks[index] || feedback[index] === "correct" ? letter : ""
    ));
    const startFeedback = existingLocks.map((isLocked) => (isLocked ? "correct" : "empty")) as Array<LetterFeedback | "empty">;
    const nextSlotLocks = {
      ...slotLocks,
      [selectedSlotMeta.index]: feedback.map((state, index) => existingLocks[index] || state === "correct"),
    };
    const nextSlotMarks = {
      ...slotMarks,
      [selectedSlotMeta.index]: feedback.map((state, index) => ((existingLocks[index] || state === "correct") ? "correct" : "empty")),
    };
    const nextSlotDrafts = {
      ...slotDrafts,
      [selectedSlotMeta.index]: persistedGuessDraft,
    };
    if (isCorrect) {
      nextSolved[selectedSlotMeta.index] = puzzle.answerWords[selectedSlotMeta.index];
    }

    const postGuessSolved = { ...nextSolved };
    const postGuessSlotDrafts = { ...nextSlotDrafts };
    const postGuessSlotLocks = { ...nextSlotLocks };
    const postGuessSlotMarks = { ...nextSlotMarks };

    const revealIndices = feedback.flatMap((state, index) => (
      nextSlotLocks[selectedSlotMeta.index][index] && existingLocks[index]
        ? []
        : [index]
    ));

    setIsResolvingGuess(true);
    setSelectedSlot(null);
    setRevealState({
      slotIndex: selectedSlotMeta.index,
      letters: animatedGuessDraft,
      feedback,
      revealIndices,
      startFeedback,
    });
    setHeldRevealState({
      slotIndex: selectedSlotMeta.index,
      letters: animatedGuessDraft,
      feedback,
      revealIndices,
      startFeedback,
    });

    setWordAttempts(nextAttempts);
    setSolvedWords(postGuessSolved);
    setSlotDrafts(postGuessSlotDrafts);
    setSlotLocks(postGuessSlotLocks);
    setSlotMarks(postGuessSlotMarks);
    setMessage("");

    const nextGuessesUsed = guessesUsed + 1;
    setGuessesUsed(nextGuessesUsed);

    const finalSolved = { ...postGuessSolved };
    const finalSlotDrafts = { ...postGuessSlotDrafts };
    const finalSlotLocks = { ...postGuessSlotLocks };
    const finalSlotMarks = { ...postGuessSlotMarks };
    const phaseTwoSolved = { ...postGuessSolved };
    const phaseTwoSlotDrafts = { ...postGuessSlotDrafts };
    const phaseTwoSlotLocks = { ...postGuessSlotLocks };
    const phaseTwoSlotMarks = { ...postGuessSlotMarks };
    const phaseTwoEntries: Array<{
      slotIndex: number;
      letters: string[];
      feedback: LetterFeedback[];
      revealIndices: number[];
      wordDelayMs: number;
    }> = [];
    const deferredSelectedIndices: number[] = [];
    const guessedLetters = Array.from(
      new Set(
        appliedGuess
          .split("")
          .filter((letter, index) => {
            const mark = feedback[index];
            return mark === "correct" || mark === "present";
          }),
      ),
    );
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

      if (slot.index === selectedSlotMeta.index) {
        deferredSelectedIndices.push(...justRevealedIndices);
        finalSlotDrafts[slot.index] = currentDraft;
        finalSlotLocks[slot.index] = currentLocks;
        finalSlotMarks[slot.index] = currentMarks;
        if (currentLocks.every(Boolean)) {
          finalSolved[slot.index] = answer;
        }
        return;
      }

      phaseTwoSlotDrafts[slot.index] = currentDraft;
      phaseTwoSlotLocks[slot.index] = currentLocks;
      phaseTwoSlotMarks[slot.index] = currentMarks;
      finalSlotDrafts[slot.index] = currentDraft;
      finalSlotLocks[slot.index] = currentLocks;
      finalSlotMarks[slot.index] = currentMarks;

      if (justRevealedIndices.length > 0) {
        phaseTwoEntries.push({
          slotIndex: slot.index,
          letters: currentDraft,
          feedback: Array.from({ length: slot.length }, () => "correct" as LetterFeedback),
          revealIndices: justRevealedIndices,
          wordDelayMs: 0,
        });
      }

      if (currentLocks.every(Boolean)) {
        phaseTwoSolved[slot.index] = answer;
        finalSolved[slot.index] = answer;
      }
    });

    const revealTotalMs = Math.max(0, (revealIndices.length - 1) * FLIP_STAGGER_MS + FLIP_DURATION_MS + GLOBAL_REVEAL_DELAY_MS);
    const phaseTwoTotalMs = phaseTwoEntries.reduce((max, entry) => {
      const entryTotal = SLOW_FLIP_DURATION_MS + 120;
      return Math.max(max, entryTotal);
    }, 0);
    const finalSelectedIndices = Array.from({ length: selectedSlotMeta.length }, (_, index) => index).filter((index) => {
      const heldLetter = animatedGuessDraft[index] || "";
      const heldMark = feedback[index] || "empty";
      const nextLetter = finalSlotDrafts[selectedSlotMeta.index][index] || "";
      const nextMark = finalSlotMarks[selectedSlotMeta.index][index] || "empty";
      return heldLetter !== nextLetter || heldMark !== nextMark;
    });
    const phaseThreeTotalMs = Math.max(0, (finalSelectedIndices.length - 1) * FLIP_STAGGER_MS + FLIP_DURATION_MS + 120);
    window.setTimeout(() => {
      const finishResolution = (resolvedSolved: Record<number, string>) => {
        setHeldRevealState(null);
        const solvedAll = puzzle.slots.every((slot) => resolvedSolved[slot.index]);
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
      };

      const revealedLabel = Array.from(newlyRevealedLetters).map((letter) => letter.toUpperCase()).join(", ");
      setMessage(revealedLabel ? `New letters revealed: ${revealedLabel}` : "");

      const runPhaseThree = () => {
        if (finalSelectedIndices.length === 0) {
          setSolvedWords(phaseTwoSolved);
          setSlotDrafts(phaseTwoSlotDrafts);
          setSlotLocks(phaseTwoSlotLocks);
          setSlotMarks(phaseTwoSlotMarks);
          finishResolution(phaseTwoSolved);
          return;
        }

        setSolvedWords(phaseTwoSolved);
        setSlotDrafts(phaseTwoSlotDrafts);
        setSlotLocks(phaseTwoSlotLocks);
        setSlotMarks(phaseTwoSlotMarks);
        setPostRevealState({
          slotIndex: selectedSlotMeta.index,
          letters: finalSlotDrafts[selectedSlotMeta.index],
          feedback: finalSlotMarks[selectedSlotMeta.index],
          revealIndices: finalSelectedIndices,
        });

        window.setTimeout(() => {
          setPostRevealState(null);
          setSolvedWords(finalSolved);
          setSlotDrafts(finalSlotDrafts);
          setSlotLocks(finalSlotLocks);
          setSlotMarks(finalSlotMarks);
          finishResolution(finalSolved);
        }, phaseThreeTotalMs);
      };

      if (phaseTwoEntries.length === 0) {
        runPhaseThree();
        return;
      }

      setGlobalRevealState({ entries: phaseTwoEntries });
      window.setTimeout(() => {
        setGlobalRevealState(null);
        runPhaseThree();
      }, phaseTwoTotalMs);
    }, revealTotalMs);
  };

  const submitPhraseGuess = () => {
    if (!puzzle || gameState !== "playing") return;

    const normalized = normalizePhraseWithPunctuation(phraseGuess);
    if (!normalized) {
      setPhraseGuessError("Enter a phrase guess first.");
      return;
    }

    setPhraseGuessError("");
    setIsPhraseDialogOpen(false);

    const target = normalizePhraseWithPunctuation(
      puzzle.slots.map((slot) => `${slot.display}${slot.separator}`).join("")
    );
    if (normalized === target) {
      const allSolvedWords: Record<number, string> = {};
      const solvedDrafts: SlotDrafts = {};
      const solvedLocks: SlotLocks = {};
      const solvedMarks: SlotMarks = {};
      let animatedWordCount = 0;
      const revealEntries = puzzle.slots.map((slot) => {
        const word = puzzle.answerWords[slot.index] || "";
        const currentLocks = slotLocks[slot.index] || Array.from({ length: slot.length }, () => false);
        const currentMarks = slotMarks[slot.index] || Array.from({ length: slot.length }, () => "empty");
        const revealIndices = word
          .split("")
          .flatMap((_, index) => (currentLocks[index] || currentMarks[index] === "correct" ? [] : [index]));
        const wordDelayMs = revealIndices.length > 0 ? animatedWordCount++ * WORD_REVEAL_STAGGER_MS : 0;
        allSolvedWords[slot.index] = word;
        solvedDrafts[slot.index] = word.split("");
        solvedLocks[slot.index] = Array.from({ length: slot.length }, () => true);
        solvedMarks[slot.index] = Array.from({ length: slot.length }, () => "correct");
        return {
          slotIndex: slot.index,
          letters: word.split(""),
          feedback: Array.from({ length: slot.length }, () => "correct" as LetterFeedback),
          wordDelayMs,
          revealIndices,
        };
      });

      const revealTotalMs = revealEntries.reduce((max, entry) => {
        const entryTotal = entry.wordDelayMs + Math.max(0, (entry.revealIndices.length - 1) * FLIP_STAGGER_MS + FLIP_DURATION_MS + 120);
        return Math.max(max, entryTotal);
      }, 0);

      setIsResolvingGuess(true);
      setSelectedSlot(null);
      setMessage("");
      setPhraseRevealState(revealEntries);

      window.setTimeout(() => {
        setPhraseRevealState(null);
        setSolvedWords(allSolvedWords);
        setSlotDrafts(solvedDrafts);
        setSlotLocks(solvedLocks);
        setSlotMarks(solvedMarks);
        setGameState("won");
        setIsResolvingGuess(false);
      }, revealTotalMs);
      return;
    }

    const revealedDrafts: SlotDrafts = {};
    const revealedLocks: SlotLocks = {};
    const revealedMarks: SlotMarks = {};
    let animatedWordCount = 0;
    const revealEntries = puzzle.slots.map((slot) => {
      const word = puzzle.answerWords[slot.index] || "";
      const revealIndices = word.split("").map((_, index) => index);
      const wordDelayMs = revealIndices.length > 0 ? animatedWordCount++ * WORD_REVEAL_STAGGER_MS : 0;
      revealedDrafts[slot.index] = word.split("");
      revealedLocks[slot.index] = Array.from({ length: slot.length }, () => false);
      revealedMarks[slot.index] = Array.from({ length: slot.length }, () => "absent");
      return {
        slotIndex: slot.index,
        letters: word.split(""),
        feedback: Array.from({ length: slot.length }, () => "absent" as LetterFeedback),
        wordDelayMs,
        revealIndices,
      };
    });

    const revealTotalMs = revealEntries.reduce((max, entry) => {
      const entryTotal = entry.wordDelayMs + Math.max(0, (entry.revealIndices.length - 1) * FLIP_STAGGER_MS + FLIP_DURATION_MS + 120);
      return Math.max(max, entryTotal);
    }, 0);

    setIsResolvingGuess(true);
    setSelectedSlot(null);
    setMessage("");
    setRevealState(null);
    setHeldRevealState(null);
    setGlobalRevealState(null);
    setPostRevealState(null);
    setPhraseRevealState(revealEntries);

    window.setTimeout(() => {
      setPhraseRevealState(null);
      setSolvedWords({});
      setSlotDrafts(revealedDrafts);
      setSlotLocks(revealedLocks);
      setSlotMarks(revealedMarks);
      setGuessesUsed(maxGuesses);
      setGameState("lost");
      setIsResolvingGuess(false);
    }, revealTotalMs);
    setGuessesUsed(maxGuesses);
  };

  const shareResult = async () => {
    if (!puzzle || gameState === "playing") return;
    const status = gameState === "won" ? `${guessesUsed}/${maxGuesses}` : "X";
    const lines = [
      `Verble ${puzzle.puzzleDate}`,
      `Result: ${status}`,
      toPublicAppUrl("/verble"),
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
  }, [canSubmitWordGuess, gameState, isResolvingGuess, keyboardState, phraseGuess, selectedSlotMeta, solvedWords]);
 
  const latestAttempt = wordAttempts.length > 0 ? wordAttempts[wordAttempts.length - 1] : null;
  const earlierAttempts = wordAttempts.slice(0, -1).reverse();

  if (loading) {
    return (
      <div className="verble-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <section className="card legal-card">
            <h1 className="page-title"><LoadingLabel text="Loading puzzle" /></h1>
          </section>
        </main>
      </div>
    );
  }

  if (archiveLock) {
    return (
      <div className="verble-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <ArchiveLockGate archiveHref={archiveHref} title={archiveLock.title} description={archiveLock.description} />
        </main>
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="verble-shell">
        <MainNav label={navLabel} hideToday={hideToday} />
        <main className="container">
          <DailydabbleUnavailable
            title="Verble unavailable"
            message={error || "No puzzle available right now."}
          />
        </main>
      </div>
    );
  }

  const resultLabel = getPerformanceLabel(gameState === "won", guessesUsed, maxGuesses);
  const answerLine = puzzle.slots.map((slot) => `${slot.display}${slot.separator}`).join("").trimEnd();
  const contextChipLabel = isArchiveView
    ? `ARCHIVE GAME #${puzzle.archiveGameNumber ?? ""}`.trim()
    : "TODAY'S GAME";

  return (
    <div className="verble-shell">
      <MainNav label={navLabel} hideToday={hideToday} />
      <main className="container">
        <section className="card verble-card">
          <div className="game-meta-row">
            <span className="chip">{contextChipLabel}</span>
            <span className="chip">{`Guesses ${guessesUsed}/${maxGuesses}`}</span>
            <button className="how-to-play-btn" type="button" onClick={() => setIsHowToPlayOpen(true)}>
              ? How to play
            </button>
          </div>

          <div className="phrase-layout">
            {puzzle.slots.map((slot) => {
              const solved = solvedWords[slot.index];
              const isSelected = selectedSlot === slot.index;
              const isPlayable = gameState === "playing" && !solved && !isResolvingGuess;
              const isRevealing = revealState?.slotIndex === slot.index;
              const heldRevealForSlot = heldRevealState?.slotIndex === slot.index ? heldRevealState : null;
              const phraseRevealForSlot = phraseRevealState?.find((entry) => entry.slotIndex === slot.index) || null;
              const globalRevealForSlot = globalRevealState?.entries.find((entry) => entry.slotIndex === slot.index);
              const postRevealForSlot = postRevealState?.slotIndex === slot.index ? postRevealState : null;
              const persistedLocks = slotLocks[slot.index] || Array.from({ length: slot.length }, () => false);
              const persistedMarks = slotMarks[slot.index] || Array.from({ length: slot.length }, () => "empty");
              const baseLetters = heldRevealForSlot?.letters
                || slotDrafts[slot.index]
                || Array.from({ length: slot.length }, () => "");
              const tileLetters = phraseRevealForSlot
                ? phraseRevealForSlot.letters
                : solved
                  ? solved.split("")
                  : baseLetters.map((letter, letterIndex) => {
                      if (postRevealForSlot?.revealIndices.includes(letterIndex)) {
                        return postRevealForSlot.letters[letterIndex] ?? "";
                      }
                      if (globalRevealForSlot?.revealIndices.includes(letterIndex)) {
                        return globalRevealForSlot.letters[letterIndex] || letter;
                      }
                      if (isRevealing && revealState?.revealIndices.includes(letterIndex)) {
                        return revealState.letters[letterIndex] || letter;
                      }
                      return letter;
                    });
              const displayChars = buildDisplayedWordChars(slot, tileLetters);
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
                      {displayChars.map((item, index) => (
                        (() => {
                          const letterIndex = item.letterIndex ?? -1;
                          const slotRevealIndex = item.kind === "letter"
                            && revealState?.slotIndex === slot.index
                            && !!revealState?.revealIndices.includes(letterIndex);
                          const slotRevealOrder = revealState?.slotIndex === slot.index
                            ? revealState.revealIndices.indexOf(letterIndex)
                            : -1;
                          const heldRevealIndex = item.kind === "letter"
                            && heldRevealForSlot?.slotIndex === slot.index
                            && !!heldRevealForSlot.revealIndices.includes(letterIndex);
                          const postRevealIndex = item.kind === "letter"
                            && postRevealForSlot?.slotIndex === slot.index
                            && !!postRevealForSlot.revealIndices.includes(letterIndex);
                          const postRevealOrder = postRevealForSlot?.slotIndex === slot.index
                            ? postRevealForSlot.revealIndices.indexOf(letterIndex)
                            : -1;
                          const phraseRevealIndex = item.kind === "letter" && !!phraseRevealForSlot?.revealIndices.includes(letterIndex);
                          const phraseRevealOrder = phraseRevealForSlot?.revealIndices.indexOf(letterIndex) ?? -1;
                          const globalRevealIndex = item.kind === "letter" && !!globalRevealForSlot?.revealIndices.includes(letterIndex);
                          const activeRevealIndex = slotRevealIndex || postRevealIndex || globalRevealIndex || phraseRevealIndex;
                          const preRevealLetter = item.kind === "letter" ? (baseLetters[letterIndex] ?? "") : "";
                          const finalRevealLetter = item.kind === "letter" ? (item.value || "") : "";

                          let feedbackClass = "";
                          let currentVisualFeedback: LetterFeedback | "empty" = "empty";
                          if (item.kind === "letter") {
                            if (slotRevealIndex) {
                              currentVisualFeedback = revealState?.startFeedback[letterIndex] || "empty";
                            } else if (solved && !phraseRevealIndex) {
                              currentVisualFeedback = "correct";
                            } else if (heldRevealIndex) {
                              currentVisualFeedback = heldRevealForSlot?.feedback[letterIndex] || "empty";
                            } else {
                              currentVisualFeedback = persistedMarks[letterIndex] || "empty";
                            }

                            if (slotRevealIndex) {
                              feedbackClass = revealState?.feedback[letterIndex] || "absent";
                            } else if (postRevealIndex) {
                              feedbackClass = postRevealForSlot?.feedback[letterIndex] || "empty";
                            } else if (globalRevealIndex) {
                              feedbackClass = globalRevealForSlot?.feedback[letterIndex] || "correct";
                            } else if (phraseRevealIndex) {
                              feedbackClass = phraseRevealForSlot?.feedback[letterIndex] || "correct";
                            } else if (heldRevealIndex) {
                              feedbackClass = heldRevealForSlot?.feedback[letterIndex] || "absent";
                            } else if (!solved) {
                              feedbackClass = persistedMarks[letterIndex] || "empty";
                            }
                          }

                          const flipStartVisual = getFlipVisual(currentVisualFeedback);
                          const flipEndVisual = getFlipVisual((feedbackClass as LetterFeedback | "empty") || "empty");

                          return (
                            <span key={`${slot.index}-${index}`} className="slot-char-group">
                              <span
                                className={`slot-tile ${item.kind === "fixed" ? "fixed" : ""} ${item.kind === "letter" && solved && !phraseRevealForSlot ? "solved" : ""} ${item.kind === "letter" && isSelected ? "selected" : ""} ${item.kind === "letter" && item.value ? "filled" : ""} ${item.kind === "letter" && !activeRevealIndex ? feedbackClass : ""} ${item.kind === "letter" && activeRevealIndex ? "reveal" : ""} ${item.kind === "letter" && postRevealIndex ? "reveal-swap" : ""} ${item.kind === "letter" && persistedLocks[letterIndex] ? "locked" : ""}`}
                                style={
                                  item.kind === "letter" && activeRevealIndex
                                    ? ({
                                        "--flip-start-bg": flipStartVisual.bg,
                                        "--flip-start-border": flipStartVisual.border,
                                        "--flip-start-color": flipStartVisual.color,
                                        "--flip-end-bg": flipEndVisual.bg,
                                        "--flip-end-border": flipEndVisual.border,
                                        "--flip-end-color": flipEndVisual.color,
                                        "--flip-delay": `${
                                          slotRevealIndex
                                            ? Math.max(0, slotRevealOrder) * FLIP_STAGGER_MS
                                            : postRevealIndex
                                              ? Math.max(0, postRevealOrder) * FLIP_STAGGER_MS
                                              : globalRevealIndex
                                                ? 0
                                                : (phraseRevealForSlot?.wordDelayMs || 0) + Math.max(0, phraseRevealOrder) * FLIP_STAGGER_MS
                                        }ms`,
                                        "--flip-duration": `${
                                          globalRevealIndex ? SLOW_FLIP_DURATION_MS : FLIP_DURATION_MS
                                        }ms`,
                                      } as CSSProperties)
                                    : undefined
                                }
                              >
                                {item.kind === "letter" && postRevealIndex ? (
                                  <span className="tile-letter-stack" aria-hidden="true">
                                    <span className="tile-letter-face tile-letter-face-front">{preRevealLetter}</span>
                                    <span className="tile-letter-face tile-letter-face-back">{finalRevealLetter}</span>
                                  </span>
                                ) : (
                                  item.value || ""
                                )}
                              </span>
                              {item.kind === "letter" && item.trailingFixed ? (
                                <span
                                  className={`slot-inline-fixed ${item.trailingFixed.includes("'") ? "apostrophe" : ""} ${item.trailingFixed.includes("-") ? "hyphen" : ""} ${item.trailingFixed.includes(",") ? "comma" : ""} ${item.trailingFixed.includes(";") ? "semicolon" : ""}`}
                                  aria-hidden="true"
                                >
                                  {item.trailingFixed}
                                </span>
                              ) : null}
                            </span>
                          );
                        })()
                      ))}
                    </span>
                  </button>
                  {slot.separator ? (
                    <span
                      className={`slot-sep ${slot.separator.includes(",") ? "comma" : ""} ${slot.separator.includes(";") ? "semicolon" : ""}`}
                    >
                      {slot.separator}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="phrase-submit-row">
            {gameState === "playing" ? (
              <button
                className="guess-submit-btn phrase-submit-trigger"
                type="button"
                onClick={() => {
                  setPhraseGuessError("");
                  setIsPhraseDialogOpen(true);
                }}
                disabled={isResolvingGuess}
              >
                Guess full phrase
              </button>
            ) : (
              <button
                className="guess-submit-btn"
                type="button"
                onClick={() => setIsResultOpen(true)}
              >
                Review result
              </button>
            )}
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
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="verble-backspace-icon">
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

          {allSolved && gameState === "playing" ? <p className="message" data-kind="won">All words solved.</p> : null}

          {wordAttempts.length > 0 ? (
            <div className="guess-history-wrap">
              <button
                type="button"
                className="guess-history-toggle"
                aria-expanded={isHistoryOpen}
                aria-controls="verble-guess-history-panel"
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
                <ul id="verble-guess-history-panel" className="guess-history-list">
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

      {isPhraseDialogOpen && gameState === "playing" ? (
        <div className="result-modal-backdrop" onClick={() => setIsPhraseDialogOpen(false)}>
          <section
            className="result-modal-panel phrase-guess-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="phrase-guess-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="result-modal-close"
              type="button"
              onClick={() => setIsPhraseDialogOpen(false)}
              aria-label="Close full phrase guess dialog"
            >
              ×
            </button>
            <h2 className="result-modal-title phrase-guess-title" id="phrase-guess-title">
              Guess the full phrase
            </h2>
            <p className="result-modal-copy phrase-guess-warning">
              Warning: a correct phrase wins immediately, but a miss ends the game.
            </p>
            <form
              className="phrase-guess-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitPhraseGuess();
              }}
            >
              <input
                id="phraseGuess"
                className="guess-input phrase-submit-input"
                type="text"
                name="phraseGuess"
                aria-label="Full phrase"
                value={phraseGuess}
                onChange={(event) => {
                  setPhraseGuess(event.target.value);
                  setPhraseGuessError("");
                }}
                placeholder="Type the whole phrase"
                autoComplete="off"
                autoFocus
              />
              {phraseGuessError ? <p className="phrase-guess-error">{phraseGuessError}</p> : null}
              <div className="phrase-guess-actions">
                <button
                  className="guess-submit-btn phrase-guess-secondary"
                  type="button"
                  onClick={() => setIsPhraseDialogOpen(false)}
                >
                  Keep solving
                </button>
                <button className="guess-submit-btn" type="submit">
                  Submit
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isHowToPlayOpen ? (
        <HowToPlayDialog
          title="How to play Verble"
          subtitle="Guess the daily phrase one word at a time."
          steps={[
            "Pick one blank word in the phrase.",
            "Guess that word with the keyboard.",
            "Green letters are correct. Yellow letters are in the word, but in another spot.",
            "You can guess the full phrase, but a miss ends the game.",
          ]}
          onClose={() => setIsHowToPlayOpen(false)}
        />
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
            <p className="result-modal-copy">{resultLabel}</p>
            <p className="result-modal-answer">{answerLine}</p>
            <div className="result-modal-actions">
              <button className="admin-btn-like" type="button" onClick={() => void shareResult()}>
                Copy Result
              </button>
              <a className="admin-btn-like" href="/">DailyDabble</a>
              <a className="admin-btn-like primary" href={archiveHref}>Play Archive Games</a>
            </div>
            {copyStatus ? <p className="result-modal-copy">{copyStatus}</p> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
