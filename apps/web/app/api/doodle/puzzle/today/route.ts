import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Doodle no longer publishes a daily puzzle.",
      archiveUrl: "/doodle/archive",
    },
    { status: 410 },
  );
}
