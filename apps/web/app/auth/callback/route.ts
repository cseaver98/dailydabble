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
  const marketingEmailOptIn = requestUrl.searchParams.get("marketing_email_opt_in") === "1";
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
    let needsDisplayName = false;
    const { data: existingProfile, error: readProfileError } = await admin
      .schema("core")
      .from("profiles")
      .select("id,display_name")
      .eq("id", user.id)
      .maybeSingle<{ id: string; display_name: string | null }>();

    if (readProfileError) {
      redirectUrl.searchParams.set("auth_warning", "profile_sync_failed");
    } else {
      needsDisplayName = !existingProfile?.display_name;
    }

    const profileWrite = existingProfile
      ? admin
        .schema("core")
        .from("profiles")
        .update({
          avatar_url: user.user_metadata?.avatar_url || null,
          ...(marketingEmailOptIn ? { marketing_email_opt_in: true } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
      : admin
        .schema("core")
        .from("profiles")
        .insert({
          id: user.id,
          display_name: null,
          avatar_url: user.user_metadata?.avatar_url || null,
          marketing_email_opt_in: marketingEmailOptIn,
          updated_at: new Date().toISOString(),
        });

    const { error: profileError } = await profileWrite;

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

    if (needsDisplayName) {
      const welcomeUrl = new URL("/", requestUrl.origin);
      welcomeUrl.searchParams.set("onboarding", "display-name");
      welcomeUrl.searchParams.set("auth_success", "1");
      welcomeUrl.searchParams.set("next", next);
      for (const [key, value] of redirectUrl.searchParams) {
        if (key.startsWith("auth_warning")) {
          welcomeUrl.searchParams.set(key, value);
        }
      }
      return NextResponse.redirect(welcomeUrl);
    }

    redirectUrl.searchParams.set("auth_success", "1");
  }

  return NextResponse.redirect(redirectUrl);
}
