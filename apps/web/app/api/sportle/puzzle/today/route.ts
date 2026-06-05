import { NextResponse } from "next/server";
import { getTodaySportlePuzzle } from "../../../../../lib/sportle/puzzle-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const puzzle = await getTodaySportlePuzzle();
    if (!puzzle) {
      return NextResponse.json({ error: "No Sportle puzzle scheduled yet." }, { status: 404 });
    }

    return NextResponse.json(puzzle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load today puzzle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
