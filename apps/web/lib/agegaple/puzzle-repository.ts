import type {
  ArchivePuzzleListItem,
  PuzzleAnswer,
  PuzzlePublic,
  RelationshipType,
  RoundGuessFeedback,
} from "@/lib/agegaple/types";
import { getSupabaseAdmin } from "@/lib/agegaple/supabase/server";

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

type ImageRow = {
  image_url: string;
  thumb_url: string | null;
  file_title: string | null;
  attribution_text: string | null;
  license: string | null;
};

type PuzzleRow = {
  id: string;
  puzzle_date: string;
  puzzle_candidates: {
    id: string;
    computed_age_gap_years: number;
    person_a_photo_year: number;
    person_b_photo_year: number;
    editorial_person_a_bio: string | null;
    editorial_person_a_bio_url: string | null;
    editorial_person_b_bio: string | null;
    editorial_person_b_bio_url: string | null;
    couples: {
      relationship_type: RelationshipType;
      person_a: { name: string; birth_date: string; wikipedia_title: string | null };
      person_b: { name: string; birth_date: string; wikipedia_title: string | null };
    };
    person_a_image: ImageRow;
    person_b_image: ImageRow;
  };
};

type ApprovedCandidateRow = {
  id: string;
  couple_id: string;
};

type UsedCandidateIdRow = {
  candidate_id: string;
  puzzle_candidates?: { couple_id?: string };
};

const relationshipLabelByType: Record<RelationshipType, string> = {
  spouse: "married",
  couple: "a couple",
  former_spouse: "no longer married",
  former_couple: "no longer a couple",
};

const basePuzzleSelect = `
  id,
  puzzle_date,
  puzzle_candidates!inner(
    id,
    computed_age_gap_years,
    person_a_photo_year,
    person_b_photo_year,
    editorial_person_a_bio,
    editorial_person_a_bio_url,
    editorial_person_b_bio,
    editorial_person_b_bio_url,
    couples!inner(
      relationship_type,
      person_a:people!couples_person_a_id_fkey(name,birth_date,wikipedia_title),
      person_b:people!couples_person_b_id_fkey(name,birth_date,wikipedia_title)
    ),
    person_a_image:images!puzzle_candidates_person_a_image_id_fkey(image_url,thumb_url,file_title,attribution_text,license),
    person_b_image:images!puzzle_candidates_person_b_image_id_fkey(image_url,thumb_url,file_title,attribution_text,license)
  )
`;

const getArchiveGameNumber = async (date: string): Promise<number> => {
  const { count, error } = await getSupabaseAdmin()
    .from("daily_puzzles")
    .select("*", { count: "exact", head: true })
    .lte("puzzle_date", date);

  if (error) {
    throw new Error(`Failed to count archive puzzles: ${error.message}`);
  }

  return count ?? 0;
};

