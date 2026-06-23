import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await request.body?.cancel();
  return NextResponse.json({ error: "Admin password login has been replaced by Google OAuth." }, { status: 410 });
}
