import type {
  ArchivePuzzleListItem,
  CandidateFilter,
  CandidateStatus,
  PuzzleAnswer,
  PuzzlePublic,
  QueueHealth,
  ReviewCandidate,
  ReviewCandidateDetails,
  ReviewCandidateDetailsUpdate,
} from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";

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

const getDateOffsetInTimeZone = (timeZone: string, offsetDays: number): string => {
  const now = new Date();
  const shifted = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(shifted);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to compute offset date in timezone");
  }

  return `${year}-${month}-${day}`;
};

type PuzzleRow = {
  id: string;
  puzzle_date: string;
  puzzle_candidates: {
    couple_id: string;
    computed_age_gap_years: number;
    review_notes: string | null;
    editorial_person_a_bio: string | null;
    editorial_person_a_bio_url: string | null;
    editorial_person_b_bio: string | null;
    editorial_person_b_bio_url: string | null;
    editorial_couple_context: string | null;
    editorial_couple_context_url: string | null;
    couples: {
      relationship_type: "spouse" | "couple" | "former_spouse" | "former_couple";
      person_a: { name: string; birth_date: string | null; wikipedia_title: string | null };
      person_b: { name: string; birth_date: string | null; wikipedia_title: string | null };
    };
    images: {
      image_url: string;
      file_title: string | null;
      attribution_text: string | null;
      license: string | null;
    };
  };
};

type ApprovedCandidateRow = {
  id: string;
  couple_id: string;
};

type UsedCandidateIdRow = {
  candidate_id: string;
};

type CandidateStatusRow = {
  id: string;
  status: CandidateStatus;
};

const buildImageAlt = (
  row: Pick<PuzzleRow, "puzzle_candidates">,
  fileTitle: string | null,
): string =>
  fileTitle ??
  `${row.puzzle_candidates.couples.person_a.name} and ${row.puzzle_candidates.couples.person_b.name}`;

const buildPublicPuzzle = (
  row: PuzzleRow,
  editorialContext: PuzzlePublic["editorialContext"],
): PuzzlePublic => {
  return {
    puzzleId: row.id,
    puzzleDate: row.puzzle_date,
    personAName: row.puzzle_candidates.couples.person_a.name,
    personBName: row.puzzle_candidates.couples.person_b.name,
    relationshipType: row.puzzle_candidates.couples.relationship_type,
    imageUrl: row.puzzle_candidates.images.image_url,
    imageAlt: buildImageAlt(row, row.puzzle_candidates.images.file_title),
    editorialContext,
  };
};

const basePuzzleSelect = `
  id,
  puzzle_date,
  puzzle_candidates!inner(
    couple_id,
    computed_age_gap_years,
    review_notes,
    editorial_person_a_bio,
    editorial_person_a_bio_url,
    editorial_person_b_bio,
    editorial_person_b_bio_url,
    editorial_couple_context,
    editorial_couple_context_url,
    couples!inner(
      relationship_type,
      person_a:people!couples_person_a_id_fkey(name,birth_date,wikipedia_title),
      person_b:people!couples_person_b_id_fkey(name,birth_date,wikipedia_title)
    ),
    images!inner(image_url,file_title,attribution_text,license)
  )
`;

const getPuzzleForDate = async (date: string): Promise<PuzzleRow | null> => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

  const usedIds = new Set((usedData as UsedCandidateIdRow[] | null)?.map((row) => row.candidate_id) ?? []);
  const usedCoupleIds = new Set(
    ((usedData as ({ puzzle_candidates?: { couple_id?: string } } & UsedCandidateIdRow)[] | null) ?? [])
      .map((row) => row.puzzle_candidates?.couple_id)
      .filter((value): value is string => Boolean(value)),
  );

  const { data: approvedData, error: approvedError } = await supabase
    .from("puzzle_candidates")
    .select("id,couple_id")
    .eq("status", "approved")
    .order("reviewed_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (approvedError) {
    throw new Error(`Failed to load approved queue: ${approvedError.message}`);
  }

  const approvedQueue = (approvedData as ApprovedCandidateRow[] | null) ?? [];
  const nextCandidate = approvedQueue.find(
    (row) => !usedIds.has(row.id) && !usedCoupleIds.has(row.couple_id),
  );
  return nextCandidate?.id ?? null;
};

const assignPuzzleForDateFromQueue = async (date: string): Promise<boolean> => {
  const supabase = getSupabaseAdmin();
  const candidateId = await getNextApprovedCandidateId();

  if (!candidateId) {
    return false;
  }

  const { error } = await supabase.from("daily_puzzles").insert({
    puzzle_date: date,
    candidate_id: candidateId,
  });

  if (!error) {
    return true;
  }

  if (error.code === "23505") {
    return true;
  }

  throw new Error(`Failed to assign queued puzzle for ${date}: ${error.message}`);
};