const getPuzzleForDate = async (date: string): Promise<PuzzleRow | null> => {
  const { data, error } = await getSupabaseAdmin()
    .from("daily_puzzles")
    .select(basePuzzleSelect)
    .eq("puzzle_date", date)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch puzzle for ${date}: ${error.message}`);
  }

  return data ? (data as unknown as PuzzleRow) : null;
};

const getNextApprovedCandidateId = async (): Promise<string | null> => {
  const supabase = getSupabaseAdmin();
  const { data: usedData, error: usedError } = await supabase
    .from("daily_puzzles")
    .select("candidate_id,puzzle_candidates!inner(couple_id)");

  if (usedError) {
    throw new Error(`Failed to load used candidate ids: ${usedError.message}`);
  }

  const usedRows = (usedData as UsedCandidateIdRow[] | null) ?? [];
  const usedIds = new Set(usedRows.map((row) => row.candidate_id));
  const usedCoupleIds = new Set(
    usedRows.map((row) => row.puzzle_candidates?.couple_id).filter((value): value is string => Boolean(value)),
  );

  const { data: approvedData, error: approvedError } = await supabase
    .from("puzzle_candidates")
    .select("id,couple_id")
    .eq("status", "approved")
    .not("person_a_image_id", "is", null)
    .not("person_b_image_id", "is", null)
    .not("person_a_photo_year", "is", null)
    .not("person_b_photo_year", "is", null)
    .not("license_verified_at", "is", null)
    .order("reviewed_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (approvedError) {
    throw new Error(`Failed to load approved queue: ${approvedError.message}`);
  }

  const approvedQueue = (approvedData as ApprovedCandidateRow[] | null) ?? [];
  return approvedQueue.find((row) => !usedIds.has(row.id) && !usedCoupleIds.has(row.couple_id))?.id ?? null;
};

const assignPuzzleForDateFromQueue = async (date: string): Promise<boolean> => {
  const candidateId = await getNextApprovedCandidateId();
  if (!candidateId) return false;

  const { error } = await getSupabaseAdmin().from("daily_puzzles").insert({
    puzzle_date: date,
    candidate_id: candidateId,
  });

  if (!error || error.code === "23505") {
    return true;
  }

  throw new Error(`Failed to assign queued puzzle for ${date}: ${error.message}`);
};

const ageInPhotoYear = (birthDate: string, photoYear: number): number => {
  const birthYear = Number(String(birthDate).slice(0, 4));
  if (!Number.isInteger(birthYear)) {
    throw new Error("Puzzle has an invalid birth date");
  }
  return photoYear - birthYear;
};

const buildImageAlt = (image: ImageRow, fallbackName: string, photoYear: number): string =>
  image.file_title ?? `${fallbackName} in ${photoYear}`;

const getAttribution = (row: PuzzleRow): string =>
  [
    row.puzzle_candidates.person_a_image.attribution_text || row.puzzle_candidates.person_a_image.license,
    row.puzzle_candidates.person_b_image.attribution_text || row.puzzle_candidates.person_b_image.license,
  ]
    .filter(Boolean)
    .join(" / ") || "Wikimedia Commons";

const buildPublicPuzzle = async (row: PuzzleRow): Promise<PuzzlePublic> => {
  const candidate = row.puzzle_candidates;
  const personAName = candidate.couples.person_a.name;
  const personBName = candidate.couples.person_b.name;
  const relationshipLabel = relationshipLabelByType[candidate.couples.relationship_type];
  const relationshipNote = `${personAName} and ${personBName} are ${relationshipLabel}.`;

  return {
    puzzleId: row.id,
    puzzleDate: row.puzzle_date,
    archiveGameNumber: await getArchiveGameNumber(row.puzzle_date),
    personAName,
    personBName,
    relationshipType: candidate.couples.relationship_type,
    personA: {
      key: "person_a",
      name: personAName,
      imageUrl: candidate.person_a_image.thumb_url || candidate.person_a_image.image_url,
      imageAlt: buildImageAlt(candidate.person_a_image, personAName, candidate.person_a_photo_year),
      photoYear: candidate.person_a_photo_year,
    },
    personB: {
      key: "person_b",
      name: personBName,
      imageUrl: candidate.person_b_image.thumb_url || candidate.person_b_image.image_url,
      imageAlt: buildImageAlt(candidate.person_b_image, personBName, candidate.person_b_photo_year),
      photoYear: candidate.person_b_photo_year,
    },
    editorialContext: {
      relationshipNote,
      personABio: candidate.editorial_person_a_bio?.trim() || null,
      personABioUrl: candidate.editorial_person_a_bio_url?.trim() || null,
      personBBio: candidate.editorial_person_b_bio?.trim() || null,
      personBBioUrl: candidate.editorial_person_b_bio_url?.trim() || null,
    },
  };
};

export const getTodayPuzzle = async (): Promise<PuzzlePublic | null> => {
  const timeZone = process.env.TIMEZONE ?? "America/New_York";
  const today = getDateInTimeZone(timeZone);

  const existingToday = await getPuzzleForDate(today);
  if (existingToday) return buildPublicPuzzle(existingToday);

  if (await assignPuzzleForDateFromQueue(today)) {
    const assignedToday = await getPuzzleForDate(today);
    if (assignedToday) return buildPublicPuzzle(assignedToday);
  }

  return null;
};

export const getPuzzleByDate = async (date: string): Promise<PuzzlePublic | null> => {
  const row = await getPuzzleForDate(date);
  return row ? buildPublicPuzzle(row) : null;
};

type ArchiveRow = {
  puzzle_date: string;
  puzzle_candidates: {
    couples: {
      person_a: { name: string };
      person_b: { name: string };
    };
  };
};

export const listArchivePuzzles = async (): Promise<ArchivePuzzleListItem[]> => {
  const timeZone = process.env.TIMEZONE ?? "America/New_York";
  const today = getDateInTimeZone(timeZone);
  const { data, error } = await getSupabaseAdmin()
    .from("daily_puzzles")
    .select(
      `
      puzzle_date,
      puzzle_candidates!inner(
        couples!inner(
          person_a:people!couples_person_a_id_fkey(name),
          person_b:people!couples_person_b_id_fkey(name)
        )
      )
    `,
    )
    .lt("puzzle_date", today)
    .order("puzzle_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to list archive puzzles: ${error.message}`);
  }

  return ((data as unknown as ArchiveRow[] | null) ?? []).map((row) => {
    const personAName = row.puzzle_candidates.couples.person_a.name;
    const personBName = row.puzzle_candidates.couples.person_b.name;
    return {
      puzzleDate: row.puzzle_date,
      personAName,
      personBName,
      couple: `${personAName} + ${personBName}`,
    };
  });
};

