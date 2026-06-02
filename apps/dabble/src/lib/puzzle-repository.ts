import { getDabbleSupabaseAdmin } from "./supabase";

const DEFAULT_TIMEZONE = process.env.PUZZLE_TIMEZONE || "America/New_York";

type Slot = {
  index: number;
  length: number;
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

export type DabblePuzzle = {
  puzzleId: string;
  puzzleDate: string;
  phraseTemplate: string;
  slots: Slot[];
  maxGuesses: number;
  answerWords: string[];
};

const BASE_DICTIONARY_WORDS = [
  "and", "to", "of", "for", "with", "from", "you", "your", "this", "that", "never", "always", "better", "best", "good", "great", "today", "tomorrow", "dream", "build", "learn", "focus", "trust", "work", "hard", "smart", "think", "quick", "slow", "grow", "shine",
];

const WORD_PATTERN = /[a-z]+/g;
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

const parsePhrase = (rawPhrase: string) => {
  const source = rawPhrase.trim();
  const slots: Slot[] = [];
  const answerWords: string[] = [];
  let template = "";

  const wordRegex = /([A-Za-z]+)([^A-Za-z]*)/g;
  let match: RegExpExecArray | null = null;

  while ((match = wordRegex.exec(source))) {
    const word = match[1];
    const separator = match[2] || "";
    const normalized = normalizeWord(word);
    if (!normalized) {
      continue;
    }

    slots.push({
      index: slots.length,
      length: normalized.length,
      separator,
    });
    answerWords.push(normalized);
    template += `${"_".repeat(normalized.length)}${separator}`;
  }

  return { slots, answerWords, template: template.trimEnd() };
};

const mapPuzzle = async (scheduleRow: ScheduleRow, phraseRow: PhraseRow): Promise<DabblePuzzle> => {
  const parsed = parsePhrase(phraseRow.phrase_text);

  return {
    puzzleId: phraseRow.id,
    puzzleDate: scheduleRow.puzzle_date,
    phraseTemplate: parsed.template,
    slots: parsed.slots,
    maxGuesses: 6,
    answerWords: parsed.answerWords,
  };
};

const getPuzzleByScheduleDate = async (date: string): Promise<DabblePuzzle | null> => {
  const supabase = getDabbleSupabaseAdmin();

  const { data: scheduleRow, error: scheduleError } = await supabase
    .from("daily_schedule")
    .select("puzzle_date,phrase_id")
    .eq("puzzle_date", date)
    .maybeSingle<ScheduleRow>();

  if (scheduleError) {
    throw new Error(`Failed to load dabble schedule: ${scheduleError.message}`);
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
    throw new Error(`Failed to load dabble phrase: ${phraseError.message}`);
  }
  if (!phraseRow) {
    return null;
  }

  return mapPuzzle(scheduleRow, phraseRow);
};

const autoScheduleApprovedPhraseForDate = async (date: string): Promise<DabblePuzzle | null> => {
  const supabase = getDabbleSupabaseAdmin();

  const { data: approvedRows, error: approvedError } = await supabase
    .from("phrases")
    .select("id,phrase_text,normalized_phrase,source_note,status,created_at")
    .eq("status", "approved")
    .order("reviewed_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5000);

  if (approvedError) {
    throw new Error(`Failed to load approved dabble phrases: ${approvedError.message}`);
  }

  const candidates = (Array.isArray(approvedRows) ? approvedRows : []) as PhraseRow[];
  for (const candidate of candidates) {
    const { data: alreadyScheduled, error: scheduleLookupError } = await supabase
      .from("daily_schedule")
      .select("puzzle_date")
      .eq("phrase_id", candidate.id)
      .maybeSingle<{ puzzle_date: string }>();

    if (scheduleLookupError) {
      throw new Error(`Failed to check dabble schedule usage: ${scheduleLookupError.message}`);
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
      throw new Error(`Failed to auto-schedule dabble puzzle: ${insertError.message}`);
    }

    return mapPuzzle({ puzzle_date: date, phrase_id: candidate.id }, candidate);
  }

  return null;
};

export const getTodayDabblePuzzle = async (): Promise<DabblePuzzle | null> => {
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);
  const scheduled = await getPuzzleByScheduleDate(today);
  if (scheduled) {
    return scheduled;
  }
  return autoScheduleApprovedPhraseForDate(today);
};

export const getDabblePuzzleByDate = async (date: string): Promise<DabblePuzzle | null> => {
  if (!isDateString(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  return getPuzzleByScheduleDate(date);
};

export const listDabbleArchive = async (limit = 120): Promise<Array<{ puzzleDate: string }>> => {
  const supabase = getDabbleSupabaseAdmin();
  const today = getDateInTimeZone(DEFAULT_TIMEZONE);

  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .lt("puzzle_date", today)
    .order("puzzle_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load dabble archive: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({ puzzleDate: (row as { puzzle_date: string }).puzzle_date }));
};

export const normalizePhrase = (value: string): string => {
  const words = (value.toLowerCase().match(WORD_PATTERN) || []).map((item) => item.trim()).filter(Boolean);
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

export const submitDabbleWordGuess = async ({
  puzzleId,
  slotIndex,
  guessWord,
}: {
  puzzleId: string;
  slotIndex: number;
  guessWord: string;
}): Promise<{ feedback: LetterFeedback[]; isCorrect: boolean; normalizedGuess: string }> => {
  const supabase = getDabbleSupabaseAdmin();
  const normalizedGuess = normalizeWord(guessWord);
  if (!normalizedGuess) {
    throw new Error("Guess is required");
  }

  const { data: phraseRow, error: phraseError } = await supabase
    .from("phrases")
    .select("id,phrase_text")
    .eq("id", puzzleId)
    .maybeSingle<{ id: string; phrase_text: string }>();

  if (phraseError) {
    throw new Error(`Failed to load dabble phrase: ${phraseError.message}`);
  }
  if (!phraseRow) {
    throw new Error("Puzzle not found");
  }

  const parsed = parsePhrase(phraseRow.phrase_text);
  const target = parsed.answerWords[slotIndex];
  if (!target) {
    throw new Error("Selected slot is invalid");
  }
  if (normalizedGuess.length !== target.length) {
    throw new Error(`Word must be ${target.length} letters for this slot.`);
  }

  const inAnswer = parsed.answerWords.includes(normalizedGuess);
  let isValidDictionaryWord = inAnswer;
  if (!inAnswer) {
    const { data: dictionaryRow, error: dictionaryError } = await supabase
      .from("dictionary_words")
      .select("word")
      .eq("word", normalizedGuess)
      .eq("is_active", true)
      .maybeSingle<{ word: string }>();

    if (dictionaryError) {
      const fallback = BASE_DICTIONARY_WORDS.includes(normalizedGuess);
      isValidDictionaryWord = fallback;
    } else {
      isValidDictionaryWord = Boolean(dictionaryRow);
    }
  }

  if (!isValidDictionaryWord) {
    throw new Error("That word is not in the allowed dictionary.");
  }

  const feedback = evaluateWordGuess(normalizedGuess, target);
  return {
    feedback,
    isCorrect: normalizedGuess === target,
    normalizedGuess,
  };
};