export const purgeExpiredRejectedCandidates = async (): Promise<number> => {
  const supabase = getSupabaseAdmin();
  const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: staleRejectedData, error: staleRejectedError } = await supabase
    .from("puzzle_candidates")
    .select("id")
    .eq("status", "rejected")
    .lt("reviewed_at", cutoffIso);

  if (staleRejectedError) {
    throw new Error(`Failed to load rejected candidates for cleanup: ${staleRejectedError.message}`);
  }

  const staleRejectedIds = (staleRejectedData as { id: string }[] | null)?.map((row) => row.id) ?? [];
  if (staleRejectedIds.length === 0) {
    return 0;
  }

  const { data: usedData, error: usedError } = await supabase
    .from("daily_puzzles")
    .select("candidate_id");

  if (usedError) {
    throw new Error(`Failed to load used candidates for cleanup: ${usedError.message}`);
  }

  const usedIds = new Set((usedData as UsedCandidateIdRow[] | null)?.map((row) => row.candidate_id) ?? []);
  const safeToDeleteIds = staleRejectedIds.filter((id) => !usedIds.has(id));
  if (safeToDeleteIds.length === 0) {
    return 0;
  }

  const { data: deletedRows, error: deleteError } = await supabase
    .from("puzzle_candidates")
    .delete()
    .in("id", safeToDeleteIds)
    .select("id");
  if (deleteError) {
    throw new Error(`Failed to cleanup rejected candidates: ${deleteError.message}`);
  }

  return (deletedRows as { id: string }[] | null)?.length ?? 0;
};

export const getTodayPuzzle = async (): Promise<PuzzlePublic | null> => {
  await purgeExpiredRejectedCandidates();

  const timeZone = process.env.TIMEZONE ?? "America/New_York";
  const today = getDateInTimeZone(timeZone);

  const existingToday = await getPuzzleForDate(today);
  if (existingToday) {
    return getPublicPuzzleWithGallery(existingToday);
  }

  const assignedFromQueue = await assignPuzzleForDateFromQueue(today);
  if (assignedFromQueue) {
    const assignedToday = await getPuzzleForDate(today);
    if (assignedToday) {
      return getPublicPuzzleWithGallery(assignedToday);
    }
  }

  return null;
};

