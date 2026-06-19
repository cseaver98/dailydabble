import { NextResponse } from "next/server";
import {
  ensureGuestPlayer,
  getAccountSupabaseAdmin,
  getGuestCompletionCount,
  recordGameResult,
} from "@/lib/account-results";

const CHECK_GAME_SLUG = "verble";
const CHECK_PUZZLE_DATE = "2099-01-01";
const CHECK_PUZZLE_ID = "stage1-foundation-check";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let recordedResultId = "";
  let playerId = "";

  try {
    const supabase = getAccountSupabaseAdmin();
    playerId = await ensureGuestPlayer({ supabase });
    const before = await getGuestCompletionCount(playerId);

    const result = await recordGameResult({
      gameSlug: CHECK_GAME_SLUG,
      puzzleId: CHECK_PUZZLE_ID,
      puzzleDate: CHECK_PUZZLE_DATE,
      isArchive: true,
      isWin: true,
      guessesUsed: 1,
      maxGuesses: 6,
      resultPayload: { stage1Check: true },
      playerId,
    });
    recordedResultId = result.id;

    const during = await getGuestCompletionCount(playerId);

    const { error: resultDeleteError } = await supabase
      .schema("core")
      .from("game_results")
      .delete()
      .eq("id", recordedResultId);
    if (resultDeleteError) {
      throw new Error(`Failed to clean up stage1 game result: ${resultDeleteError.message}`);
    }

    const { error: completionDeleteError } = await supabase
      .schema("core")
      .from("completions")
      .delete()
      .eq("player_id", playerId)
      .eq("game_slug", CHECK_GAME_SLUG)
      .eq("puzzle_date", CHECK_PUZZLE_DATE);
    if (completionDeleteError) {
      throw new Error(`Failed to clean up stage1 legacy completion: ${completionDeleteError.message}`);
    }

    const after = await getGuestCompletionCount(playerId);

    return NextResponse.json({
      ok: true,
      playerId,
      before,
      during,
      after,
      recordedResult: {
        id: result.id,
        gameSlug: result.game_slug,
        puzzleDate: result.puzzle_date,
        isWin: result.is_win,
        guessesUsed: result.guesses_used,
        maxGuesses: result.max_guesses,
      },
    });
  } catch (error) {
    if (recordedResultId) {
      try {
        await getAccountSupabaseAdmin().schema("core").from("game_results").delete().eq("id", recordedResultId);
      } catch {
        // Best effort cleanup for a development-only smoke check.
      }
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, playerId: playerId || null }, { status: 500 });
  }
}
