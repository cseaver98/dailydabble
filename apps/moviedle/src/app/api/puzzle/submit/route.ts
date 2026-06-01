import { NextRequest, NextResponse } from "next/server";
import { submitMovieGuess } from "../../../../lib/puzzle-repository";

export const runtime = "nodejs";

type SubmitPayload = {
  puzzleId?: string;
  guessTitle?: string;
  guessCount?: number;
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as SubmitPayload;
    const puzzleId = payload?.puzzleId;
    const guessTitle = typeof payload?.guessTitle === "string" ? payload.guessTitle.trim() : "";
    const guessCount = Number(payload?.guessCount);

    if (!puzzleId || !guessTitle || !Number.isFinite(guessCount) || guessCount < 0 || guessCount > 5) {
      return NextResponse.json({ error: "Missing or invalid puzzleId/guessTitle/guessCount" }, { status: 400 });
    }

    const result = await submitMovieGuess(puzzleId, guessTitle, guessCount);
    if (!result) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit guess";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
