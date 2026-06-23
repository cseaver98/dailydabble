import { NextRequest, NextResponse } from "next/server";

import { enforceStagingAccess } from "./lib/staging-access";

export async function proxy(request: NextRequest) {
  return (await enforceStagingAccess(request)) ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt|sitemap.xml).*)"],
};
