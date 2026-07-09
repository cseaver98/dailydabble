import type {
  CandidateFilter,
  CandidateStatus,
  QueueHealth,
  RelationshipType,
  ReviewCandidate,
  ReviewCandidateDetails,
  ReviewCandidateDetailsUpdate,
} from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";

type UsedCandidateIdRow = {
  candidate_id: string;
};

type CandidateUsageRow = {
  candidate_id: string;
  puzzle_date: string;
};

type CandidateStatusRow = {
  id: string;
  status: CandidateStatus;
};

type ImageInput = {
  url?: string | null;
  fileTitle?: string | null;
  thumbUrl?: string | null;
  sourcePageUrl?: string | null;
  license?: string | null;
  licenseUrl?: string | null;
  author?: string | null;
  attributionText?: string | null;
  metadata?: Record<string, unknown> | null;
};

type CandidateRow = {
  id: string;
  couple_id: string;
  person_a_image_id: string | null;
  person_b_image_id: string | null;
  person_a_photo_year: number | null;
  person_b_photo_year: number | null;
  computed_age_gap_years: number;
  quality_score: number;
  status: CandidateStatus;
  created_at: string;
  license_verified_at: string | null;
  couples: {
    relationship_type: RelationshipType;
    person_a: { name: string; birth_date: string | null };
    person_b: { name: string; birth_date: string | null };
  };
  person_a_image: ImageRow | null;
  person_b_image: ImageRow | null;
};

type ImageRow = {
  id: string;
  image_url: string;
  thumb_url: string | null;
  source_page_url: string | null;
  file_title: string | null;
  license: string | null;
  license_url: string | null;
  author: string | null;
  attribution_text: string | null;
  is_usable?: boolean;
};

const hasCompleteImageAttribution = (image: ImageRow | null): boolean =>
  Boolean(
    image?.image_url &&
      image?.source_page_url &&
      image?.license &&
      image?.author &&
      image?.attribution_text,
  );

type CandidateDetailsRow = {
  id: string;
  couple_id: string;
  person_a_image_id: string | null;
  person_b_image_id: string | null;
  person_a_photo_year: number | null;
  person_b_photo_year: number | null;
  license_verified_at: string | null;
  review_notes: string | null;
  editorial_person_a_bio: string | null;
  editorial_person_a_bio_url: string | null;
  editorial_person_b_bio: string | null;
  editorial_person_b_bio_url: string | null;
  couples: {
    id: string;
    relationship_type: RelationshipType;
    person_a_id: string;
    person_b_id: string;
    person_a: { name: string; birth_date: string | null; wikipedia_title: string | null };
    person_b: { name: string; birth_date: string | null; wikipedia_title: string | null };
  };
  person_a_image: ImageRow | null;
  person_b_image: ImageRow | null;
};

const relationshipTypes = new Set<RelationshipType>([
  "spouse",
  "couple",
  "former_spouse",
  "former_couple",
]);

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
  const shifted = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
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

