import { allowedGameSlugs } from "@/lib/games";
import { getOrCreatePlayerId } from "@/lib/player-id";
import { createSupabaseServerClient } from "@/lib/supabase-auth/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

type ResultRow = {
  game_slug: string;
  puzzle_id: string;
  puzzle_date: string;
  is_archive: boolean;
  is_win: boolean;
  guesses_used: number;
  max_guesses: number;
  result_payload: Record<string, unknown>;
  completed_at: string;
};

export async function GET(request: NextRequest) {
  try {
    const gameSlug = request.nextUrl.searchParams.get("gameSlug");
    const puzzleId = request.nextUrl.searchParams.get("puzzleId");
    const puzzleDate = request.nextUrl.searchParams.get("puzzleDate");
    const isArchive = request.nextUrl.searchParams.get("isArchive") === "true";

    if (!gameSlug || !allowedGameSlugs.has(gameSlug) || !puzzleId || !puzzleDate) {
      return NextResponse.json({ error: "Invalid result lookup" }, { status: 400 });
    }

    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    const playerId = user ? null : await getOrCreatePlayerId();
    const supabase = getSupabaseAdmin();

    const query = supabase
      .schema("core")
      .from("game_results")
      .select("game_slug,puzzle_id,puzzle_date,is_archive,is_win,guesses_used,max_guesses,result_payload,completed_at")
      .eq("game_slug", gameSlug)
      .eq("puzzle_id", puzzleId)
      .eq("puzzle_date", puzzleDate)
      .eq("is_archive", isArchive);

    const { data, error } = user
      ? await query.eq("user_id", user.id).maybeSingle<ResultRow>()
      : await query.eq("player_id", playerId).is("user_id", null).maybeSingle<ResultRow>();

    if (error) {
      return NextResponse.json({ error: "Failed to load result", details: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ result: null });
    }

    return NextResponse.json({
      result: {
        gameSlug: data.game_slug,
        puzzleId: data.puzzle_id,
        puzzleDate: data.puzzle_date,
        isArchive: data.is_archive,
        isWin: data.is_win,
        guessesUsed: data.guesses_used,
        maxGuesses: data.max_guesses,
        resultPayload: data.result_payload ?? {},
        completedAt: data.completed_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
