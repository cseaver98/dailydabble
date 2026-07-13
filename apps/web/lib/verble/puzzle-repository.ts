import { getVerbleSupabaseAdmin } from "./supabase";

const DEFAULT_TIMEZONE = process.env.TIMEZONE || "America/New_York";

type Slot = {
  index: number;
  length: number;
  display: string;
  separator: string;
};

type ScheduleRow = { puzzle_date: string; phrase_id: string };
type PhraseRow = {
  id: string;
  phrase_text: string;
  normalized_phrase: string;
  source_note?: string | null;
  status: "pending_review" | "approved";
  created_at?: string | null;
};

export type VerblePuzzle = {
  puzzleId: string;
  puzzleDate: string;
  archiveGameNumber: number;
  phraseTemplate: string;
  sourceNote: string | null;
  slots: Slot[];
  maxGuesses: number;
  answerWords: string[];
};

const getArchiveGameNumber = async (date: string): Promise<number> => {
  const supabase = getVerbleSupabaseAdmin();
  const { count, error } = await supabase
    .from("daily_schedule")
    .select("*", { count: "exact", head: true })
    .lte("puzzle_date", date);

  if (error) {
    throw new Error(`Failed to count verble archive games: ${error.message}`);
  }

  return count ?? 0;
};

const BASE_DICTIONARY_WORDS = [
  "and", "to", "of", "for", "with", "from", "you", "your", "this", "that", "never", "always", "better", "best", "good", "great", "today", "tomorrow", "dream", "build", "learn", "focus", "trust", "work", "hard", "smart", "think", "quick", "slow", "grow", "shine",
];

