import { getGuestCompletionCount, GUEST_COMPLETION_LIMIT, hasGuestTodayCompletion } from "@/lib/account-results";
import { allowedGameSlugs } from "@/lib/games";
import { getExistingPlayerId } from "@/lib/player-id";
import { getTodayPuzzleDate } from "@/lib/puzzle-date";
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

  const playerId = await getExistingPlayerId();
  if (!playerId) {
    return {
      loggedIn: false,
      guestCount: 0,
      guestLimit: GUEST_COMPLETION_LIMIT,
      locked: false,
      completedTodayGame: false,
    };
  }

  const guestStatus = await getGuestCompletionCount(playerId);
  let completedTodayGame = false;

  if (gameSlug && allowedGameSlugs.has(gameSlug)) {
    completedTodayGame = await hasGuestTodayCompletion({
      playerId,
      gameSlug,
      puzzleDate: getTodayPuzzleDate(),
    });
  }

  return {
    loggedIn: false,
    guestCount: guestStatus.count,
    guestLimit: guestStatus.limit,
    locked: guestStatus.locked && !completedTodayGame,
    completedTodayGame,
  };
}
