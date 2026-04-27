import { NextResponse } from "next/server";
import { assignTodaySportlePuzzleFromQueue } from "../../../../lib/puzzle-repository";

export const runtime = "nodejs";

const isAuthorizedCronRequest = (request) => {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const hasValidBearer = Boolean(cronSecret) && authorization === `Bearer ${cronSecret}`;
  const isVercelCron = request.headers.has("x-vercel-cron");
  return hasValidBearer || isVercelCron;
};

export async function GET(request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const puzzle = await assignTodaySportlePuzzleFromQueue();
    return NextResponse.json({ ok: true, scheduled: Boolean(puzzle) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to schedule today puzzle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