const getPuzzleAnswerRow = async (puzzleId: string): Promise<PuzzleRow | null> => {
  const { data, error } = await getSupabaseAdmin()
    .from("daily_puzzles")
    .select(basePuzzleSelect)
    .eq("id", puzzleId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch puzzle answer: ${error.message}`);
  }

  return data ? (data as unknown as PuzzleRow) : null;
};

const buildPuzzleAnswer = (row: PuzzleRow, guessedAgeGap: number): PuzzleAnswer => {
  const candidate = row.puzzle_candidates;
  const exactAgeGapYears = Number(candidate.computed_age_gap_years);
  const roundedAgeGapYears = Math.round(exactAgeGapYears);
  const absErrorYears = Math.abs(roundedAgeGapYears - guessedAgeGap);
  const personAAgeInPhotoYear = ageInPhotoYear(candidate.couples.person_a.birth_date, candidate.person_a_photo_year);
  const personBAgeInPhotoYear = ageInPhotoYear(candidate.couples.person_b.birth_date, candidate.person_b_photo_year);

  return {
    puzzleId: row.id,
    guessType: "age_gap",
    guessYears: guessedAgeGap,
    exactAgeGapYears,
    roundedAgeGapYears,
    absErrorYears,
    isCorrect: guessedAgeGap === roundedAgeGapYears,
    personABirthDate: candidate.couples.person_a.birth_date,
    personBBirthDate: candidate.couples.person_b.birth_date,
    personAAgeInPhotoYear,
    personBAgeInPhotoYear,
    attribution: getAttribution(row),
  };
};

export const submitRoundGuess = async ({
  puzzleId,
  guessedAgeGap,
}: {
  puzzleId: string;
  guessedAgeGap: number;
}): Promise<RoundGuessFeedback | null> => {
  const row = await getPuzzleAnswerRow(puzzleId);
  if (!row) return null;

  const gap = buildPuzzleAnswer(row, guessedAgeGap);

  const { error } = await getSupabaseAdmin().from("guesses").insert({
    puzzle_id: puzzleId,
    guess_type: "round",
    guessed_age_gap: guessedAgeGap,
    feedback: {
      gap: {
        roundedAgeGapYears: gap.roundedAgeGapYears,
        exactAgeGapYears: gap.exactAgeGapYears,
        absErrorYears: gap.absErrorYears,
        isCorrect: gap.isCorrect,
      },
    },
  });
  if (error) {
    throw new Error(`Failed to save round guess: ${error.message}`);
  }

  return {
    puzzleId,
    guessType: "round",
    gap,
  };
};