const normalizeNullableText = (value: string | null | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const normalizeNullableDate = (value: string | null | undefined): string | null => {
  const normalized = normalizeNullableText(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("Birth dates must be YYYY-MM-DD");
  }
  return normalized;
};

const normalizeRequiredDate = (value: string | null | undefined, label: string): string => {
  const normalized = normalizeNullableDate(value);
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
};

const normalizeRequiredText = (value: string | null | undefined, label: string): string => {
  const normalized = normalizeNullableText(value);
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
};

const normalizeUrl = (value: string | null | undefined, label: string, required = false): string | null => {
  const normalized = normalizeNullableText(value);
  if (!normalized) {
    if (required) throw new Error(`${label} is required`);
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must use http or https`);
  }
  return normalized;
};

const normalizePhotoYear = (value: number | string | null | undefined, label: string): number => {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1850 || year > 2200) {
    throw new Error(`${label} must be a valid year`);
  }
  return year;
};

const normalizeNullablePhotoYear = (value: number | string | null | undefined, label: string): number | null => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalizePhotoYear(normalized, label);
};

const calculateExactAgeGapYears = (personABirthDate: string, personBBirthDate: string): number => {
  const a = new Date(`${personABirthDate}T00:00:00Z`);
  const b = new Date(`${personBBirthDate}T00:00:00Z`);
  const diffMs = Math.abs(a.getTime() - b.getTime());
  const msPerYear = 365.2425 * 24 * 60 * 60 * 1000;
  return Number((diffMs / msPerYear).toFixed(3));
};

const candidateSelect = `
  id,
  couple_id,
  person_a_image_id,
  person_b_image_id,
  person_a_photo_year,
  person_b_photo_year,
  computed_age_gap_years,
  quality_score,
  status,
  created_at,
  license_verified_at,
  couples!inner(
    relationship_type,
    person_a:people!couples_person_a_id_fkey(name,birth_date),
    person_b:people!couples_person_b_id_fkey(name,birth_date)
  ),
  person_a_image:images!puzzle_candidates_person_a_image_id_fkey(
    id,image_url,thumb_url,source_page_url,file_title,license,license_url,author,attribution_text,is_usable
  ),
  person_b_image:images!puzzle_candidates_person_b_image_id_fkey(
    id,image_url,thumb_url,source_page_url,file_title,license,license_url,author,attribution_text,is_usable
  )
`;

const candidateDetailsSelect = `
  id,
  couple_id,
  person_a_image_id,
  person_b_image_id,
  person_a_photo_year,
  person_b_photo_year,
  license_verified_at,
  review_notes,
  editorial_person_a_bio,
  editorial_person_a_bio_url,
  editorial_person_b_bio,
  editorial_person_b_bio_url,
  couples!inner(
    id,
    relationship_type,
    person_a_id,
    person_b_id,
    person_a:people!couples_person_a_id_fkey(name,birth_date,wikipedia_title),
    person_b:people!couples_person_b_id_fkey(name,birth_date,wikipedia_title)
  ),
  person_a_image:images!puzzle_candidates_person_a_image_id_fkey(
    id,image_url,thumb_url,source_page_url,file_title,license,license_url,author,attribution_text,is_usable
  ),
  person_b_image:images!puzzle_candidates_person_b_image_id_fkey(
    id,image_url,thumb_url,source_page_url,file_title,license,license_url,author,attribution_text,is_usable
  )
`;

const buildImageAlt = (image: ImageRow | null, fallbackName: string, photoYear: number | null): string | null => {
  if (!image) return null;
  return image.file_title || `${fallbackName}${photoYear ? ` in ${photoYear}` : ""}`;
};

const findOrCreatePerson = async ({
  name,
  birthDate,
  wikipediaTitle,
}: {
  name: string;
  birthDate: string;
  wikipediaTitle: string | null;
}): Promise<string> => {
  const supabase = getSupabaseAdmin();
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

const findOrCreateCouple = async ({
  personAId,
  personBId,
  relationshipType,
}: {
  personAId: string;
  personBId: string;
  relationshipType: RelationshipType;
}): Promise<{ coupleId: string; personAId: string; personBId: string }> => {
  const supabase = getSupabaseAdmin();
  const orderedPeople = [personAId, personBId].sort((a, b) => a.localeCompare(b));
  const orderedPersonAId = orderedPeople[0];
  const orderedPersonBId = orderedPeople[1];

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
    const { error } = await supabase
      .from("couples")
      .update({ relationship_type: relationshipType, updated_at: new Date().toISOString() })
      .eq("id", existingCouple.id);
    if (error) {
      throw new Error(`Failed to update couple relationship type: ${error.message}`);
    }
    return { coupleId: existingCouple.id, personAId: orderedPersonAId, personBId: orderedPersonBId };
  }

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

  return { coupleId: createdCouple.id, personAId: orderedPersonAId, personBId: orderedPersonBId };
};

const createPersonImage = async ({
  personId,
  image,
  fallbackTitle,
}: {
  personId: string;
  image: ImageInput;
  fallbackTitle: string;
}): Promise<string> => {
  const supabase = getSupabaseAdmin();
  const imageUrl = normalizeUrl(image.url, `${fallbackTitle} image URL`, true);
  const thumbUrl = normalizeUrl(image.thumbUrl, `${fallbackTitle} thumbnail URL`);
  const sourcePageUrl = normalizeUrl(image.sourcePageUrl, `${fallbackTitle} source page URL`);

  const { data, error } = await supabase
    .from("images")
    .insert({
      subject_type: "person",
      subject_id: personId,
      source: "wikimedia_commons",
      file_title: normalizeNullableText(image.fileTitle) || fallbackTitle,
      image_url: imageUrl,
      thumb_url: thumbUrl || imageUrl,
      source_page_url: sourcePageUrl,
      license: normalizeNullableText(image.license),
      license_url: normalizeUrl(image.licenseUrl, `${fallbackTitle} license URL`),
      author: normalizeNullableText(image.author),
      attribution_text: normalizeNullableText(image.attributionText),
      metadata_json: image.metadata ?? {},
      is_usable: true,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create ${fallbackTitle} image: ${error.message}`);
  }

  return data.id;
};

