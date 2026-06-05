import { NextResponse } from "next/server";
import { getTodayVerblePuzzle } from "../../../../../lib/verble/puzzle-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const puzzle = await getTodayVerblePuzzle();
    if (!puzzle) {
      return NextResponse.json({ error: "No Verble puzzle scheduled yet." }, { status: 404 });
    }
    return NextResponse.json(puzzle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load today puzzle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
