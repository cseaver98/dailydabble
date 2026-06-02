import { NextResponse } from "next/server";
import { submitDabbleWordGuess } from "../../../../lib/puzzle-repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const puzzleId = String(payload.puzzleId || "").trim();
    const slotIndex = Number(payload.slotIndex);
    const guessWord = String(payload.guessWord || "");

    if (!puzzleId) {
      return NextResponse.json({ error: "puzzleId is required" }, { status: 400 });
    }
    if (!Number.isInteger(slotIndex) || slotIndex < 0) {
      return NextResponse.json({ error: "slotIndex must be a non-negative integer" }, { status: 400 });
    }

    const result = await submitDabbleWordGuess({ puzzleId, slotIndex, guessWord });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to validate guess";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
