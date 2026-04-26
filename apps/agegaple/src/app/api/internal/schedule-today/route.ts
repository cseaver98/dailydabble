import { NextRequest, NextResponse } from "next/server";

import { getTodayPuzzle } from "@/lib/puzzle-repository";

const isAuthorizedCronRequest = (request: NextRequest): boolean => {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const hasValidBearer = Boolean(cronSecret) && authorization === `Bearer ${cronSecret}`;
  const isVercelCron = request.headers.has("x-vercel-cron");
  return hasValidBearer || isVercelCron;
};

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const puzzle = await getTodayPuzzle();
    return NextResponse.json({ ok: true, scheduled: Boolean(puzzle) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
