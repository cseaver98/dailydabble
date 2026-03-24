export type RelationshipType = "spouse" | "partner";

export type CandidateStatus = "pending_review" | "approved" | "rejected";

export type EditorialContext = {
  relationshipNote: string;
  personABio: string | null;
  personABioUrl: string | null;
  personBBio: string | null;
  personBBioUrl: string | null;
  coupleContext: string | null;
  coupleContextUrl: string | null;
};

export type PuzzlePublic = {
  puzzleId: string;
  puzzleDate: string;
  personAName: string;
  personBName: string;
  relationshipType: RelationshipType;
  imageUrl: string;
  imageAlt: string;
  galleryImages: { imageUrl: string; imageAlt: string }[];
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
  imageUrl: string;
  galleryImages: { id: string; imageUrl: string; imageAlt: string }[];
  license: string;
  qualityScore: number;
  status: CandidateStatus;
  createdAt: string;
  usedCount: number;
  lastUsedPuzzleDate: string | null;
  isUsedToday: boolean;
  isUpNext: boolean;
};

export type QueueHealth = {
  approvedTotal: number;
  approvedUnused: number;
  approvedUsed: number;
  pending: number;
  rejected: number;
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
