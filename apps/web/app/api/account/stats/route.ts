import { getAccountStats } from "@/lib/account-stats";
import { createSupabaseServerClient } from "@/lib/supabase-auth/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Sign in to view account stats." }, { status: 401 });
    }

    const stats = await getAccountStats(user.id);
    return NextResponse.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load account stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
