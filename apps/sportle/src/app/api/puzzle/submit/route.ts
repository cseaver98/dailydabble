import { NextRequest, NextResponse } from "next/server";
import { findSportleGuessAthlete, getSportleAnswer } from "../../../../lib/puzzle-repository";

export const runtime = "nodejs";

type SubmitPayload = {
  puzzleId?: string;
  guessName?: string;
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as SubmitPayload;
    const puzzleId = payload?.puzzleId;
    const rawGuess = payload?.guessName;

    if (!puzzleId || typeof rawGuess !== "string") {
      return NextResponse.json({ error: "Missing puzzleId or guess" }, { status: 400 });
    }

    const guessName = rawGuess.trim();
    if (!guessName) {
      return NextResponse.json({ error: "Enter an athlete guess" }, { status: 400 });
    }

    const answer = await getSportleAnswer(puzzleId);
    if (!answer) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    const guessAthlete = await findSportleGuessAthlete(guessName, answer.sport);

    return NextResponse.json({
      guess: guessAthlete?.full_name || guessName,
      guessedAthleteId: guessAthlete?.id || null,
      isCorrect: guessAthlete?.id === answer.id,
      answerName: answer.full_name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit guess";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