export const getPuzzleByDate = async (date: string): Promise<PuzzlePublic | null> => {
  const row = await getPuzzleForDate(date);
  return row ? getPublicPuzzleWithGallery(row) : null;
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
  const supabase = getSupabaseAdmin();
  const timeZone = process.env.TIMEZONE ?? "America/New_York";
  const today = getDateInTimeZone(timeZone);

  const { data, error } = await supabase
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

const getPublicPuzzleWithGallery = async (row: PuzzleRow): Promise<PuzzlePublic> => {
  const relationshipLabelByType: Record<
    "spouse" | "couple" | "former_spouse" | "former_couple",
    string
  > = {
    spouse: "married",
    couple: "a couple",
    former_spouse: "no longer married",
    former_couple: "no longer a couple",
  };
  const relationshipLabel = relationshipLabelByType[row.puzzle_candidates.couples.relationship_type];
  const editorialRelationshipNote = `${row.puzzle_candidates.couples.person_a.name} and ${row.puzzle_candidates.couples.person_b.name} are ${relationshipLabel}.`;
  const editorialPersonABio = row.puzzle_candidates.editorial_person_a_bio?.trim() || null;
  const editorialPersonABioUrl = row.puzzle_candidates.editorial_person_a_bio_url?.trim() || null;
  const editorialPersonBBio = row.puzzle_candidates.editorial_person_b_bio?.trim() || null;
  const editorialPersonBBioUrl = row.puzzle_candidates.editorial_person_b_bio_url?.trim() || null;
  const rawEditorialCoupleContext = row.puzzle_candidates.editorial_couple_context?.trim() || null;
  const editorialCoupleContext =
    rawEditorialCoupleContext &&
    rawEditorialCoupleContext.toLocaleLowerCase() === editorialRelationshipNote.toLocaleLowerCase()
      ? null
      : rawEditorialCoupleContext;
  const editorialCoupleContextUrl = editorialCoupleContext
    ? row.puzzle_candidates.editorial_couple_context_url?.trim() || null
    : null;

  return buildPublicPuzzle(row, {
    relationshipNote: editorialRelationshipNote,
    personABio: editorialPersonABio,
    personABioUrl: editorialPersonABioUrl,
    personBBio: editorialPersonBBio,
    personBBioUrl: editorialPersonBBioUrl,
    coupleContext: editorialCoupleContext,
    coupleContextUrl: editorialCoupleContextUrl,
  });
};

export const submitGuess = async (puzzleId: string, guessYears: number): Promise<PuzzleAnswer | null> => {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("daily_puzzles")
    .select(basePuzzleSelect)
    .eq("id", puzzleId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch puzzle answer: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as PuzzleRow;
  const exactAgeGapYears = Number(row.puzzle_candidates.computed_age_gap_years);
  const roundedAgeGapYears = Math.round(exactAgeGapYears);
  const absErrorYears = Math.abs(roundedAgeGapYears - guessYears);

  const personABirthDate = row.puzzle_candidates.couples.person_a.birth_date ?? "unknown";
  const personBBirthDate = row.puzzle_candidates.couples.person_b.birth_date ?? "unknown";
  const attribution = row.puzzle_candidates.images.attribution_text ?? "Wikimedia Commons";

  const { error: insertError } = await supabase.from("guesses").insert({
    puzzle_id: puzzleId,
    guess_years: guessYears,
    abs_error: absErrorYears,
  });

  if (insertError) {
    throw new Error(`Failed to save guess: ${insertError.message}`);
  }

  return {
    puzzleId,
    guessYears,
    exactAgeGapYears,
    roundedAgeGapYears,
    absErrorYears,
    personABirthDate,
    personBBirthDate,
    attribution,
  };
};

type CandidateRow = {
  id: string;
  couple_id: string;
  image_id: string;
  computed_age_gap_years: number;
  quality_score: number;
  status: CandidateStatus;
  created_at: string;
  couples: {
    relationship_type: "spouse" | "couple" | "former_spouse" | "former_couple";
    person_a: { name: string; birth_date: string | null };
    person_b: { name: string; birth_date: string | null };
  };
  images: {
    image_url: string;
    file_title: string | null;
    license: string | null;
  };
};

type CandidateUsageRow = {
  candidate_id: string;
  puzzle_date: string;
};

type CandidateWithPrimaryImageRow = {
  id: string;
  couple_id: string;
  image_id: string;
  couples: {
    person_a: { name: string };
    person_b: { name: string };
  };
  images: {
    image_url: string;
    file_title: string | null;
  };
};

type CandidateDetailsRow = {
  id: string;
  couple_id: string;
  review_notes: string | null;
  editorial_person_a_bio: string | null;
  editorial_person_a_bio_url: string | null;
  editorial_person_b_bio: string | null;
  editorial_person_b_bio_url: string | null;
  editorial_couple_context: string | null;
  editorial_couple_context_url: string | null;
  couples: {
    id: string;
    relationship_type: "spouse" | "couple" | "former_spouse" | "former_couple";
    person_a_id: string;
    person_b_id: string;
    person_a: { name: string; birth_date: string | null; wikipedia_title: string | null };
    person_b: { name: string; birth_date: string | null; wikipedia_title: string | null };
  };
};

const normalizeNullableText = (value: string | null | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
};

const normalizeNullableDate = (value: string | null | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("Birth dates must be YYYY-MM-DD");
  }
  return normalized;
};

const MANUAL_PLACEHOLDER_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520"><rect width="800" height="520" fill="#eef1f4"/><g fill="none" stroke="#c6ccd3" stroke-width="8"><rect x="140" y="96" width="520" height="328" rx="24"/><path d="M178 362 304 238l92 90 98-116 128 150"/><circle cx="300" cy="188" r="28"/></g><text x="400" y="466" text-anchor="middle" fill="#7c8590" font-family="Arial, Helvetica, sans-serif" font-size="28">No image yet</text></svg>`,
)}`;

const calculateExactAgeGapYears = (personABirthDate: string, personBBirthDate: string): number => {
  const a = new Date(`${personABirthDate}T00:00:00Z`);
  const b = new Date(`${personBBirthDate}T00:00:00Z`);
  const diffMs = Math.abs(a.getTime() - b.getTime());
  const msPerYear = 365.2425 * 24 * 60 * 60 * 1000;
  return Number((diffMs / msPerYear).toFixed(2));
};

export const createManualReviewCandidate = async ({
  personAName,
  personABirthDate,
  personAWikipediaTitle,
  personBName,
  personBBirthDate,
  personBWikipediaTitle,
  relationshipType,
  imageUrl,
  imageTitle,
  attributionText,
  editorialPersonABio,
  editorialPersonABioUrl,
  editorialPersonBBio,
  editorialPersonBBioUrl,
  editorialCoupleContext,
  editorialCoupleContextUrl,
}: {
  personAName: string;
  personABirthDate: string;
  personAWikipediaTitle?: string | null;
  personBName: string;
  personBBirthDate: string;
  personBWikipediaTitle?: string | null;
  relationshipType: "spouse" | "couple" | "former_spouse" | "former_couple";
  imageUrl?: string | null;
  imageTitle?: string | null;
  attributionText?: string | null;
  editorialPersonABio?: string | null;
  editorialPersonABioUrl?: string | null;
  editorialPersonBBio?: string | null;
  editorialPersonBBioUrl?: string | null;
  editorialCoupleContext?: string | null;
  editorialCoupleContextUrl?: string | null;
}): Promise<string> => {
  const supabase = getSupabaseAdmin();

  const normalizedPersonAName = normalizeNullableText(personAName);
  const normalizedPersonBName = normalizeNullableText(personBName);
  const normalizedPersonABirthDate = normalizeNullableDate(personABirthDate);
  const normalizedPersonBBirthDate = normalizeNullableDate(personBBirthDate);

  if (!normalizedPersonAName || !normalizedPersonBName) {
    throw new Error("Both person names are required");
  }
  if (!normalizedPersonABirthDate || !normalizedPersonBBirthDate) {
    throw new Error("Both birth dates are required (YYYY-MM-DD)");
  }
  const normalizedImageUrl = normalizeNullableText(imageUrl);
  if (normalizedImageUrl) {
    let parsedImageUrl: URL;
    try {
      parsedImageUrl = new URL(normalizedImageUrl);
    } catch {
      throw new Error("Image URL must be a valid URL");
    }
    if (parsedImageUrl.protocol !== "http:" && parsedImageUrl.protocol !== "https:") {
      throw new Error("Image URL must use http or https");
    }
  }

  const findOrCreatePerson = async ({
    name,
    birthDate,
    wikipediaTitle,
  }: {
    name: string;
    birthDate: string;
    wikipediaTitle: string | null;
  }): Promise<string> => {
    const { data: existingPerson, error: existingError } = await supabase
      .from("people")
      .select("id")
      .eq("name", name)
      .eq("birth_date", birthDate)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed to search for existing person: ${existingError.message}`);
    }

    if (existingPerson?.id) {
      return existingPerson.id;
    }

    const { data: createdPerson, error: createPersonError } = await supabase
      .from("people")
      .insert({
        wikidata_qid: `manual:${randomUUID()}`,
        name,
        birth_date: birthDate,
        wikipedia_title: wikipediaTitle,
      })
      .select("id")
      .single();

    if (createPersonError) {
      throw new Error(`Failed to create person: ${createPersonError.message}`);
    }

    return createdPerson.id;
  };

  const personAWikipedia = normalizeNullableText(personAWikipediaTitle);
  const personBWikipedia = normalizeNullableText(personBWikipediaTitle);
  const personAId = await findOrCreatePerson({
    name: normalizedPersonAName,
    birthDate: normalizedPersonABirthDate,
    wikipediaTitle: personAWikipedia,
  });
  const personBId = await findOrCreatePerson({
    name: normalizedPersonBName,
    birthDate: normalizedPersonBBirthDate,
    wikipediaTitle: personBWikipedia,
  });

  const orderedPeople = [
    { id: personAId, name: normalizedPersonAName },
    { id: personBId, name: normalizedPersonBName },
  ].sort((a, b) => a.id.localeCompare(b.id));
  const orderedPersonAId = orderedPeople[0].id;
  const orderedPersonBId = orderedPeople[1].id;

  let coupleId: string;
  const { data: existingCouple, error: existingCoupleError } = await supabase
    .from("couples")
    .select("id")
    .eq("person_a_id", orderedPersonAId)
    .eq("person_b_id", orderedPersonBId)
    .maybeSingle();
  if (existingCoupleError) {
    throw new Error(`Failed to search for existing couple: ${existingCoupleError.message}`);
  }

  if (existingCouple?.id) {
    coupleId = existingCouple.id;
    const { error: relationshipUpdateError } = await supabase
      .from("couples")
      .update({ relationship_type: relationshipType })
      .eq("id", coupleId);
    if (relationshipUpdateError) {
      throw new Error(`Failed to update couple relationship type: ${relationshipUpdateError.message}`);
    }
  } else {
    const { data: createdCouple, error: createCoupleError } = await supabase
      .from("couples")
      .insert({
        person_a_id: orderedPersonAId,
        person_b_id: orderedPersonBId,
        relationship_type: relationshipType,
        source: "manual",
      })
      .select("id")
      .single();
    if (createCoupleError) {
      throw new Error(`Failed to create couple: ${createCoupleError.message}`);
    }
    coupleId = createdCouple.id;
  }

  let imageId: string | null = null;
  if (normalizedImageUrl) {
    const resolvedImageTitle =
      normalizeNullableText(imageTitle) || `${normalizedPersonAName} + ${normalizedPersonBName} (manual)`;
    const { data: createdImage, error: createImageError } = await supabase
      .from("images")
      .insert({
        subject_type: "couple",
        subject_id: coupleId,
        source: "manual",
        file_title: resolvedImageTitle,
        image_url: normalizedImageUrl,
        thumb_url: normalizedImageUrl,
        attribution_text: normalizeNullableText(attributionText),
        is_usable: true,
      })
      .select("id")
      .single();
    if (createImageError) {
      throw new Error(`Failed to create image: ${createImageError.message}`);
    }
    imageId = createdImage.id;
  } else {
    const { data: existingImage, error: existingImageError } = await supabase
      .from("images")
      .select("id")
      .eq("subject_type", "couple")
      .eq("subject_id", coupleId)
      .eq("is_usable", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingImageError) {
      throw new Error(`Failed to find existing couple image: ${existingImageError.message}`);
    }
    if (existingImage) {
      imageId = existingImage.id;
    } else {
      const placeholderTitle = `${normalizedPersonAName} + ${normalizedPersonBName} (placeholder)`;
      const { data: placeholderImage, error: placeholderError } = await supabase
        .from("images")
        .insert({
          subject_type: "couple",
          subject_id: coupleId,
          source: "manual",
          file_title: placeholderTitle,
          image_url: MANUAL_PLACEHOLDER_IMAGE,
          thumb_url: MANUAL_PLACEHOLDER_IMAGE,
          attribution_text: "Placeholder image",
          is_usable: false,
        })
        .select("id")
        .single();

      if (placeholderError) {
        throw new Error(`Failed to create placeholder image: ${placeholderError.message}`);
      }
      imageId = placeholderImage.id;
    }
  }

  const exactAgeGapYears = calculateExactAgeGapYears(normalizedPersonABirthDate, normalizedPersonBBirthDate);
  const { data: candidateRow, error: createCandidateError } = await supabase
    .from("puzzle_candidates")
    .insert({
      couple_id: coupleId,
      image_id: imageId,
      computed_age_gap_years: exactAgeGapYears,
      quality_score: 100,
      status: "pending_review",
      editorial_person_a_bio: normalizeNullableText(editorialPersonABio),
      editorial_person_a_bio_url: normalizeNullableText(editorialPersonABioUrl),
      editorial_person_b_bio: normalizeNullableText(editorialPersonBBio),
      editorial_person_b_bio_url: normalizeNullableText(editorialPersonBBioUrl),
      editorial_couple_context: normalizeNullableText(editorialCoupleContext),
      editorial_couple_context_url: normalizeNullableText(editorialCoupleContextUrl),
    })
    .select("id")
    .single();

  if (createCandidateError) {
    throw new Error(`Failed to create candidate: ${createCandidateError.message}`);
  }

  return candidateRow.id;
};

