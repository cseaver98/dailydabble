export type RelationshipType = "spouse" | "couple" | "former_spouse" | "former_couple";

export type CandidateStatus = "pending_review" | "approved" | "rejected";

export type AgegapleSubjectKey = "person_a" | "person_b";

export type EditorialContext = {
  relationshipNote: string;
  personABio: string | null;
  personABioUrl: string | null;
  personBBio: string | null;
  personBBioUrl: string | null;
};

export type PuzzlePersonPublic = {
  key: AgegapleSubjectKey;
  name: string;
  imageUrl: string;
  imageAlt: string;
  photoYear: number;
};

export type PuzzlePublic = {
  puzzleId: string;
  puzzleDate: string;
  archiveGameNumber: number;
  personAName: string;
  personBName: string;
  relationshipType: RelationshipType;
  personA: PuzzlePersonPublic;
  personB: PuzzlePersonPublic;
  relationshipTimeline: string | null;
  editorialContext: EditorialContext;
};

export type PuzzleAnswer = {
  puzzleId: string;
  guessType: "age_gap";
  guessYears: number;
  exactAgeGapYears: number;
  roundedAgeGapYears: number;
  absErrorYears: number;
  isCorrect: boolean;
  personABirthDate: string;
  personBBirthDate: string;
  personAAgeInPhotoYear: number;
  personBAgeInPhotoYear: number;
  attribution: string;
};

export type RoundGuessFeedback = {
  puzzleId: string;
  guessType: "round";
  gap: PuzzleAnswer;
};

export type ArchivePuzzleListItem = {
  puzzleDate: string;
  personAName: string;
  personBName: string;
  couple: string;
};
