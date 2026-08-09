import { NextResponse } from "next/server";
import { getCurrentArchiveSubscriptionAccess, isArchiveLockEnabled } from "../../../../../lib/archive-lock";
import { listDoodleArchive } from "../../../../../lib/doodle/puzzle-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [items, archiveAccess] = await Promise.all([
      listDoodleArchive(120),
      getCurrentArchiveSubscriptionAccess("doodle"),
    ]);
    return NextResponse.json({ items, lockEnabled: isArchiveLockEnabled("doodle"), archiveAccess });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load archive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
