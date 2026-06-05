import { NextResponse } from "next/server";
import { listEquadleArchive } from "../../../../../lib/equadle/puzzle-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const items = await listEquadleArchive(120);
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load archive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
