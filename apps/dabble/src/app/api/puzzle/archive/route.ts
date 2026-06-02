import { NextResponse } from "next/server";
import { listDabbleArchive } from "../../../../lib/puzzle-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const items = await listDabbleArchive(120);
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load archive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
