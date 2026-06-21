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

    const body = (await request.json()) as { displayName?: unknown };
    if (typeof body.displayName !== "string") {
      return NextResponse.json({ error: "Display name is required." }, { status: 400 });
    }

    const profile = await updateProfile({
      userId: user.id,
      displayName: body.displayName,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
