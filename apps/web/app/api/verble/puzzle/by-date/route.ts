import { NextRequest, NextResponse } from "next/server";
import { createArchiveLockedResponse, hasArchiveUnlockCookie, isLockedArchiveGameNumber } from "../../../../../lib/archive-lock";
import { getVerblePuzzleByDate } from "../../../../../lib/verble/puzzle-repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || "";

    const puzzle = await getVerblePuzzleByDate(date);
    if (!puzzle) {
      return NextResponse.json({ error: `No Verble puzzle scheduled for ${date}` }, { status: 404 });
    }
    if (isLockedArchiveGameNumber(puzzle.archiveGameNumber) && !hasArchiveUnlockCookie(request)) {
      return createArchiveLockedResponse("Verble", date);
    }

    return NextResponse.json(puzzle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load puzzle by date";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
