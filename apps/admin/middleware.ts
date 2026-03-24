import { NextRequest, NextResponse } from "next/server";

import { getAdminSessionCookieName, isValidAdminSessionToken } from "@/lib/admin-auth";

const isPublicAdminPath = (pathname: string): boolean =>
  pathname === "/admin/login" || pathname === "/api/admin/login";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicAdminPath(pathname)) {
    const token = request.cookies.get(getAdminSessionCookieName())?.value;
    const isAuthed = await isValidAdminSessionToken(token);

    if (isAuthed && pathname === "/admin/login") {
      return NextResponse.redirect(new URL("/admin/agegaple", request.url));
    }

    return NextResponse.next();
  }

  const token = request.cookies.get(getAdminSessionCookieName())?.value;
  const isAuthed = await isValidAdminSessionToken(token);
  if (isAuthed) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
