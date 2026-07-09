import { NextResponse } from "next/server";
import { getCurrentArchiveSubscriptionAccess, isArchiveLockEnabled } from "@/lib/archive-lock";

import { listArchivePuzzles } from "@/lib/agegaple/puzzle-repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [items, archiveAccess] = await Promise.all([
      listArchivePuzzles(),
      getCurrentArchiveSubscriptionAccess(),
    ]);
    return NextResponse.json(
      { items, lockEnabled: isArchiveLockEnabled(), archiveAccess },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