export const listReviewCandidates = async ({
  status = "all",
  page = 1,
  pageSize = 25,
}: {
  status?: CandidateFilter;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ items: ReviewCandidate[]; total: number }> => {
  const supabase = getSupabaseAdmin();
  const timeZone = process.env.TIMEZONE ?? "America/New_York";
  const today = getDateInTimeZone(timeZone);
  const tomorrow = getDateOffsetInTimeZone(timeZone, 1);
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safePageSize = Math.max(1, Math.min(100, Math.floor(Number(pageSize) || 25)));
  const rangeStart = (safePage - 1) * safePageSize;
  const rangeEnd = rangeStart + safePageSize - 1;
  const needsDerivedFiltering = status === "finished" || status === "approved" || status === "used_today";

  let query = supabase
    .from("puzzle_candidates")
    .select(
      `
      id,
      couple_id,
      image_id,
      computed_age_gap_years,
      quality_score,
      status,
      created_at,
      couples!inner(
        relationship_type,
        person_a:people!couples_person_a_id_fkey(name,birth_date),
        person_b:people!couples_person_b_id_fkey(name,birth_date)
      ),
      images!inner(image_url,file_title,license)
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (status === "pending_review") {
    query = query.eq("status", status);
  }
  if (!needsDerivedFiltering) {
    query = query.range(rangeStart, rangeEnd);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list candidates: ${error.message}`);
  }

  const rows = (data as unknown as CandidateRow[]) ?? [];
  let usageRows: CandidateUsageRow[] = [];
  let upNextCandidateId: string | null = null;
  if (rows.length > 0) {
    const { data: fetchedUsageRows, error: usageError } = await supabase
      .from("daily_puzzles")
      .select("candidate_id,puzzle_date")
      .in("candidate_id", rows.map((row) => row.id));

    if (usageError) {
      throw new Error(`Failed to load candidate usage metadata: ${usageError.message}`);
    }

    usageRows = (fetchedUsageRows as CandidateUsageRow[] | null) ?? [];

    const { data: tomorrowPuzzleData, error: tomorrowPuzzleError } = await supabase
      .from("daily_puzzles")
      .select("candidate_id")
      .eq("puzzle_date", tomorrow)
      .maybeSingle();

    if (tomorrowPuzzleError) {
      throw new Error(`Failed to load tomorrow puzzle assignment: ${tomorrowPuzzleError.message}`);
    }

    upNextCandidateId = (tomorrowPuzzleData as { candidate_id: string } | null)?.candidate_id ?? null;
    if (!upNextCandidateId) {
      upNextCandidateId = await getNextApprovedCandidateId();
    }
  }

  const usageByCandidate = new Map<string, string[]>();
  for (const usageRow of usageRows) {
    const existing = usageByCandidate.get(usageRow.candidate_id) ?? [];
    existing.push(usageRow.puzzle_date);
    usageByCandidate.set(usageRow.candidate_id, existing);
  }

  const hydrated = rows.map((row) => ({
    ...((): {
      usedCount: number;
      lastUsedPuzzleDate: string | null;
      nextScheduledPuzzleDate: string | null;
      isUsedToday: boolean;
      isFinished: boolean;
      isUpNext: boolean;
    } => {
      const dates = (usageByCandidate.get(row.id) ?? []).sort((a, b) => b.localeCompare(a));
      const nextScheduledPuzzleDate =
        dates
          .filter((date) => date >= today)
          .sort((a, b) => a.localeCompare(b))[0] ?? null;
      const isFinished = dates.some((date) => date <= today);
      return {
        usedCount: dates.length,
        lastUsedPuzzleDate: dates[0] ?? null,
        nextScheduledPuzzleDate,
        isUsedToday: dates.includes(today),
        isFinished,
        isUpNext: row.id === upNextCandidateId,
      };
    })(),
    id: row.id,
    coupleId: row.couple_id,
    couple: `${row.couples.person_a.name} + ${row.couples.person_b.name}`,
    relationshipType: row.couples.relationship_type,
    exactAgeGapYears: Number(row.computed_age_gap_years),
    roundedAgeGapYears: Math.round(Number(row.computed_age_gap_years)),
    personABirthDate: row.couples.person_a.birth_date ?? "unknown",
    personBBirthDate: row.couples.person_b.birth_date ?? "unknown",
    imageId: row.image_id,
    imageUrl: row.images.image_url,
    imageAlt: row.images.file_title ?? `${row.couples.person_a.name} + ${row.couples.person_b.name}`,
    license: row.images.license ?? "Unknown",
    qualityScore: row.quality_score,
    status: row.status,
    createdAt: row.created_at,
  }));

  const filtered = hydrated.filter((item) => {
    if (status === "finished") {
      return item.isFinished;
    }
    if (status === "used_today") {
      return item.isUsedToday;
    }
    if (status === "approved") {
      return item.status === "approved" && !item.isFinished;
    }
    if (status === "pending_review") {
      return item.status === "pending_review";
    }
    return true;
  });
  const items = needsDerivedFiltering ? filtered.slice(rangeStart, rangeEnd + 1) : filtered;

  return {
    items,
    total: needsDerivedFiltering
      ? filtered.length
      : (Number.isFinite(count) ? Number(count) : items.length),
  };
};

