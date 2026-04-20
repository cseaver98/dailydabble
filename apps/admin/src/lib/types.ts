export type RelationshipType = "spouse" | "couple" | "former_spouse" | "former_couple";

export type CandidateStatus = "pending_review" | "approved" | "rejected";
export type CandidateFilter = "pending_review" | "approved" | "finished" | "all";

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
  reviewNotes: string | null;
  editorialRelationshipNote: string | null;
  editorialPersonABio: string | null;
  editorialPersonABioUrl: string | null;
  editorialPersonBBio: string | null;
  editorialPersonBBioUrl: string | null;
  editorialCoupleContext: string | null;
  editorialCoupleContextUrl: string | null;
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
  reviewNotes: string | null;
  editorialRelationshipNote: string | null;
  editorialPersonABio: string | null;
  editorialPersonABioUrl: string | null;
  editorialPersonBBio: string | null;
  editorialPersonBBioUrl: string | null;
  editorialCoupleContext: string | null;
  editorialCoupleContextUrl: string | null;
};

export type QueueHealth = {
  approvedTotal: number;
  approvedUnused: number;
  approvedUsed: number;
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
