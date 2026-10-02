import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/email/unsubscribe") {
    return NextResponse.next();
  }

  return new NextResponse(null, {
    status: 410,
    headers: { "Cache-Control": "no-store" },
  });
}

export const config = {
  matcher: ["/:path*"],
};
