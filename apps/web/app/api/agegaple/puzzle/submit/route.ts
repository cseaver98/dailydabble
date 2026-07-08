import { NextResponse } from "next/server";

import { submitRoundGuess } from "@/lib/agegaple/puzzle-repository";

type SubmitPayload = {
  puzzleId?: string;
  guessType?: "round";
  guessedAgeGap?: number;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as SubmitPayload;

  if (!payload.puzzleId || payload.guessType !== "round") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    if (
      typeof payload.guessedAgeGap !== "number" ||
      !Number.isFinite(payload.guessedAgeGap) ||
      payload.guessedAgeGap < 0 ||
      payload.guessedAgeGap > 80
    ) {
      return NextResponse.json({ error: "Age gap guess must be between 0 and 80" }, { status: 400 });
    }

    const answer = await submitRoundGuess({
      puzzleId: payload.puzzleId,
      guessedAgeGap: Math.round(payload.guessedAgeGap),
    });

    if (!answer) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    return NextResponse.json(answer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
