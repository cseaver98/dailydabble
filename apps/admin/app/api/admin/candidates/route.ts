import { NextResponse } from "next/server";

import {
  createManualReviewCandidate,
  deleteReviewCandidate,
  DuplicateCandidateWarning,
  getQueueHealth,
  listReviewCandidates,
  purgeExpiredRejectedCandidates,
  updateCandidateStatus,
} from "@/lib/puzzle-repository";
import type { CandidateFilter, CandidateStatus } from "@/lib/types";

type PatchPayload = {
  id?: string;
  status?: CandidateStatus;
  confirmDuplicate?: boolean;
};
type PostPayload = {
  personAName?: string;
  personABirthDate?: string;
  personAWikipediaTitle?: string;
  personBName?: string;
  personBBirthDate?: string;
  personBWikipediaTitle?: string;
  relationshipType?: "spouse" | "couple" | "former_spouse" | "former_couple";
  relationshipStartYear?: number | string;
  relationshipEndYear?: number | string;
  personAPhotoYear?: number | string;
  personBPhotoYear?: number | string;
  personAImage?: {
    url?: string;
    fileTitle?: string;
    thumbUrl?: string;
    sourcePageUrl?: string;
    license?: string;
    licenseUrl?: string;
    author?: string;
    attributionText?: string;
    metadata?: Record<string, unknown>;
  };
  personBImage?: {
    url?: string;
    fileTitle?: string;
    thumbUrl?: string;
    sourcePageUrl?: string;
    license?: string;
    licenseUrl?: string;
    author?: string;
    attributionText?: string;
    metadata?: Record<string, unknown>;
  };
  editorialPersonABio?: string;
  editorialPersonABioUrl?: string;
  editorialPersonBBio?: string;
  editorialPersonBBioUrl?: string;
};

const validStatuses: CandidateStatus[] = ["pending_review", "approved"];
const validFilters: CandidateFilter[] = ["all", "pending_review", "approved", "finished", "used_today"];
const validRelationshipTypes = new Set(["spouse", "couple", "former_spouse", "former_couple"]);

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const statusParam = requestUrl.searchParams.get("status") ?? "all";
    const pageParam = Number(requestUrl.searchParams.get("page") ?? "1");
    const pageSizeParam = Number(requestUrl.searchParams.get("pageSize") ?? "25");
    const status = statusParam as CandidateFilter;
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? Math.floor(pageSizeParam) : 25;

    if (!validFilters.includes(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    await purgeExpiredRejectedCandidates();
    const { items, total } = await listReviewCandidates({ status, page, pageSize });
    const queueHealth = await getQueueHealth();
    return NextResponse.json({ items, total, page, pageSize, status, queueHealth });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const payload = (await request.json()) as PatchPayload;

  if (!payload.id || !payload.status || !validStatuses.includes(payload.status)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const warning = await updateCandidateStatus(payload.id, payload.status, {
      confirmDuplicate: payload.confirmDuplicate === true,
    });
    return NextResponse.json({ ok: true, warning });
  } catch (error) {
    if (error instanceof DuplicateCandidateWarning) {
      return NextResponse.json({ duplicateWarning: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as PostPayload;
  const relationshipType = String(payload.relationshipType ?? "couple");

  if (!validRelationshipTypes.has(relationshipType)) {
    return NextResponse.json({ error: "Invalid relationship type" }, { status: 400 });
  }

  try {
    const candidateId = await createManualReviewCandidate({
      personAName: String(payload.personAName ?? ""),
      personABirthDate: String(payload.personABirthDate ?? ""),
      personAWikipediaTitle: payload.personAWikipediaTitle,
      personBName: String(payload.personBName ?? ""),
      personBBirthDate: String(payload.personBBirthDate ?? ""),
      personBWikipediaTitle: payload.personBWikipediaTitle,
      relationshipType: relationshipType as "spouse" | "couple" | "former_spouse" | "former_couple",
      relationshipStartYear: payload.relationshipStartYear,
      relationshipEndYear: payload.relationshipEndYear,
      personAPhotoYear: payload.personAPhotoYear ?? "",
      personBPhotoYear: payload.personBPhotoYear ?? "",
      personAImage: payload.personAImage ?? {},
      personBImage: payload.personBImage ?? {},
      editorialPersonABio: payload.editorialPersonABio,
      editorialPersonABioUrl: payload.editorialPersonABioUrl,
      editorialPersonBBio: payload.editorialPersonBBio,
      editorialPersonBBioUrl: payload.editorialPersonBBioUrl,
    });

    return NextResponse.json({ ok: true, candidateId });
  } catch (error) {
    if (error instanceof DuplicateCandidateWarning) {
      return NextResponse.json({ duplicateWarning: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { id?: string };
  const id = String(payload.id || "");
  if (!id) {
    return NextResponse.json({ error: "Missing candidate id" }, { status: 400 });
  }

  try {
    await deleteReviewCandidate(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
