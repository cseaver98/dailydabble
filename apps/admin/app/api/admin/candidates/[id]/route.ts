import { NextResponse } from "next/server";

import { getReviewCandidateDetails, updateReviewCandidateDetails } from "@/lib/puzzle-repository";
import type { ReviewCandidateDetailsUpdate } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const isRelationshipType = (value: string): value is "spouse" | "couple" | "former_spouse" | "former_couple" =>
  value === "spouse" || value === "couple" || value === "former_spouse" || value === "former_couple";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const candidateId = params?.id ?? "";
    if (!candidateId) {
      return NextResponse.json({ error: "Candidate id is required" }, { status: 400 });
    }

    const details = await getReviewCandidateDetails(candidateId);
    return NextResponse.json({ ok: true, details });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const candidateId = params?.id ?? "";
    if (!candidateId) {
      return NextResponse.json({ error: "Candidate id is required" }, { status: 400 });
    }

    const payload = (await request.json().catch(() => ({}))) as Partial<ReviewCandidateDetailsUpdate> & {
      relationshipType?: string;
    };

    if (!isRelationshipType(String(payload.relationshipType ?? ""))) {
      return NextResponse.json(
        { error: "relationshipType must be spouse, couple, former_spouse, or former_couple" },
        { status: 400 },
      );
    }

    await updateReviewCandidateDetails({
      candidateId,
      personAName: String(payload.personAName ?? ""),
      personABirthDate: payload.personABirthDate ? String(payload.personABirthDate) : null,
      personAWikipediaTitle: payload.personAWikipediaTitle ? String(payload.personAWikipediaTitle) : null,
      personBName: String(payload.personBName ?? ""),
      personBBirthDate: payload.personBBirthDate ? String(payload.personBBirthDate) : null,
      personBWikipediaTitle: payload.personBWikipediaTitle ? String(payload.personBWikipediaTitle) : null,
      relationshipType: payload.relationshipType,
      reviewNotes: payload.reviewNotes ? String(payload.reviewNotes) : null,
      editorialPersonABio: payload.editorialPersonABio ? String(payload.editorialPersonABio) : null,
      editorialPersonABioUrl: payload.editorialPersonABioUrl ? String(payload.editorialPersonABioUrl) : null,
      editorialPersonBBio: payload.editorialPersonBBio ? String(payload.editorialPersonBBio) : null,
      editorialPersonBBioUrl: payload.editorialPersonBBioUrl ? String(payload.editorialPersonBBioUrl) : null,
      editorialCoupleContext: payload.editorialCoupleContext ? String(payload.editorialCoupleContext) : null,
      editorialCoupleContextUrl: payload.editorialCoupleContextUrl ? String(payload.editorialCoupleContextUrl) : null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
