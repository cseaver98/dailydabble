import { getAccountAccess } from "@/lib/account-access";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const gameSlug = request.nextUrl.searchParams.get("gameSlug") ?? undefined;
    const access = await getAccountAccess(gameSlug);
    return NextResponse.json(access);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load account access";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