const WORD_PATTERN = /[a-z]+(?:['-][a-z]+)*/g;
const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const getDateInTimeZone = (timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to compute date in timezone");
  }

  return `${year}-${month}-${day}`;
};

const normalizeWord = (value: string): string => value.toLowerCase().replace(/[^a-z]/g, "");

const normalizeWordSurface = (value: string): string =>
  String(value || "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .match(/^[a-z]+(?:['-][a-z]+)*$/)?.[0] || "";

const normalizePhraseWord = (value: string): string =>
  String(value || "")
    .toLowerCase()
    .replace(/['-]/g, "")
    .replace(/[^a-z]/g, "");

const parsePhrase = (rawPhrase: string) => {
  const source = rawPhrase.trim();
  const slots: Slot[] = [];
  const answerWords: string[] = [];
  let template = "";

  const wordRegex = /([A-Za-z]+(?:['-][A-Za-z]+)*)([^A-Za-z'-]*)/g;
  let match: RegExpExecArray | null = null;

  while ((match = wordRegex.exec(source))) {
    const word = match[1];
    const separator = match[2] || "";
    const normalized = normalizePhraseWord(word);
    if (!normalized) {
      continue;
    }

    slots.push({
      index: slots.length,
      length: normalized.length,
      display: word,
      separator,
    });
    answerWords.push(normalized);
    template += `${word.replace(/[A-Za-z]/g, "_")}${separator}`;
  }

  return { slots, answerWords, template: template.trimEnd() };
};

const mapPuzzle = async (scheduleRow: ScheduleRow, phraseRow: PhraseRow): Promise<VerblePuzzle> => {
  const parsed = parsePhrase(phraseRow.phrase_text);
  const archiveGameNumber = await getArchiveGameNumber(scheduleRow.puzzle_date);

  return {
    puzzleId: phraseRow.id,
    puzzleDate: scheduleRow.puzzle_date,
    archiveGameNumber,
    phraseTemplate: parsed.template,
    sourceNote: phraseRow.source_note?.trim() || null,
    slots: parsed.slots,
    maxGuesses: 6,
    answerWords: parsed.answerWords,
  };
};

const getPuzzleByScheduleDate = async (date: string): Promise<VerblePuzzle | null> => {
  const supabase = getVerbleSupabaseAdmin();

  const { data: scheduleRow, error: scheduleError } = await supabase
    .from("daily_schedule")
    .select("puzzle_date,phrase_id")
    .eq("puzzle_date", date)
    .maybeSingle<ScheduleRow>();

  if (scheduleError) {
    throw new Error(`Failed to load verble schedule: ${scheduleError.message}`);
  }
  if (!scheduleRow) {
    return null;
  }

  const { data: phraseRow, error: phraseError } = await supabase
    .from("phrases")
    .select("id,phrase_text,normalized_phrase,source_note,status,created_at")
    .eq("id", scheduleRow.phrase_id)
    .maybeSingle<PhraseRow>();

  if (phraseError) {
    throw new Error(`Failed to load verble phrase: ${phraseError.message}`);
  }
  if (!phraseRow) {
    return null;
  }

  return mapPuzzle(scheduleRow, phraseRow);
};

const autoScheduleApprovedPhraseForDate = async (date: string): Promise<VerblePuzzle | null> => {
  const supabase = getVerbleSupabaseAdmin();

  const { data: approvedRows, error: approvedError } = await supabase
    .from("phrases")
    .select("id,phrase_text,normalized_phrase,source_note,status,created_at")
    .eq("status", "approved")
    .order("reviewed_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5000);

  if (approvedError) {
    throw new Error(`Failed to load approved verble phrases: ${approvedError.message}`);
  }

  const candidates = (Array.isArray(approvedRows) ? approvedRows : []) as PhraseRow[];
  for (const candidate of candidates) {
    const { data: alreadyScheduled, error: scheduleLookupError } = await supabase
      .from("daily_schedule")
      .select("puzzle_date")
      .eq("phrase_id", candidate.id)
      .maybeSingle<{ puzzle_date: string }>();

    if (scheduleLookupError) {
      throw new Error(`Failed to check verble schedule usage: ${scheduleLookupError.message}`);
    }

    if (alreadyScheduled) {
      continue;
    }

    const { error: insertError } = await supabase.from("daily_schedule").insert({
      puzzle_date: date,
      phrase_id: candidate.id,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        const existing = await getPuzzleByScheduleDate(date);
        if (existing) {
          return existing;
        }
        continue;
      }
      throw new Error(`Failed to auto-schedule verble puzzle: ${insertError.message}`);
    }

    return mapPuzzle({ puzzle_date: date, phrase_id: candidate.id }, candidate);
  }

  return null;
};

export const getTodayVerblePuzzle = async (): Promise<VerblePuzzle | null> => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const scheduled = await getPuzzleByScheduleDate(today);
  if (scheduled) {
    return scheduled;
  }
  return autoScheduleApprovedPhraseForDate(today);
};

export const getVerblePuzzleByDate = async (date: string): Promise<VerblePuzzle | null> => {
  if (!isDateString(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  return getPuzzleByScheduleDate(date);
};

export const listVerbleArchive = async (limit = 120): Promise<Array<{ puzzleDate: string }>> => {
  const supabase = getVerbleSupabaseAdmin();
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);

  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .lt("puzzle_date", today)
    .order("puzzle_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load verble archive: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({ puzzleDate: (row as { puzzle_date: string }).puzzle_date }));
};

export const normalizePhrase = (value: string): string => {
  const words = (value.toLowerCase().match(WORD_PATTERN) || []).map((item) => normalizePhraseWord(item)).filter(Boolean);
  return words.join(" ");
};

export const normalizePhraseWithPunctuation = (value: string): string => {
  const sanitized = String(value || "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[‐‑‒–—―]/g, "-");
  const words = (sanitized.match(WORD_PATTERN) || []).map((item) => normalizeWordSurface(item)).filter(Boolean);
  return words.join(" ");
};

type LetterFeedback = "correct" | "present" | "absent";

const evaluateWordGuess = (guess: string, target: string): LetterFeedback[] => {
  const result: LetterFeedback[] = new Array(target.length).fill("absent");
  const targetChars = target.split("");
  const guessChars = guess.split("");
  const remaining: Record<string, number> = {};

  for (let i = 0; i < targetChars.length; i += 1) {
    const t = targetChars[i];
    const g = guessChars[i];
    if (g === t) {
      result[i] = "correct";
    } else {
      remaining[t] = (remaining[t] || 0) + 1;
    }
  }

  for (let i = 0; i < guessChars.length; i += 1) {
    if (result[i] === "correct") {
      continue;
    }
    const g = guessChars[i];
    if ((remaining[g] || 0) > 0) {
      result[i] = "present";
      remaining[g] -= 1;
    }
  }

  return result;
};

const validateDictionaryGuess = async ({
  supabase,
  parsed,
  slotIndex,
  surfaceGuess,
  normalizedGuess,
}: {
  supabase: ReturnType<typeof getVerbleSupabaseAdmin>;
  parsed: ReturnType<typeof parsePhrase>;
  slotIndex: number;
  surfaceGuess: string;
  normalizedGuess: string;
}) => {
  const target = parsed.answerWords[slotIndex];
  if (!target) {
    throw new Error("Selected slot is invalid");
  }
  if (normalizedGuess.length !== target.length) {
    throw new Error(`Word must be ${target.length} letters for this slot.`);
  }

  const exactSurfaceMatch = normalizeWordSurface(parsed.slots[slotIndex]?.display || "") === surfaceGuess;
  const requiresExactPunctuation = /['-]/.test(surfaceGuess);
  const inAnswer = parsed.answerWords.includes(normalizedGuess);
  let isValidDictionaryWord = requiresExactPunctuation ? false : inAnswer;

  if (requiresExactPunctuation && exactSurfaceMatch) {
    isValidDictionaryWord = true;
  } else if (!inAnswer || requiresExactPunctuation) {
    const { data: dictionaryRow, error: dictionaryError } = await supabase
      .from("dictionary_words")
      .select("word")
      .eq("word", requiresExactPunctuation ? surfaceGuess : normalizedGuess)
      .eq("is_active", true)
      .maybeSingle<{ word: string }>();

    if (dictionaryError) {
      const fallback = requiresExactPunctuation ? false : BASE_DICTIONARY_WORDS.includes(normalizedGuess);
      isValidDictionaryWord = fallback;
    } else {
      isValidDictionaryWord = Boolean(dictionaryRow);
    }
  }

  if (!isValidDictionaryWord) {
    throw new Error("That word is not in the allowed dictionary.");
  }

  return target;
};

export const submitVerbleWordGuess = async ({
  puzzleId,
  slotIndex,
  guessWord,
}: {
  puzzleId: string;
  slotIndex: number;
  guessWord: string;
}): Promise<{ feedback: LetterFeedback[]; isCorrect: boolean; normalizedGuess: string }> => {
  const supabase = getVerbleSupabaseAdmin();
  const surfaceGuess = normalizeWordSurface(guessWord);
  const normalizedGuess = normalizeWord(surfaceGuess);
  if (!normalizedGuess) {
    throw new Error("Guess is required");
  }

  const { data: phraseRow, error: phraseError } = await supabase
    .from("phrases")
    .select("id,phrase_text")
    .eq("id", puzzleId)
    .maybeSingle<{ id: string; phrase_text: string }>();

  if (phraseError) {
    throw new Error(`Failed to load verble phrase: ${phraseError.message}`);
  }
  if (!phraseRow) {
    throw new Error("Puzzle not found");
  }

  const parsed = parsePhrase(phraseRow.phrase_text);
  const target = await validateDictionaryGuess({ supabase, parsed, slotIndex, surfaceGuess, normalizedGuess });

  const feedback = evaluateWordGuess(normalizedGuess, target);
  return {
    feedback,
    isCorrect: normalizedGuess === target,
    normalizedGuess,
  };
};
