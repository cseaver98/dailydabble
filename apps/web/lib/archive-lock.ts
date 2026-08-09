import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionAccess, getSubscriptionFeatureFlags } from "@/lib/subscriptions";
import { createSupabaseServerClient } from "@/lib/supabase-auth/server";
import { archiveOnlyGameSlugs } from "@/lib/games";

export const ARCHIVE_UNLOCK_COOKIE = "dailydabble_archive_game_one_unlock";
const ARCHIVE_UNLOCK_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const getArchiveUnlockPassword = (): string => process.env.ARCHIVE_GAME_ONE_PASSWORD?.trim() || "";

export const isArchiveLockEnabled = (gameSlug?: string): boolean =>
  !gameSlug || !archiveOnlyGameSlugs.has(gameSlug)
    ? getArchiveUnlockPassword().length > 0
    : false;

export const isLockedArchiveGameNumber = (archiveGameNumber?: number | null, gameSlug?: string): boolean =>
  isArchiveLockEnabled(gameSlug) && archiveGameNumber === 1;

export const hasArchiveUnlockCookie = (request: Pick<NextRequest, "cookies">): boolean =>
  request.cookies.get(ARCHIVE_UNLOCK_COOKIE)?.value === "1";

export const isArchivePasswordValid = (password: string): boolean =>
  Boolean(password) && password.trim() === getArchiveUnlockPassword();

export const applyArchiveUnlockCookie = (response: NextResponse): NextResponse => {
  response.cookies.set(ARCHIVE_UNLOCK_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ARCHIVE_UNLOCK_MAX_AGE_SECONDS,
  });

  return response;
};

export type ArchivePuzzleLockReason = "secret" | "subscription";

export const createArchiveLockedResponse = (gameLabel: string, date: string) =>
  NextResponse.json(
    {
      locked: true,
      lockTitle: "Archive Game #1 is locked",
      lockDescription: "",
    },
    { status: 423 },
  );

export const createArchiveSubscriptionLockedResponse = (gameLabel: string, date: string) =>
  NextResponse.json(
    {
      locked: true,
      lockMode: "subscription",
      lockTitle: "DailyDabble+",
      lockDescription: "The Verble archive is locked behind DailyDabble+\nDailyDabble+ is coming soon.",
    },
    { status: 423 },
  );

export async function getCurrentArchiveSubscriptionAccess(gameSlug?: string) {
  if (gameSlug && archiveOnlyGameSlugs.has(gameSlug)) {
    return {
      subscriptionsLaunched: false,
      canAccessArchive: true,
      isSubscriber: false,
    };
  }

  const flags = getSubscriptionFeatureFlags();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      subscriptionsLaunched: flags.archiveSubscriptionsEnabled,
      canAccessArchive: false,
      isSubscriber: false,
    };
  }

  const access = await getSubscriptionAccess(user.id);
  return {
    subscriptionsLaunched: access.flags.archiveSubscriptionsEnabled,
    canAccessArchive: access.canAccessArchive,
    isSubscriber: access.isSubscriber,
  };
}

export async function getArchivePuzzleLockState({
  request,
  archiveGameNumber,
  gameSlug,
}: {
  request: Pick<NextRequest, "cookies">;
  archiveGameNumber?: number | null;
  gameSlug?: string;
}) {
  const archiveAccess = await getCurrentArchiveSubscriptionAccess(gameSlug);

  if (archiveAccess.subscriptionsLaunched) {
    return {
      locked: !archiveAccess.canAccessArchive,
      reason: archiveAccess.canAccessArchive ? null : "subscription" as ArchivePuzzleLockReason,
    };
  }

  const locked = isLockedArchiveGameNumber(archiveGameNumber, gameSlug) && !hasArchiveUnlockCookie(request);
  return {
    locked,
    reason: locked ? "secret" as ArchivePuzzleLockReason : null,
  };
}

export async function shouldLockArchivePuzzleRequest({
  request,
  archiveGameNumber,
  gameSlug,
}: {
  request: Pick<NextRequest, "cookies">;
  archiveGameNumber?: number | null;
  gameSlug?: string;
}) {
  const lockState = await getArchivePuzzleLockState({ request, archiveGameNumber, gameSlug });
  return lockState.locked;
}
