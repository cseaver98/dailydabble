import { NextResponse } from "next/server";

import { getTodayPuzzle } from "@/lib/puzzle-repository";

export async function GET() {
  try {
    const puzzle = await getTodayPuzzle();
    if (!puzzle) {
      return NextResponse.json({ error: "No puzzle available" }, { status: 404 });
    }

    return NextResponse.json(puzzle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
