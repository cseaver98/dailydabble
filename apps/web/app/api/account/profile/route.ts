import { getProfile, updateProfile } from "@/lib/account-profile";
import { createSupabaseServerClient } from "@/lib/supabase-auth/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Sign in to view your profile." }, { status: 401 });
    }

    const profile = await getProfile(user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });
    }

    const body = (await request.json()) as {
      displayName?: unknown;
      marketingEmailOptIn?: unknown;
      dailyReminderOptIn?: unknown;
      markDailyReminderPrompted?: unknown;
    };
    const hasDisplayName = typeof body.displayName === "string";
    const hasMarketingPreference = typeof body.marketingEmailOptIn === "boolean";
    const hasDailyReminderPreference = typeof body.dailyReminderOptIn === "boolean";
    const shouldMarkDailyReminderPrompted = body.markDailyReminderPrompted === true;

    if (!hasDisplayName && !hasMarketingPreference && !hasDailyReminderPreference && !shouldMarkDailyReminderPrompted) {
      return NextResponse.json({ error: "No profile updates provided." }, { status: 400 });
    }

    const profile = await updateProfile({
      userId: user.id,
      ...(hasDisplayName ? { displayName: body.displayName as string } : {}),
      avatarUrl: user.user_metadata?.avatar_url ?? null,
      ...(hasMarketingPreference ? { marketingEmailOptIn: body.marketingEmailOptIn as boolean } : {}),
      ...(hasDailyReminderPreference ? { dailyReminderOptIn: body.dailyReminderOptIn as boolean } : {}),
      ...(shouldMarkDailyReminderPrompted ? { markDailyReminderPrompted: true } : {}),
    });

    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
