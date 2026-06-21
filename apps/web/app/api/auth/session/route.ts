import { createSupabaseServerClient } from "@/lib/supabase-auth/server";
import { getProfile } from "@/lib/account-profile";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ user: null });
  }

  const profile = await getProfile(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? null,
      displayName: profile?.displayName ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? null,
      avatarUrl: profile?.avatarUrl ?? user.user_metadata?.avatar_url ?? null,
    },
  });
}
