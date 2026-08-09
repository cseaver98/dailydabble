import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Sportle no longer publishes a daily puzzle.",
      archiveUrl: "/sportle/archive",
    },
    { status: 410 },
  );
}
