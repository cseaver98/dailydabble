import { NextRequest, NextResponse } from "next/server";
import { submitYearGuess } from "../../../../lib/puzzle-repository";

export const runtime = "nodejs";

type SubmitPayload = {
  puzzleId?: string;
  guessYear?: number;
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as SubmitPayload;
    const puzzleId = payload?.puzzleId;
    const guessYear = Number(payload?.guessYear);

    if (!puzzleId || !Number.isFinite(guessYear) || guessYear < 1 || guessYear > 3000) {
      return NextResponse.json({ error: "Missing or invalid puzzleId/guessYear" }, { status: 400 });
    }

    const result = await submitYearGuess(puzzleId, Math.round(guessYear));
    if (!result) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit guess";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
