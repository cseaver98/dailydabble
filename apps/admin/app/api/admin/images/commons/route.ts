import { NextResponse } from "next/server";

import { fetchCommonsImageMetadata } from "@/lib/wikimedia-commons";

type LookupPayload = {
  url?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as LookupPayload;
  const url = String(payload.url ?? "").trim();

  if (!url) {
    return NextResponse.json({ error: "Commons URL is required" }, { status: 400 });
  }

  try {
    const metadata = await fetchCommonsImageMetadata(url);
    return NextResponse.json({ ok: true, metadata });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Commons metadata";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
