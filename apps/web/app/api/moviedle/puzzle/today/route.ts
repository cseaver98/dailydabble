import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Moviedle no longer publishes a daily puzzle.",
      archiveUrl: "/moviedle/archive",
    },
    { status: 410 },
  );
}