export const createManualReviewCandidate = async ({
  personAName,
  personABirthDate,
  personAWikipediaTitle,
  personBName,
  personBBirthDate,
  personBWikipediaTitle,
  relationshipType,
  personAPhotoYear,
  personBPhotoYear,
  personAImage,
  personBImage,
  editorialPersonABio,
  editorialPersonABioUrl,
  editorialPersonBBio,
  editorialPersonBBioUrl,
}: {
  personAName: string;
  personABirthDate: string;
  personAWikipediaTitle?: string | null;
  personBName: string;
  personBBirthDate: string;
  personBWikipediaTitle?: string | null;
  relationshipType: RelationshipType;
  personAPhotoYear?: number | string | null;
  personBPhotoYear?: number | string | null;
  personAImage?: ImageInput | null;
  personBImage?: ImageInput | null;
  editorialPersonABio?: string | null;
  editorialPersonABioUrl?: string | null;
  editorialPersonBBio?: string | null;
  editorialPersonBBioUrl?: string | null;
}): Promise<string> => {
  if (!relationshipTypes.has(relationshipType)) {
    throw new Error("Invalid relationship type");
  }

  const normalizedPersonAName = normalizeRequiredText(personAName, "Person A name");
  const normalizedPersonBName = normalizeRequiredText(personBName, "Person B name");
  const normalizedPersonABirthDate = normalizeRequiredDate(personABirthDate, "Person A birth date");
  const normalizedPersonBBirthDate = normalizeRequiredDate(personBBirthDate, "Person B birth date");
  const normalizedPersonAPhotoYear = normalizeNullablePhotoYear(personAPhotoYear, "Person A photo year");
  const normalizedPersonBPhotoYear = normalizeNullablePhotoYear(personBPhotoYear, "Person B photo year");

  const originalPersonAId = await findOrCreatePerson({
    name: normalizedPersonAName,
    birthDate: normalizedPersonABirthDate,
    wikipediaTitle: normalizeNullableText(personAWikipediaTitle),
  });
  const originalPersonBId = await findOrCreatePerson({
    name: normalizedPersonBName,
    birthDate: normalizedPersonBBirthDate,
    wikipediaTitle: normalizeNullableText(personBWikipediaTitle),
  });
  const { coupleId, personAId: orderedPersonAId, personBId: orderedPersonBId } = await findOrCreateCouple({
    personAId: originalPersonAId,
    personBId: originalPersonBId,
    relationshipType,
  });

  const candidatePersonAIsOriginalA = orderedPersonAId === originalPersonAId;
  const candidatePersonAImage = candidatePersonAIsOriginalA ? personAImage : personBImage;
  const candidatePersonBImage = candidatePersonAIsOriginalA ? personBImage : personAImage;
  const candidatePersonAPhotoYear = candidatePersonAIsOriginalA ? normalizedPersonAPhotoYear : normalizedPersonBPhotoYear;
  const candidatePersonBPhotoYear = candidatePersonAIsOriginalA ? normalizedPersonBPhotoYear : normalizedPersonAPhotoYear;
  const candidatePersonAName = candidatePersonAIsOriginalA ? normalizedPersonAName : normalizedPersonBName;
  const candidatePersonBName = candidatePersonAIsOriginalA ? normalizedPersonBName : normalizedPersonAName;

  const personAImageId = candidatePersonAImage?.url
    ? await createPersonImage({
        personId: orderedPersonAId,
        image: candidatePersonAImage,
        fallbackTitle: `${candidatePersonAName}${candidatePersonAPhotoYear ? ` (${candidatePersonAPhotoYear})` : ""}`,
      })
    : null;
  const personBImageId = candidatePersonBImage?.url
    ? await createPersonImage({
        personId: orderedPersonBId,
        image: candidatePersonBImage,
        fallbackTitle: `${candidatePersonBName}${candidatePersonBPhotoYear ? ` (${candidatePersonBPhotoYear})` : ""}`,
      })
    : null;

  const exactAgeGapYears = calculateExactAgeGapYears(normalizedPersonABirthDate, normalizedPersonBBirthDate);
  const { data: candidateRow, error } = await getSupabaseAdmin()
    .from("puzzle_candidates")
    .insert({
      couple_id: coupleId,
      person_a_image_id: personAImageId,
      person_b_image_id: personBImageId,
      person_a_photo_year: candidatePersonAPhotoYear,
      person_b_photo_year: candidatePersonBPhotoYear,
      computed_age_gap_years: exactAgeGapYears,
      quality_score: 100,
      status: "pending_review",
      editorial_person_a_bio: normalizeNullableText(editorialPersonABio),
      editorial_person_a_bio_url: normalizeNullableText(editorialPersonABioUrl),
      editorial_person_b_bio: normalizeNullableText(editorialPersonBBio),
      editorial_person_b_bio_url: normalizeNullableText(editorialPersonBBioUrl),
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create candidate: ${error.message}`);
  }

  return candidateRow.id;
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

  const approvedQueue = (approvedData as { id: string; couple_id: string }[] | null) ?? [];
  const nextCandidate = approvedQueue.find((row) => !usedIds.has(row.id) && !usedCoupleIds.has(row.couple_id));
  return nextCandidate?.id ?? null;
};

export const purgeExpiredRejectedCandidates = async (): Promise<number> => {
  const supabase = getSupabaseAdmin();
  const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: staleRejectedData, error } = await supabase
    .from("puzzle_candidates")
    .select("id")
    .eq("status", "rejected")
    .lt("reviewed_at", cutoffIso);

  if (error) {
    throw new Error(`Failed to load rejected candidates for cleanup: ${error.message}`);
  }

  const staleRejectedIds = (staleRejectedData as { id: string }[] | null)?.map((row) => row.id) ?? [];
  if (staleRejectedIds.length === 0) {
    return 0;
  }

  const { data: usedData, error: usedError } = await supabase.from("daily_puzzles").select("candidate_id");
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
    .select(candidateSelect, { count: "exact" })
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
    upNextCandidateId = (tomorrowPuzzleData as { candidate_id: string } | null)?.candidate_id ?? await getNextApprovedCandidateId();
  }

  const usageByCandidate = new Map<string, string[]>();
  for (const usageRow of usageRows) {
    const existing = usageByCandidate.get(usageRow.candidate_id) ?? [];
    existing.push(usageRow.puzzle_date);
    usageByCandidate.set(usageRow.candidate_id, existing);
  }

  const hydrated: ReviewCandidate[] = rows.map((row) => {
    const dates = (usageByCandidate.get(row.id) ?? []).sort((a, b) => b.localeCompare(a));
    const nextScheduledPuzzleDate = dates.filter((date) => date >= today).sort((a, b) => a.localeCompare(b))[0] ?? null;
    const isFinished = dates.some((date) => date <= today);
    const personAName = row.couples.person_a.name;
    const personBName = row.couples.person_b.name;

    return {
      id: row.id,
      coupleId: row.couple_id,
      couple: `${personAName} + ${personBName}`,
      relationshipType: row.couples.relationship_type,
      exactAgeGapYears: Number(row.computed_age_gap_years),
      roundedAgeGapYears: Math.round(Number(row.computed_age_gap_years)),
      personABirthDate: row.couples.person_a.birth_date ?? "unknown",
      personBBirthDate: row.couples.person_b.birth_date ?? "unknown",
      personAImageId: row.person_a_image_id,
      personAImageUrl: row.person_a_image ? row.person_a_image.thumb_url || row.person_a_image.image_url : null,
      personAImageAlt: buildImageAlt(row.person_a_image, personAName, row.person_a_photo_year),
      personAPhotoYear: row.person_a_photo_year,
      personAImageLicense: row.person_a_image?.license ?? null,
      personBImageId: row.person_b_image_id,
      personBImageUrl: row.person_b_image ? row.person_b_image.thumb_url || row.person_b_image.image_url : null,
      personBImageAlt: buildImageAlt(row.person_b_image, personBName, row.person_b_photo_year),
      personBPhotoYear: row.person_b_photo_year,
      personBImageLicense: row.person_b_image?.license ?? null,
      licenseVerifiedAt: row.license_verified_at,
      qualityScore: row.quality_score,
      status: row.status,
      createdAt: row.created_at,
      usedCount: dates.length,
      lastUsedPuzzleDate: dates[0] ?? null,
      nextScheduledPuzzleDate,
      isUsedToday: dates.includes(today),
      isFinished,
      isUpNext: row.id === upNextCandidateId,
    };
  });

  const filtered = hydrated.filter((item) => {
    if (status === "finished") return item.isFinished;
    if (status === "used_today") return item.isUsedToday;
    if (status === "approved") return item.status === "approved" && !item.isFinished;
    if (status === "pending_review") return item.status === "pending_review";
    return true;
  });
  const items = needsDerivedFiltering ? filtered.slice(rangeStart, rangeEnd + 1) : filtered;

  return {
    items,
    total: needsDerivedFiltering ? filtered.length : (Number.isFinite(count) ? Number(count) : items.length),
  };
};

export const getReviewCandidateDetails = async (candidateId: string): Promise<ReviewCandidateDetails> => {
  const { data, error } = await getSupabaseAdmin()
    .from("puzzle_candidates")
    .select(candidateDetailsSelect)
    .eq("id", candidateId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load candidate details: ${error.message}`);
  }
  if (!data) {
    throw new Error("Candidate not found");
  }

  const row = data as unknown as CandidateDetailsRow;
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
    personAImageId: row.person_a_image_id,
    personAImageUrl: row.person_a_image?.image_url ?? null,
    personAImageThumbUrl: row.person_a_image?.thumb_url ?? null,
    personAImageSourcePageUrl: row.person_a_image?.source_page_url ?? null,
    personAImageFileTitle: row.person_a_image?.file_title ?? null,
    personAImageLicense: row.person_a_image?.license ?? null,
    personAImageLicenseUrl: row.person_a_image?.license_url ?? null,
    personAImageAuthor: row.person_a_image?.author ?? null,
    personAImageAttributionText: row.person_a_image?.attribution_text ?? null,
    personAPhotoYear: row.person_a_photo_year,
    personBImageId: row.person_b_image_id,
    personBImageUrl: row.person_b_image?.image_url ?? null,
    personBImageThumbUrl: row.person_b_image?.thumb_url ?? null,
    personBImageSourcePageUrl: row.person_b_image?.source_page_url ?? null,
    personBImageFileTitle: row.person_b_image?.file_title ?? null,
    personBImageLicense: row.person_b_image?.license ?? null,
    personBImageLicenseUrl: row.person_b_image?.license_url ?? null,
    personBImageAuthor: row.person_b_image?.author ?? null,
    personBImageAttributionText: row.person_b_image?.attribution_text ?? null,
    personBPhotoYear: row.person_b_photo_year,
    licenseVerifiedAt: row.license_verified_at,
    reviewNotes: row.review_notes,
    editorialPersonABio: row.editorial_person_a_bio?.trim() || null,
    editorialPersonABioUrl: row.editorial_person_a_bio_url?.trim() || null,
    editorialPersonBBio: row.editorial_person_b_bio?.trim() || null,
    editorialPersonBBioUrl: row.editorial_person_b_bio_url?.trim() || null,
  };
};

