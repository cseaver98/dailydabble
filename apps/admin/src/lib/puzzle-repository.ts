import type {
  ArchivePuzzleListItem,
  CandidateStatus,
  PuzzleAnswer,
  PuzzlePublic,
  QueueHealth,
  ReviewCandidate,
} from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getWikipediaSummary } from "@/lib/wikipedia";

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
    couples: {
      relationship_type: "spouse" | "partner";
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

type CoupleGalleryImageRow = {
  image_url: string;
  file_title: string | null;
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
  galleryImages: CoupleGalleryImageRow[],
  editorialContext: PuzzlePublic["editorialContext"],
): PuzzlePublic => {
  const primaryImage = {
    imageUrl: row.puzzle_candidates.images.image_url,
    imageAlt: buildImageAlt(row, row.puzzle_candidates.images.file_title),
  };

  const seenImageUrls = new Set<string>([primaryImage.imageUrl]);
  const dedupedGallery = galleryImages
    .filter((item) => {
      if (seenImageUrls.has(item.image_url)) {
        return false;
      }
      seenImageUrls.add(item.image_url);
      return true;
    })
    .map((item) => ({
      imageUrl: item.image_url,
      imageAlt: buildImageAlt(row, item.file_title),
    }));

  return {
    puzzleId: row.id,
    puzzleDate: row.puzzle_date,
    personAName: row.puzzle_candidates.couples.person_a.name,
    personBName: row.puzzle_candidates.couples.person_b.name,
    relationshipType: row.puzzle_candidates.couples.relationship_type,
    imageUrl: primaryImage.imageUrl,
    imageAlt: primaryImage.imageAlt,
    galleryImages: [primaryImage, ...dedupedGallery].slice(0, 5),
    editorialContext,
  };
};

const basePuzzleSelect = `
  id,
  puzzle_date,
  puzzle_candidates!inner(
    couple_id,
    computed_age_gap_years,
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

const getFallbackPuzzle = async (date: string): Promise<PuzzleRow | null> => {
  const supabase = getSupabaseAdmin();
  const fallback = await supabase
    .from("daily_puzzles")
    .select(basePuzzleSelect)
    .lte("puzzle_date", date)
    .order("puzzle_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallback.error) {
    throw new Error(`Failed to fetch fallback puzzle: ${fallback.error.message}`);
  }

  return fallback.data ? (fallback.data as unknown as PuzzleRow) : null;
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

  const timeZone = process.env.APP_TIMEZONE ?? "America/New_York";
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

  const fallback = await getFallbackPuzzle(today);
  return fallback ? getPublicPuzzleWithGallery(fallback) : null;
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
  const timeZone = process.env.APP_TIMEZONE ?? "America/New_York";
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
  const supabase = getSupabaseAdmin();
  const { data: galleryData, error } = await supabase
    .from("images")
    .select("image_url,file_title")
    .eq("subject_type", "couple")
    .eq("subject_id", row.puzzle_candidates.couple_id)
    .eq("is_usable", true)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    throw new Error(`Failed to fetch couple gallery images: ${error.message}`);
  }

  const relationshipLabel =
    row.puzzle_candidates.couples.relationship_type === "spouse" ? "married" : "partners";
  const [personASummary, personBSummary, coupleSummary] = await Promise.all([
    getWikipediaSummary(
      row.puzzle_candidates.couples.person_a.wikipedia_title,
      row.puzzle_candidates.couples.person_a.name,
    ),
    getWikipediaSummary(
      row.puzzle_candidates.couples.person_b.wikipedia_title,
      row.puzzle_candidates.couples.person_b.name,
    ),
    getWikipediaSummary(
      `${row.puzzle_candidates.couples.person_a.name} and ${row.puzzle_candidates.couples.person_b.name}`,
      `${row.puzzle_candidates.couples.person_a.name} ${row.puzzle_candidates.couples.person_b.name}`,
    ),
  ]);

  return buildPublicPuzzle(row, (galleryData as CoupleGalleryImageRow[]) ?? [], {
    relationshipNote: `${row.puzzle_candidates.couples.person_a.name} and ${row.puzzle_candidates.couples.person_b.name} are ${relationshipLabel}.`,
    personABio: personASummary.summary,
    personABioUrl: personASummary.pageUrl,
    personBBio: personBSummary.summary,
    personBBioUrl: personBSummary.pageUrl,
    coupleContext: coupleSummary.summary,
    coupleContextUrl: coupleSummary.pageUrl,
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
  computed_age_gap_years: number;
  quality_score: number;
  status: CandidateStatus;
  created_at: string;
  couples: {
    relationship_type: "spouse" | "partner";
    person_a: { name: string; birth_date: string | null };
    person_b: { name: string; birth_date: string | null };
  };
  images: {
    image_url: string;
    file_title: string | null;
    license: string | null;
  };
};

type CoupleImageRow = {
  id: string;
  subject_id: string;
  image_url: string;
  file_title: string | null;
};

type CandidateUsageRow = {
  candidate_id: string;
  puzzle_date: string;
};

export const listReviewCandidates = async (): Promise<ReviewCandidate[]> => {
  const supabase = getSupabaseAdmin();
  const timeZone = process.env.APP_TIMEZONE ?? "America/New_York";
  const today = getDateInTimeZone(timeZone);
  const tomorrow = getDateOffsetInTimeZone(timeZone, 1);

  const { data, error } = await supabase
    .from("puzzle_candidates")
    .select(
      `
      id,
      couple_id,
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
    )
    .order("quality_score", { ascending: false });

  if (error) {
    throw new Error(`Failed to list candidates: ${error.message}`);
  }

  const rows = (data as unknown as CandidateRow[]) ?? [];
  const coupleIds = Array.from(new Set(rows.map((row) => row.couple_id)));

  let coupleImagesData: CoupleImageRow[] = [];
  let usageRows: CandidateUsageRow[] = [];
  let upNextCandidateId: string | null = null;
  if (coupleIds.length > 0) {
    const { data: fetchedCoupleImages, error: coupleImagesError } = await supabase
      .from("images")
      .select("id,subject_id,image_url,file_title")
      .eq("subject_type", "couple")
      .eq("is_usable", true)
      .in("subject_id", coupleIds)
      .order("created_at", { ascending: false });

    if (coupleImagesError) {
      throw new Error(`Failed to load candidate galleries: ${coupleImagesError.message}`);
    }

    coupleImagesData = (fetchedCoupleImages as CoupleImageRow[] | null) ?? [];

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

  const galleryByCouple = new Map<string, { id: string; imageUrl: string; imageAlt: string }[]>();
  for (const imageRow of coupleImagesData) {
    const existing = galleryByCouple.get(imageRow.subject_id) ?? [];
    if (existing.length >= 5) {
      continue;
    }

    existing.push({
      id: imageRow.id,
      imageUrl: imageRow.image_url,
      imageAlt: imageRow.file_title ?? "Couple photo",
    });
    galleryByCouple.set(imageRow.subject_id, existing);
  }

  const usageByCandidate = new Map<string, string[]>();
  for (const usageRow of usageRows) {
    const existing = usageByCandidate.get(usageRow.candidate_id) ?? [];
    existing.push(usageRow.puzzle_date);
    usageByCandidate.set(usageRow.candidate_id, existing);
  }

  return rows.map((row) => ({
    ...((): {
      usedCount: number;
      lastUsedPuzzleDate: string | null;
      isUsedToday: boolean;
      isUpNext: boolean;
    } => {
      const dates = (usageByCandidate.get(row.id) ?? []).sort((a, b) => b.localeCompare(a));
      return {
        usedCount: dates.length,
        lastUsedPuzzleDate: dates[0] ?? null,
        isUsedToday: dates.includes(today),
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
    imageUrl: row.images.image_url,
    galleryImages:
      galleryByCouple.get(row.couple_id) ?? [
        {
          id: `fallback-${row.id}`,
          imageUrl: row.images.image_url,
          imageAlt: row.images.file_title ?? `${row.couples.person_a.name} + ${row.couples.person_b.name}`,
        },
      ],
    license: row.images.license ?? "Unknown",
    qualityScore: row.quality_score,
    status: row.status,
    createdAt: row.created_at,
  }));
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
  let rejected = 0;

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
    if (row.status === "rejected") {
      rejected += 1;
    }
  }

  const approvedUnused = Math.max(approvedTotal - approvedUsed, 0);
  const runwayDays = approvedUnused;

  return {
    approvedTotal,
    approvedUnused,
    approvedUsed,
    pending,
    rejected,
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
