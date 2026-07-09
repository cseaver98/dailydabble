import { NextRequest, NextResponse } from "next/server";
import { createArchiveLockedResponse, shouldLockArchivePuzzleRequest } from "../../../../../lib/archive-lock";
import { getYeardlePuzzleByDate } from "../../../../../lib/yeardle/puzzle-repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || "";

    const puzzle = await getYeardlePuzzleByDate(date);
    if (!puzzle) {
      return NextResponse.json({ error: `No Yeardle puzzle scheduled for ${date}` }, { status: 404 });
    }
    if (await shouldLockArchivePuzzleRequest({ request, archiveGameNumber: puzzle.archiveGameNumber })) {
      return createArchiveLockedResponse("Yeardle", date);
    }

    return NextResponse.json(puzzle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load puzzle by date";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