export const updateReviewCandidateDetails = async (payload: ReviewCandidateDetailsUpdate): Promise<void> => {
  const supabase = getSupabaseAdmin();
  const current = await getReviewCandidateDetails(payload.candidateId);
  const personAName = normalizeRequiredText(payload.personAName, "Person A name");
  const personBName = normalizeRequiredText(payload.personBName, "Person B name");
  const personABirthDate = normalizeRequiredDate(payload.personABirthDate, "Person A birth date");
  const personBBirthDate = normalizeRequiredDate(payload.personBBirthDate, "Person B birth date");
  const personAPhotoYear = normalizeNullablePhotoYear(payload.personAPhotoYear, "Person A photo year");
  const personBPhotoYear = normalizeNullablePhotoYear(payload.personBPhotoYear, "Person B photo year");
  const nowIso = new Date().toISOString();

  const { error: personAError } = await supabase
    .from("people")
    .update({
      name: personAName,
      birth_date: personABirthDate,
      wikipedia_title: normalizeNullableText(payload.personAWikipediaTitle),
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
      wikipedia_title: normalizeNullableText(payload.personBWikipediaTitle),
      updated_at: nowIso,
    })
    .eq("id", current.personBId);
  if (personBError) {
    throw new Error(`Failed to update person B: ${personBError.message}`);
  }

  const { error: coupleError } = await supabase
    .from("couples")
    .update({ relationship_type: payload.relationshipType, updated_at: nowIso })
    .eq("id", current.coupleId);
  if (coupleError) {
    throw new Error(`Failed to update relationship type: ${coupleError.message}`);
  }

  const exactAgeGapYears = calculateExactAgeGapYears(personABirthDate, personBBirthDate);
  const personAImageId = payload.personAImage?.url
    ? await createPersonImage({
        personId: current.personAId,
        image: payload.personAImage,
        fallbackTitle: `${personAName}${personAPhotoYear ? ` (${personAPhotoYear})` : ""}`,
      })
    : undefined;
  const personBImageId = payload.personBImage?.url
    ? await createPersonImage({
        personId: current.personBId,
        image: payload.personBImage,
        fallbackTitle: `${personBName}${personBPhotoYear ? ` (${personBPhotoYear})` : ""}`,
      })
    : undefined;
  const candidateUpdate: Record<string, unknown> = {
    person_a_photo_year: personAPhotoYear,
    person_b_photo_year: personBPhotoYear,
    computed_age_gap_years: exactAgeGapYears,
    license_verified_at: payload.licenseVerified ? current.licenseVerifiedAt ?? nowIso : null,
    review_notes: normalizeNullableText(payload.reviewNotes),
    editorial_person_a_bio: normalizeNullableText(payload.editorialPersonABio),
    editorial_person_a_bio_url: normalizeNullableText(payload.editorialPersonABioUrl),
    editorial_person_b_bio: normalizeNullableText(payload.editorialPersonBBio),
    editorial_person_b_bio_url: normalizeNullableText(payload.editorialPersonBBioUrl),
    updated_at: nowIso,
  };
  if (personAImageId) {
    candidateUpdate.person_a_image_id = personAImageId;
    candidateUpdate.license_verified_at = null;
  }
  if (personBImageId) {
    candidateUpdate.person_b_image_id = personBImageId;
    candidateUpdate.license_verified_at = null;
  }

  const { error: candidateError } = await supabase
    .from("puzzle_candidates")
    .update(candidateUpdate)
    .eq("id", payload.candidateId);
  if (candidateError) {
    throw new Error(`Failed to update candidate editorial details: ${candidateError.message}`);
  }
};

