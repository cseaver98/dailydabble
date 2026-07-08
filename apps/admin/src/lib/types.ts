export type RelationshipType = "spouse" | "couple" | "former_spouse" | "former_couple";

export type CandidateStatus = "pending_review" | "approved" | "rejected";
export type CandidateFilter = "pending_review" | "approved" | "finished" | "used_today" | "all";

export type EditorialContext = {
  relationshipNote: string;
  personABio: string | null;
  personABioUrl: string | null;
  personBBio: string | null;
  personBBioUrl: string | null;
};

export type PuzzlePublic = {
  puzzleId: string;
  puzzleDate: string;
  personAName: string;
  personBName: string;
  relationshipType: RelationshipType;
  personAImageUrl: string;
  personAImageAlt: string;
  personAPhotoYear: number;
  personBImageUrl: string;
  personBImageAlt: string;
  personBPhotoYear: number;
  editorialContext: EditorialContext;
};

export type PuzzleAnswer = {
  puzzleId: string;
  guessYears: number;
  exactAgeGapYears: number;
  roundedAgeGapYears: number;
  absErrorYears: number;
  personABirthDate: string;
  personBBirthDate: string;
  attribution: string;
};

export type ReviewCandidate = {
  id: string;
  coupleId: string;
  couple: string;
  relationshipType: RelationshipType;
  exactAgeGapYears: number;
  roundedAgeGapYears: number;
  personABirthDate: string;
  personBBirthDate: string;
  personAImageId: string | null;
  personAImageUrl: string | null;
  personAImageAlt: string | null;
  personAPhotoYear: number | null;
  personAImageLicense: string | null;
  personBImageId: string | null;
  personBImageUrl: string | null;
  personBImageAlt: string | null;
  personBPhotoYear: number | null;
  personBImageLicense: string | null;
  licenseVerifiedAt: string | null;
  qualityScore: number;
  status: CandidateStatus;
  createdAt: string;
  usedCount: number;
  lastUsedPuzzleDate: string | null;
  nextScheduledPuzzleDate: string | null;
  isUsedToday: boolean;
  isFinished: boolean;
  isUpNext: boolean;
};

export type ReviewCandidateDetails = {
  candidateId: string;
  coupleId: string;
  personAId: string;
  personBId: string;
  personAName: string;
  personABirthDate: string | null;
  personAWikipediaTitle: string | null;
  personBName: string;
  personBBirthDate: string | null;
  personBWikipediaTitle: string | null;
  relationshipType: RelationshipType;
  personAImageId: string | null;
  personAImageUrl: string | null;
  personAImageThumbUrl: string | null;
  personAImageSourcePageUrl: string | null;
  personAImageFileTitle: string | null;
  personAImageLicense: string | null;
  personAImageLicenseUrl: string | null;
  personAImageAuthor: string | null;
  personAImageAttributionText: string | null;
  personAPhotoYear: number | null;
  personBImageId: string | null;
  personBImageUrl: string | null;
  personBImageThumbUrl: string | null;
  personBImageSourcePageUrl: string | null;
  personBImageFileTitle: string | null;
  personBImageLicense: string | null;
  personBImageLicenseUrl: string | null;
  personBImageAuthor: string | null;
  personBImageAttributionText: string | null;
  personBPhotoYear: number | null;
  licenseVerifiedAt: string | null;
  reviewNotes: string | null;
  editorialPersonABio: string | null;
  editorialPersonABioUrl: string | null;
  editorialPersonBBio: string | null;
  editorialPersonBBioUrl: string | null;
};

export type ReviewCandidateDetailsUpdate = {
  candidateId: string;
  personAName: string;
  personABirthDate: string | null;
  personAWikipediaTitle: string | null;
  personBName: string;
  personBBirthDate: string | null;
  personBWikipediaTitle: string | null;
  relationshipType: RelationshipType;
  personAPhotoYear: number | null;
  personBPhotoYear: number | null;
  personAImage?: {
    url?: string | null;
    fileTitle?: string | null;
    thumbUrl?: string | null;
    sourcePageUrl?: string | null;
    license?: string | null;
    licenseUrl?: string | null;
    author?: string | null;
    attributionText?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  personBImage?: {
    url?: string | null;
    fileTitle?: string | null;
    thumbUrl?: string | null;
    sourcePageUrl?: string | null;
    license?: string | null;
    licenseUrl?: string | null;
    author?: string | null;
    attributionText?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  licenseVerified: boolean;
  reviewNotes: string | null;
  editorialPersonABio: string | null;
  editorialPersonABioUrl: string | null;
  editorialPersonBBio: string | null;
  editorialPersonBBioUrl: string | null;
};

export type QueueHealth = {
  totalCandidates: number;
  approvedTotal: number;
  approvedUnused: number;
  approvedUsed: number;
  scheduled: number;
  pending: number;
  finished: number;
  runwayDays: number;
  lowQueueThreshold: number;
  isLow: boolean;
};

export type ArchivePuzzleListItem = {
  puzzleDate: string;
  personAName: string;
  personBName: string;
  couple: string;
};
