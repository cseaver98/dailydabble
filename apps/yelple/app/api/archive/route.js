import { NextResponse } from "next/server";
import { getArchive } from "@/lib/db";

export async function GET(req) {
  try {
    const limit = Number(new URL(req.url).searchParams.get("limit")) || 30;
    const items = await getArchive(limit);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("/api/archive failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