export const updateCandidateStatus = async (id: string, status: CandidateStatus): Promise<void> => {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const reviewedAt = status === "pending_review" ? null : nowIso;
  const statusUpdate: Record<string, string | null> = { status, reviewed_at: reviewedAt };

  if (status === "approved") {
    const { data, error } = await supabase
      .from("puzzle_candidates")
      .select(candidateDetailsSelect)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load candidate for approval: ${error.message}`);
    }
    if (!data) {
      throw new Error("Candidate not found");
    }
    const row = data as unknown as CandidateDetailsRow;
    if (!row.person_a_image_id || !row.person_b_image_id || !row.person_a_image || !row.person_b_image) {
      throw new Error("Add both Wikimedia portraits before approving this candidate");
    }
    if (!row.person_a_photo_year || !row.person_b_photo_year) {
      throw new Error("Add both photo years before approving this candidate");
    }
    const hasVerifiedLicense = Boolean(row.license_verified_at);
    const hasCompleteAttribution =
      hasCompleteImageAttribution(row.person_a_image) && hasCompleteImageAttribution(row.person_b_image);
    if (!hasVerifiedLicense && !hasCompleteAttribution) {
      throw new Error("Open details and check image licenses verified before approving");
    }
    if (!hasVerifiedLicense && hasCompleteAttribution) {
      statusUpdate.license_verified_at = nowIso;
    }
    if (!row.person_a_image.is_usable || !row.person_b_image.is_usable) {
      throw new Error("Both person images must be usable before approval");
    }
  }

  const { error } = await supabase
    .from("puzzle_candidates")
    .update(statusUpdate)
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update candidate: ${error.message}`);
  }
};

