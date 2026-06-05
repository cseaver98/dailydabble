import { NextRequest, NextResponse } from "next/server";
import { applyArchiveUnlockCookie, isArchiveLockEnabled, isArchivePasswordValid } from "../../../../lib/archive-lock";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isArchiveLockEnabled()) {
    return NextResponse.json({ error: "Archive lock is not enabled." }, { status: 404 });
  }

  const payload = await request.json().catch(() => ({}));
  const password = typeof payload?.password === "string" ? payload.password : "";

  if (!isArchivePasswordValid(password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  return applyArchiveUnlockCookie(NextResponse.json({ ok: true }));
}