export const getReviewCandidateImage = async (
  candidateId: string,
): Promise<{ coupleId: string; image: { id: string; imageUrl: string; imageAlt: string } }> => {
  const supabase = getSupabaseAdmin();

  const { data: candidateData, error: candidateError } = await supabase
    .from("puzzle_candidates")
    .select(
      `
      id,
      couple_id,
      image_id,
      couples!inner(
        person_a:people!couples_person_a_id_fkey(name),
        person_b:people!couples_person_b_id_fkey(name)
      ),
      images!inner(image_url,file_title)
    `,
    )
    .eq("id", candidateId)
    .maybeSingle();

  if (candidateError) {
    throw new Error(`Failed to load candidate gallery context: ${candidateError.message}`);
  }

  if (!candidateData) {
    throw new Error("Candidate not found");
  }

  const candidate = candidateData as unknown as CandidateWithPrimaryImageRow;

  const baseAlt = `${candidate.couples.person_a.name} + ${candidate.couples.person_b.name}`;

  return {
    coupleId: candidate.couple_id,
    image: {
      id: candidate.image_id,
      imageUrl: candidate.images.image_url,
      imageAlt: candidate.images.file_title ?? baseAlt,
    },
  };
};

export const getReviewCandidateDetails = async (candidateId: string): Promise<ReviewCandidateDetails> => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("puzzle_candidates")
    .select(
      `
      id,
      couple_id,
      review_notes,
      editorial_person_a_bio,
      editorial_person_a_bio_url,
      editorial_person_b_bio,
      editorial_person_b_bio_url,
      editorial_couple_context,
      editorial_couple_context_url,
      couples!inner(
        id,
        relationship_type,
        person_a_id,
        person_b_id,
        person_a:people!couples_person_a_id_fkey(name,birth_date,wikipedia_title),
        person_b:people!couples_person_b_id_fkey(name,birth_date,wikipedia_title)
      )
    `,
    )
    .eq("id", candidateId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load candidate details: ${error.message}`);
  }
  if (!data) {
    throw new Error("Candidate not found");
  }

  const row = data as unknown as CandidateDetailsRow;
  const editorialPersonABio = row.editorial_person_a_bio?.trim() || null;
  const editorialPersonABioUrl = row.editorial_person_a_bio_url?.trim() || null;
  const editorialPersonBBio = row.editorial_person_b_bio?.trim() || null;
  const editorialPersonBBioUrl = row.editorial_person_b_bio_url?.trim() || null;

  return {
    candidateId: row.id,
    coupleId: row.couple_id,
    personAId: row.couples.person_a_id,
    personBId: row.couples.person_b_id,
    personAName: row.couples.person_a.name,
    personABirthDate: row.couples.person_a.birth_date,
    personAWikipediaTitle: row.couples.person_a.wikipedia_title,
    personBName: row.couples.person_b.name,
    personBBirthDate: row.couples.person_b.birth_date,
    personBWikipediaTitle: row.couples.person_b.wikipedia_title,
    relationshipType: row.couples.relationship_type,
    reviewNotes: row.review_notes,
    editorialPersonABio,
    editorialPersonABioUrl,
    editorialPersonBBio,
    editorialPersonBBioUrl,
    editorialCoupleContext: row.editorial_couple_context,
    editorialCoupleContextUrl: row.editorial_couple_context_url,
  };
};

export const updateReviewCandidateDetails = async (payload: ReviewCandidateDetailsUpdate): Promise<void> => {
  const supabase = getSupabaseAdmin();
  const current = await getReviewCandidateDetails(payload.candidateId);

  const personAName = normalizeNullableText(payload.personAName);
  const personBName = normalizeNullableText(payload.personBName);
  if (!personAName || !personBName) {
    throw new Error("Both person names are required");
  }

  const personABirthDate = normalizeNullableDate(payload.personABirthDate);
  const personBBirthDate = normalizeNullableDate(payload.personBBirthDate);

  const personAWikipediaTitle = normalizeNullableText(payload.personAWikipediaTitle);
  const personBWikipediaTitle = normalizeNullableText(payload.personBWikipediaTitle);

  const reviewNotes = normalizeNullableText(payload.reviewNotes);
  const editorialPersonABio = normalizeNullableText(payload.editorialPersonABio);
  const editorialPersonABioUrl = normalizeNullableText(payload.editorialPersonABioUrl);
  const editorialPersonBBio = normalizeNullableText(payload.editorialPersonBBio);
  const editorialPersonBBioUrl = normalizeNullableText(payload.editorialPersonBBioUrl);
  const editorialCoupleContext = normalizeNullableText(payload.editorialCoupleContext);
  const editorialCoupleContextUrl = normalizeNullableText(payload.editorialCoupleContextUrl);

  const nowIso = new Date().toISOString();

  const { error: personAError } = await supabase
    .from("people")
    .update({
      name: personAName,
      birth_date: personABirthDate,
      wikipedia_title: personAWikipediaTitle,
      updated_at: nowIso,
    })
    .eq("id", current.personAId);
  if (personAError) {
    throw new Error(`Failed to update person A: ${personAError.message}`);
  }

  const { error: personBError } = await supabase
    .from("people")
    .update({
      name: personBName,
      birth_date: personBBirthDate,
      wikipedia_title: personBWikipediaTitle,
      updated_at: nowIso,
    })
    .eq("id", current.personBId);
  if (personBError) {
    throw new Error(`Failed to update person B: ${personBError.message}`);
  }

  const { error: coupleError } = await supabase
    .from("couples")
    .update({
      relationship_type: payload.relationshipType,
      updated_at: nowIso,
    })
    .eq("id", current.coupleId);
  if (coupleError) {
    throw new Error(`Failed to update relationship type: ${coupleError.message}`);
  }

  const { error: candidateError } = await supabase
    .from("puzzle_candidates")
    .update({
      review_notes: reviewNotes,
      editorial_person_a_bio: editorialPersonABio,
      editorial_person_a_bio_url: editorialPersonABioUrl,
      editorial_person_b_bio: editorialPersonBBio,
      editorial_person_b_bio_url: editorialPersonBBioUrl,
      editorial_couple_context: editorialCoupleContext,
      editorial_couple_context_url: editorialCoupleContextUrl,
    })
    .eq("id", payload.candidateId);
  if (candidateError) {
    throw new Error(`Failed to update candidate editorial details: ${candidateError.message}`);
  }
};

export const updateCandidateStatus = async (id: string, status: CandidateStatus): Promise<void> => {
  const supabase = getSupabaseAdmin();
  const reviewedAt = status === "pending_review" ? null : new Date().toISOString();

  if (status === "approved") {
    const { data: candidateRow, error: candidateError } = await supabase
      .from("puzzle_candidates")
      .select("id,couple_id,image_id")
      .eq("id", id)
      .maybeSingle();

    if (candidateError) {
      throw new Error(`Failed to load candidate for approval: ${candidateError.message}`);
    }

    if (!candidateRow) {
      throw new Error("Candidate not found");
    }

    const { data: currentImageRow, error: currentImageError } = await supabase
      .from("images")
      .select("id,is_usable")
      .eq("id", candidateRow.image_id)
      .maybeSingle();

    if (currentImageError) {
      throw new Error(`Failed to validate candidate image: ${currentImageError.message}`);
    }

    const currentImageUsable = Boolean(currentImageRow?.is_usable);
    if (!currentImageUsable) {
      const { data: replacementImage, error: replacementError } = await supabase
        .from("images")
        .select("id")
        .eq("subject_type", "couple")
        .eq("subject_id", candidateRow.couple_id)
        .eq("is_usable", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (replacementError) {
        throw new Error(`Failed to find replacement candidate image: ${replacementError.message}`);
      }

      if (!replacementImage) {
        throw new Error("Cannot approve candidate without at least one usable couple image");
      }

      const { error: replacementUpdateError } = await supabase
        .from("puzzle_candidates")
        .update({ image_id: replacementImage.id })
        .eq("id", id);

      if (replacementUpdateError) {
        throw new Error(`Failed to assign replacement candidate image: ${replacementUpdateError.message}`);
      }
    }
  }

  const { error } = await supabase
    .from("puzzle_candidates")
    .update({ status, reviewed_at: reviewedAt })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update candidate: ${error.message}`);
  }
};