export const deleteReviewCandidate = async (id: string): Promise<void> => {
  const supabase = getSupabaseAdmin();
  const { error: deleteDailyError } = await supabase.from("daily_puzzles").delete().eq("candidate_id", id);
  if (deleteDailyError) {
    throw new Error(`Failed deleting candidate schedules: ${deleteDailyError.message}`);
  }

  const { error: deleteCandidateError } = await supabase.from("puzzle_candidates").delete().eq("id", id);
  if (deleteCandidateError) {
    throw new Error(`Failed deleting candidate: ${deleteCandidateError.message}`);
  }
};

export const getQueueHealth = async (): Promise<QueueHealth> => {
  const supabase = getSupabaseAdmin();
  const lowQueueThreshold = Number(process.env.ADMIN_QUEUE_LOW_THRESHOLD ?? 3);
  const { data: candidates, error: candidatesError } = await supabase.from("puzzle_candidates").select("id,status");
  if (candidatesError) {
    throw new Error(`Failed to load candidate queue health: ${candidatesError.message}`);
  }

  const { data: usedData, error: usedError } = await supabase.from("daily_puzzles").select("candidate_id");
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
      if (usedIds.has(row.id)) approvedUsed += 1;
    }
    if (row.status === "pending_review") pending += 1;
    if (usedIds.has(row.id)) finished += 1;
  }

  const approvedUnused = Math.max(approvedTotal - approvedUsed, 0);
  return {
    totalCandidates: rows.length,
    approvedTotal,
    approvedUnused,
    approvedUsed,
    scheduled: usedIds.size,
    pending,
    finished,
    runwayDays: approvedUnused,
    lowQueueThreshold,
    isLow: approvedUnused < lowQueueThreshold,
  };
};

