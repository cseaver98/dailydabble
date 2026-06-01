import { NextResponse } from "next/server";

import {
  addManualCoupleImage,
  assignCandidateImage,
  getReviewCandidateImage,
  markCoupleImageUnusable,
} from "@/lib/puzzle-repository";

type PatchPayload = {
  imageId?: string;
};

type PostPayload = {
  candidateId?: string;
  coupleId?: string;
  imageUrl?: string;
  fileTitle?: string;
  thumbUrl?: string;
  license?: string;
  author?: string;
  attributionText?: string;
};

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export async function POST(request: Request) {
  const payload = (await request.json()) as PostPayload;

  if (!payload.coupleId || !payload.imageUrl || !isHttpUrl(payload.imageUrl)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (payload.thumbUrl && !isHttpUrl(payload.thumbUrl)) {
    return NextResponse.json({ error: "Invalid thumbUrl" }, { status: 400 });
  }

  try {
    const imageId = await addManualCoupleImage({
      coupleId: payload.coupleId,
      imageUrl: payload.imageUrl,
      fileTitle: payload.fileTitle,
      thumbUrl: payload.thumbUrl,
      license: payload.license,
      author: payload.author,
      attributionText: payload.attributionText,
    });

    if (payload.candidateId) {
      await assignCandidateImage({ candidateId: payload.candidateId, imageId });
    }

    return NextResponse.json({ ok: true, imageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get("candidateId") ?? "";

  if (!candidateId) {
    return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
  }

  try {
    const data = await getReviewCandidateImage(candidateId);
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const payload = (await request.json()) as PatchPayload;

  if (!payload.imageId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await markCoupleImageUnusable(payload.imageId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
