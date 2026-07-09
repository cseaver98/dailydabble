import { NextResponse } from "next/server";
import { getCurrentArchiveSubscriptionAccess, isArchiveLockEnabled } from "../../../../../lib/archive-lock";
import { listEquadleArchive } from "../../../../../lib/equadle/puzzle-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [items, archiveAccess] = await Promise.all([
      listEquadleArchive(120),
      getCurrentArchiveSubscriptionAccess(),
    ]);
    return NextResponse.json({ items, lockEnabled: isArchiveLockEnabled(), archiveAccess });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load archive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
