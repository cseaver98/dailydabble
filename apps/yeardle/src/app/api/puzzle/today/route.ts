import { NextResponse } from "next/server";
import { getTodayYeardlePuzzle } from "../../../../lib/puzzle-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const puzzle = await getTodayYeardlePuzzle();
    if (!puzzle) {
      return NextResponse.json({ error: "No Yeardle puzzle scheduled yet." }, { status: 404 });
    }

    return NextResponse.json(puzzle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load today puzzle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
