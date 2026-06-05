import { NextResponse } from "next/server";

import { submitGuess } from "@/lib/agegaple/puzzle-repository";

type SubmitPayload = {
  puzzleId?: string;
  guessYears?: number;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as SubmitPayload;

  if (!payload.puzzleId || typeof payload.guessYears !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!Number.isFinite(payload.guessYears) || payload.guessYears < 0 || payload.guessYears > 80) {
    return NextResponse.json({ error: "Guess must be between 0 and 80" }, { status: 400 });
  }

  try {
    const answer = await submitGuess(payload.puzzleId, Math.round(payload.guessYears));

    if (!answer) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    return NextResponse.json(answer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
