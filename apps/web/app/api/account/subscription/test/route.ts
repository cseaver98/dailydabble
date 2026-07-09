import { setTestSubscriptionStatus } from "@/lib/subscriptions";
import { createSupabaseServerClient } from "@/lib/supabase-auth/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const hasTestAccess = (request: NextRequest) => {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const token = process.env.SUBSCRIPTION_TEST_TOKEN;
  return Boolean(token) && request.headers.get("x-subscription-test-token") === token;
};

export async function POST(request: NextRequest) {
  try {
    if (!hasTestAccess(request)) {
      return NextResponse.json({ error: "Subscription test controls are disabled." }, { status: 404 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Sign in to update test subscription status." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { active?: unknown };
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "active must be true or false." }, { status: 400 });
    }

    const subscription = await setTestSubscriptionStatus({
      userId: user.id,
      active: body.active,
    });

    return NextResponse.json({ subscription });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update test subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