export const deleteReviewCandidate = async (id: string): Promise<void> => {
  const supabase = getSupabaseAdmin();

  const { error: deleteDailyError } = await supabase
    .from("daily_puzzles")
    .delete()
    .eq("candidate_id", id);
  if (deleteDailyError) {
    throw new Error(`Failed deleting candidate schedules: ${deleteDailyError.message}`);
  }

  const { error: deleteCandidateError } = await supabase
    .from("puzzle_candidates")
    .delete()
    .eq("id", id);
  if (deleteCandidateError) {
    throw new Error(`Failed deleting candidate: ${deleteCandidateError.message}`);
  }
};

export const getQueueHealth = async (): Promise<QueueHealth> => {
  const supabase = getSupabaseAdmin();
  const lowQueueThreshold = Number(process.env.ADMIN_QUEUE_LOW_THRESHOLD ?? 7);

  const { data: candidates, error: candidatesError } = await supabase
    .from("puzzle_candidates")
    .select("id,status");

  if (candidatesError) {
    throw new Error(`Failed to load candidate queue health: ${candidatesError.message}`);
  }

  const { data: usedData, error: usedError } = await supabase
    .from("daily_puzzles")
    .select("candidate_id");

  if (usedError) {
    throw new Error(`Failed to load used queue health: ${usedError.message}`);
  }

  const rows = (candidates as CandidateStatusRow[] | null) ?? [];
  const usedIds = new Set((usedData as UsedCandidateIdRow[] | null)?.map((row) => row.candidate_id) ?? []);

  let approvedTotal = 0;
  let approvedUsed = 0;
  let pending = 0;
  let finished = 0;

  for (const row of rows) {
    if (row.status === "approved") {
      approvedTotal += 1;
      if (usedIds.has(row.id)) {
        approvedUsed += 1;
      }
    }
    if (row.status === "pending_review") {
      pending += 1;
    }
    if (usedIds.has(row.id)) {
      finished += 1;
    }
  }

  const approvedUnused = Math.max(approvedTotal - approvedUsed, 0);
  const runwayDays = approvedUnused;

  return {
    totalCandidates: rows.length,
    approvedTotal,
    approvedUnused,
    approvedUsed,
    scheduled: usedIds.size,
    pending,
    finished,
    runwayDays,
    lowQueueThreshold,
    isLow: approvedUnused < lowQueueThreshold,
  };
};

