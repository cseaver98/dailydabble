import { NextRequest, NextResponse } from "next/server";
import {
  createArchiveLockedResponse,
  createArchiveSubscriptionLockedResponse,
  getArchivePuzzleLockState,
} from "../../../../../lib/archive-lock";
import { getMoviedlePuzzleByDate } from "../../../../../lib/moviedle/puzzle-repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || "";

    const puzzle = await getMoviedlePuzzleByDate(date);
    if (!puzzle) {
      return NextResponse.json({ error: `No Moviedle puzzle scheduled for ${date}` }, { status: 404 });
    }
    const lockState = await getArchivePuzzleLockState({ request, archiveGameNumber: puzzle.archiveGameNumber });
    if (lockState.locked) {
      return lockState.reason === "subscription"
        ? createArchiveSubscriptionLockedResponse("Moviedle", date)
        : createArchiveLockedResponse("Moviedle", date);
    }

    return NextResponse.json(puzzle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load puzzle by date";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
