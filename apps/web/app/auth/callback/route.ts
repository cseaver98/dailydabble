import { claimGuestResultsForUser, getAccountSupabaseAdmin } from "@/lib/account-results";
import { getExistingPlayerId } from "@/lib/player-id";
import { createSupabaseServerClient } from "@/lib/supabase-auth/server";
import { NextRequest, NextResponse } from "next/server";

const safeNextPath = (value: string | null) => {
  if (!value || !value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
};

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const redirectUrl = new URL(next, requestUrl.origin);

  if (!code) {
    redirectUrl.searchParams.set("auth_error", "missing_code");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    redirectUrl.searchParams.set("auth_error", "callback_failed");
    return NextResponse.redirect(redirectUrl);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const admin = getAccountSupabaseAdmin();
    const { error: profileError } = await admin
      .schema("core")
      .from("profiles")
      .upsert(
        {
          id: user.id,
          display_name: user.user_metadata?.full_name || user.email?.split("@")[0] || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (profileError) {
      redirectUrl.searchParams.set("auth_warning", "profile_sync_failed");
    }

    const playerId = await getExistingPlayerId();
    if (playerId) {
      try {
        await claimGuestResultsForUser({ playerId, userId: user.id });
      } catch (claimError) {
        console.warn(claimError instanceof Error ? claimError.message : "Failed to claim guest results");
        redirectUrl.searchParams.set("auth_warning", "guest_claim_failed");
      }
    }
  }

  return NextResponse.redirect(redirectUrl);
}
