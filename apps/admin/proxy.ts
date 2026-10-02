import { NextResponse } from "next/server";

export function proxy() {
  return new NextResponse(null, {
    status: 410,
    headers: { "Cache-Control": "no-store" },
  });
}

export const config = {
  matcher: ["/:path*"],
};
