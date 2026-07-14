import { NextRequest, NextResponse } from "next/server";
import { buildCharFeedback, validateEquation } from "../../../../../lib/equadle/equation";
import { getEquadleAnswer } from "../../../../../lib/equadle/puzzle-repository";

export const runtime = "nodejs";

type SubmitPayload = {
  puzzleId?: string;
  guessEquation?: string;
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as SubmitPayload;
    const puzzleId = payload?.puzzleId;
    const rawGuess = payload?.guessEquation;

    if (!puzzleId || typeof rawGuess !== "string") {
      return NextResponse.json({ error: "Missing puzzleId or guess" }, { status: 400 });
    }

    const puzzle = await getEquadleAnswer(puzzleId);
    if (!puzzle) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    let guess: string;
    try {
      guess = validateEquation(rawGuess, Number(puzzle.equation_length) || 9);
    } catch (validationError) {
      const message = validationError instanceof Error ? validationError.message : "Guess must be a valid equation";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const answer = String(puzzle.equation);
    const target = answer.split("=")[1] || "";
    if ((guess.split("=")[1] || "") !== target) {
      return NextResponse.json({ error: `Equation must equal ${target}` }, { status: 400 });
    }
    const feedback = buildCharFeedback(guess, answer);

    return NextResponse.json({
      guess,
      feedback,
      isCorrect: guess === answer,
      answer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit guess";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
