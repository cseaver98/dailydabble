import { NextRequest, NextResponse } from "next/server";
import {
  createArchiveLockedResponse,
  createArchiveSubscriptionLockedResponse,
  getArchivePuzzleLockState,
} from "../../../../../lib/archive-lock";
import { getSportlePuzzleByDate } from "../../../../../lib/sportle/puzzle-repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || "";

    const puzzle = await getSportlePuzzleByDate(date);
    if (!puzzle) {
      return NextResponse.json({ error: `No Sportle puzzle scheduled for ${date}` }, { status: 404 });
    }
    const lockState = await getArchivePuzzleLockState({ request, archiveGameNumber: puzzle.archiveGameNumber });
    if (lockState.locked) {
      return lockState.reason === "subscription"
        ? createArchiveSubscriptionLockedResponse("Sportle", date)
        : createArchiveLockedResponse("Sportle", date);
    }

    return NextResponse.json(puzzle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load puzzle by date";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
