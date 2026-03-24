import { NextResponse } from "next/server";

import { addManualCoupleImage, markCoupleImageUnusable } from "@/lib/puzzle-repository";

type PatchPayload = {
  imageId?: string;
};

type PostPayload = {
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

const allowedImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]);

const hasAllowedImageExtension = (value: string): boolean => {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    const dotIndex = pathname.lastIndexOf(".");
    if (dotIndex === -1) {
      // Some providers may serve image routes without a file extension.
      return true;
    }
    const ext = pathname.slice(dotIndex);
    return allowedImageExtensions.has(ext);
  } catch {
    return false;
  }
};

export async function POST(request: Request) {
  const payload = (await request.json()) as PostPayload;

  if (!payload.coupleId || !payload.imageUrl || !isHttpUrl(payload.imageUrl)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!hasAllowedImageExtension(payload.imageUrl)) {
    return NextResponse.json(
      { error: "Unsupported image type. Use PNG, JPG, JPEG, WEBP, SVG, or GIF URL." },
      { status: 400 },
    );
  }

  if (payload.thumbUrl && !isHttpUrl(payload.thumbUrl)) {
    return NextResponse.json({ error: "Invalid thumbUrl" }, { status: 400 });
  }

  if (payload.thumbUrl && !hasAllowedImageExtension(payload.thumbUrl)) {
    return NextResponse.json(
      { error: "Unsupported thumbUrl type. Use PNG, JPG, JPEG, WEBP, SVG, or GIF URL." },
      { status: 400 },
    );
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
    return NextResponse.json({ ok: true, imageId });
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
