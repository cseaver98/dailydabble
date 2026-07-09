import { NextRequest, NextResponse } from "next/server";
import {
  createArchiveLockedResponse,
  createArchiveSubscriptionLockedResponse,
  getArchivePuzzleLockState,
} from "@/lib/archive-lock";

import { getPuzzleByDate } from "@/lib/agegaple/puzzle-repository";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date || !datePattern.test(date)) {
    return NextResponse.json({ error: "Invalid date. Use YYYY-MM-DD." }, { status: 400 });
  }

  try {
    const puzzle = await getPuzzleByDate(date);
    if (!puzzle) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }
    const lockState = await getArchivePuzzleLockState({ request, archiveGameNumber: puzzle.archiveGameNumber });
    if (lockState.locked) {
      return lockState.reason === "subscription"
        ? createArchiveSubscriptionLockedResponse("Agegaple", date)
        : createArchiveLockedResponse("Agegaple", date);
    }

    return NextResponse.json(puzzle, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
