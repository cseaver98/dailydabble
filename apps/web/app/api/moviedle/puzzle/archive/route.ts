import { NextResponse } from "next/server";
import { getCurrentArchiveSubscriptionAccess, isArchiveLockEnabled } from "../../../../../lib/archive-lock";
import { listMoviedleArchive } from "../../../../../lib/moviedle/puzzle-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [items, archiveAccess] = await Promise.all([
      listMoviedleArchive(120),
      getCurrentArchiveSubscriptionAccess("moviedle"),
    ]);
    return NextResponse.json({ items, lockEnabled: isArchiveLockEnabled("moviedle"), archiveAccess });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load archive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
