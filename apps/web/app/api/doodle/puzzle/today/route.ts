import { NextResponse } from "next/server";
import { getTodayDoodlePuzzle } from "../../../../../lib/doodle/puzzle-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const puzzle = await getTodayDoodlePuzzle();
    if (!puzzle) {
      return NextResponse.json({ error: "No doodle puzzle scheduled yet." }, { status: 404 });
    }

    return NextResponse.json(puzzle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load today puzzle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
