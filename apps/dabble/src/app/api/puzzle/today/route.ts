import { NextResponse } from "next/server";
import { getTodayDabblePuzzle } from "../../../../lib/puzzle-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const puzzle = await getTodayDabblePuzzle();
    if (!puzzle) {
      return NextResponse.json({ error: "No Dabble puzzle scheduled yet." }, { status: 404 });
    }
    return NextResponse.json(puzzle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load today puzzle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
