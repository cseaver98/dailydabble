import { games } from "@/lib/games";
import { getOrCreatePlayerId } from "@/lib/player-id";
import { getTodayPuzzleDate } from "@/lib/puzzle-date";
import { createSupabaseServerClient } from "@/lib/supabase-auth/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

type GameResultStatus = "not_started" | "completed_won" | "completed_lost";

type GameResultRow = {
  game_slug: string;
  is_win: boolean;
  guesses_used: number;
  max_guesses: number;
  completed_at: string;
};

type LegacyCompletionRow = {
  game_slug: string;
  completed_at: string;
};

export async function GET() {
  try {
    const today = getTodayPuzzleDate();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      const fallbackStatus = Object.fromEntries(games.map((game) => [game.slug, false]));
      const fallbackGameStatuses = Object.fromEntries(games.map((game) => [game.slug, { status: "not_started" as GameResultStatus }]));
      return NextResponse.json({ date: today, status: fallbackStatus, gameStatuses: fallbackGameStatuses, persisted: false });
    }

    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    const playerId = user ? null : await getOrCreatePlayerId();
    const supabase = getSupabaseAdmin();

    const { data, error } = user
      ? await supabase
        .schema("core")
        .from("game_results")
        .select("game_slug,is_win,guesses_used,max_guesses,completed_at")
        .eq("user_id", user.id)
        .eq("puzzle_date", today)
        .eq("is_archive", false)
        .returns<GameResultRow[]>()
      : await supabase
        .schema("core")
        .from("game_results")
        .select("game_slug,is_win,guesses_used,max_guesses,completed_at")
        .eq("player_id", playerId)
        .is("user_id", null)
        .eq("puzzle_date", today)
        .eq("is_archive", false)
        .returns<GameResultRow[]>();

    if (error) {
      return NextResponse.json(
        { error: "Failed to load completion status", details: error.message },
        { status: 500 },
      );
    }

    let legacyCompletionsByGame = new Map<string, LegacyCompletionRow>();

    if (!user) {
      const { data: legacyData, error: legacyError } = await supabase
        .schema("core")
        .from("completions")
        .select("game_slug,completed_at")
        .eq("player_id", playerId)
        .eq("puzzle_date", today)
        .returns<LegacyCompletionRow[]>();

      if (legacyError) {
        return NextResponse.json(
          { error: "Failed to load legacy completion status", details: legacyError.message },
          { status: 500 },
        );
      }

      legacyCompletionsByGame = new Map((legacyData ?? []).map((row) => [row.game_slug, row]));
    }

    const resultsByGame = new Map((data ?? []).map((row) => [row.game_slug, row]));
    const status = Object.fromEntries(games.map((game) => [game.slug, resultsByGame.has(game.slug) || legacyCompletionsByGame.has(game.slug)]));
    const gameStatuses = Object.fromEntries(
      games.map((game) => {
        const result = resultsByGame.get(game.slug);
        const legacyCompletion = legacyCompletionsByGame.get(game.slug);
        return [
          game.slug,
          result
            ? {
                status: result.is_win ? "completed_won" : "completed_lost",
                isWin: result.is_win,
                guessesUsed: result.guesses_used,
                maxGuesses: result.max_guesses,
                completedAt: result.completed_at,
              }
            : legacyCompletion
              ? {
                  status: "completed_won" as GameResultStatus,
                  completedAt: legacyCompletion.completed_at,
                }
            : { status: "not_started" as GameResultStatus },
        ];
      }),
    );

    return NextResponse.json({ date: today, status, gameStatuses, persisted: true, source: "game_results" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
