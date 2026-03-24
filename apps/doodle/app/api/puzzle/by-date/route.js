import { NextResponse } from "next/server";
import { getDoodlePuzzleByDate } from "../../../../lib/puzzle-repository";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || "";

    const puzzle = await getDoodlePuzzleByDate(date);
    if (!puzzle) {
      return NextResponse.json({ error: `No doodle scheduled for ${date}` }, { status: 404 });
    }

    return NextResponse.json(puzzle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load puzzle by date";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