export const markCoupleImageUnusable = async (imageId: string): Promise<void> => {
  const supabase = getSupabaseAdmin();

  const { data: imageRow, error: imageError } = await supabase
    .from("images")
    .select("id,subject_id,subject_type,is_usable")
    .eq("id", imageId)
    .maybeSingle();

  if (imageError) {
    throw new Error(`Failed to load image for update: ${imageError.message}`);
  }

  if (!imageRow) {
    throw new Error("Image not found");
  }

  if (imageRow.subject_type !== "couple") {
    throw new Error("Only couple images can be updated");
  }

  if (!imageRow.is_usable) {
    return;
  }

  const { count, error: countError } = await supabase
    .from("images")
    .select("id", { count: "exact", head: true })
    .eq("subject_type", "couple")
    .eq("subject_id", imageRow.subject_id)
    .eq("is_usable", true);

  if (countError) {
    throw new Error(`Failed to validate remaining images: ${countError.message}`);
  }

  if ((count ?? 0) <= 1) {
    throw new Error("At least one usable image is required per couple");
  }

  const { data: replacementImage, error: replacementError } = await supabase
    .from("images")
    .select("id")
    .eq("subject_type", "couple")
    .eq("subject_id", imageRow.subject_id)
    .eq("is_usable", true)
    .neq("id", imageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (replacementError) {
    throw new Error(`Failed to find replacement image: ${replacementError.message}`);
  }

  if (!replacementImage) {
    throw new Error("At least one usable image is required per couple");
  }

  const { error: repointError } = await supabase
    .from("puzzle_candidates")
    .update({ image_id: replacementImage.id })
    .eq("couple_id", imageRow.subject_id)
    .eq("image_id", imageId);

  if (repointError) {
    throw new Error(`Failed to repoint candidate images: ${repointError.message}`);
  }

  const { error: updateError } = await supabase
    .from("images")
    .update({ is_usable: false })
    .eq("id", imageId);

  if (updateError) {
    throw new Error(`Failed to mark image unusable: ${updateError.message}`);
  }
};

export const addManualCoupleImage = async ({
  coupleId,
  imageUrl,
  fileTitle,
  thumbUrl,
  license,
  author,
  attributionText,
}: {
  coupleId: string;
  imageUrl: string;
  fileTitle?: string | null;
  thumbUrl?: string | null;
  license?: string | null;
  author?: string | null;
  attributionText?: string | null;
}): Promise<string> => {
  const supabase = getSupabaseAdmin();
  const resolvedTitle = fileTitle?.trim() || `Manual image ${new Date().toISOString()}`;
  const resolvedThumb = thumbUrl?.trim() || imageUrl;

  const { data, error } = await supabase
    .from("images")
    .insert({
      subject_type: "couple",
      subject_id: coupleId,
      source: "manual",
      file_title: resolvedTitle,
      image_url: imageUrl,
      thumb_url: resolvedThumb,
      license: license?.trim() || null,
      author: author?.trim() || null,
      attribution_text: attributionText?.trim() || null,
      is_usable: true,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to add manual image: ${error.message}`);
  }

  return data.id;
};

export const assignCandidateImage = async ({
  candidateId,
  imageId,
}: {
  candidateId: string;
  imageId: string;
}): Promise<void> => {
  const supabase = getSupabaseAdmin();

  const { data: candidateRow, error: candidateError } = await supabase
    .from("puzzle_candidates")
    .select("id,couple_id")
    .eq("id", candidateId)
    .maybeSingle();

  if (candidateError) {
    throw new Error(`Failed to load candidate for image assignment: ${candidateError.message}`);
  }
  if (!candidateRow) {
    throw new Error("Candidate not found");
  }

  const { data: imageRow, error: imageError } = await supabase
    .from("images")
    .select("id,subject_type,subject_id,is_usable")
    .eq("id", imageId)
    .maybeSingle();

  if (imageError) {
    throw new Error(`Failed to load image for candidate assignment: ${imageError.message}`);
  }
  if (!imageRow) {
    throw new Error("Image not found");
  }
  if (imageRow.subject_type !== "couple" || imageRow.subject_id !== candidateRow.couple_id) {
    throw new Error("Image does not belong to this candidate's couple");
  }
  if (!imageRow.is_usable) {
    throw new Error("Image is not usable");
  }

  const { error: updateError } = await supabase
    .from("puzzle_candidates")
    .update({ image_id: imageId })
    .eq("id", candidateId);

  if (updateError) {
    throw new Error(`Failed to assign image to candidate: ${updateError.message}`);
  }
};
