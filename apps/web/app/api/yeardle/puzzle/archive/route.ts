import { NextResponse } from "next/server";
import { getCurrentArchiveSubscriptionAccess, isArchiveLockEnabled } from "../../../../../lib/archive-lock";
import { listYeardleArchive } from "../../../../../lib/yeardle/puzzle-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [items, archiveAccess] = await Promise.all([
      listYeardleArchive(120),
      getCurrentArchiveSubscriptionAccess("yeardle"),
    ]);
    return NextResponse.json({ items, lockEnabled: isArchiveLockEnabled("yeardle"), archiveAccess });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load archive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
