import { NextRequest, NextResponse } from "next/server";

import { getAdminSessionCookieName, isValidAdminSessionToken } from "@/lib/admin-auth";
import { enforceStagingAccess } from "@/lib/staging-access";

const isLocalDevelopment = (): boolean => process.env.NODE_ENV !== "production";
const isStagingEnvironment = (): boolean => process.env.NEXT_PUBLIC_APP_ENV === "staging";

const isPublicAdminPath = (pathname: string): boolean =>
  pathname === "/admin/login" ||
  pathname === "/api/admin/google/start" ||
  pathname === "/api/admin/google/callback";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const stagingResponse = await enforceStagingAccess(request);
  if (stagingResponse) {
    return stagingResponse;
  }

  if (!pathname.startsWith("/admin/") && !pathname.startsWith("/api/admin/")) {
    return NextResponse.next();
  }

  if (isLocalDevelopment() || isStagingEnvironment()) {
    return NextResponse.next();
  }

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt|sitemap.xml).*)"],
};
