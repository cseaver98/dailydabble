import { NextResponse } from "next/server";
import { findSportleGuessAthlete, getSportleAnswer } from "../../../../lib/puzzle-repository";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const puzzleId = payload?.puzzleId;
    const rawGuess = payload?.guessName;

    if (!puzzleId || typeof rawGuess !== "string") {
      return NextResponse.json({ error: "Missing puzzleId or guess" }, { status: 400 });
    }

    const answer = await getSportleAnswer(puzzleId);
    if (!answer) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    const guessAthlete = await findSportleGuessAthlete(rawGuess, answer.sport);
    if (!guessAthlete) {
      return NextResponse.json(
        { error: "Choose a valid athlete from suggestions" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      guess: guessAthlete.full_name,
      guessedAthleteId: guessAthlete.id,
      isCorrect: guessAthlete.id === answer.id,
      answerName: answer.full_name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit guess";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