export const getReviewCandidateImage = async (
  candidateId: string,
): Promise<{
  coupleId: string;
  images: Array<{ id: string; imageUrl: string; imageAlt: string; subjectKey: "person_a" | "person_b" }>;
}> => {
  const details = await getReviewCandidateDetails(candidateId);
  return {
    coupleId: details.coupleId,
    images: [
      {
        id: details.personAImageId,
        imageUrl: details.personAImageThumbUrl || details.personAImageUrl,
        imageAlt: details.personAImageFileTitle || `${details.personAName}${details.personAPhotoYear ? ` in ${details.personAPhotoYear}` : ""}`,
        subjectKey: "person_a",
      },
      {
        id: details.personBImageId,
        imageUrl: details.personBImageThumbUrl || details.personBImageUrl,
        imageAlt: details.personBImageFileTitle || `${details.personBName}${details.personBPhotoYear ? ` in ${details.personBPhotoYear}` : ""}`,
        subjectKey: "person_b",
      },
    ].filter((image): image is { id: string; imageUrl: string; imageAlt: string; subjectKey: "person_a" | "person_b" } =>
      Boolean(image.id && image.imageUrl),
    ),
  };
};

export const markCoupleImageUnusable = async (imageId: string): Promise<void> => {
  const { error } = await getSupabaseAdmin().from("images").update({ is_usable: false }).eq("id", imageId);
  if (error) {
    throw new Error(`Failed to mark image unusable: ${error.message}`);
  }
};

export const addManualCoupleImage = async (_input?: unknown): Promise<string> => {
  throw new Error("Agegaple v3 images are created with candidates from Wikimedia Commons metadata");
};

export const assignCandidateImage = async (_input?: unknown): Promise<void> => {
  throw new Error("Agegaple v3 candidate image assignment is managed through candidate creation");
};
