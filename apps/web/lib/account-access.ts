import { getGuestCompletionCount, GUEST_COMPLETION_LIMIT } from "@/lib/account-results";
import { allowedGameSlugs } from "@/lib/games";
import { getOrCreatePlayerId } from "@/lib/player-id";
import { getTodayPuzzleDate } from "@/lib/puzzle-date";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-auth/server";

export type AccountAccess = {
  loggedIn: boolean;
  guestCount: number;
  guestLimit: number;
  locked: boolean;
  completedTodayGame?: boolean;
};

export async function getAccountAccess(gameSlug?: string): Promise<AccountAccess> {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (user) {
    return {
      loggedIn: true,
      guestCount: 0,
      guestLimit: GUEST_COMPLETION_LIMIT,
      locked: false,
      completedTodayGame: false,
    };
  }

  const playerId = await getOrCreatePlayerId();
  const guestStatus = await getGuestCompletionCount(playerId);
  let completedTodayGame = false;

  if (gameSlug && allowedGameSlugs.has(gameSlug)) {
    const { data, error } = await getSupabaseAdmin()
      .schema("core")
      .from("game_results")
      .select("id")
      .eq("player_id", playerId)
      .eq("game_slug", gameSlug)
      .eq("puzzle_date", getTodayPuzzleDate())
      .eq("is_archive", false)
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new Error(`Failed to read today game access: ${error.message}`);
    }

    completedTodayGame = Boolean(data);
  }

  return {
    loggedIn: false,
    guestCount: guestStatus.count,
    guestLimit: guestStatus.limit,
    locked: guestStatus.locked && !completedTodayGame,
    completedTodayGame,
  };
}
