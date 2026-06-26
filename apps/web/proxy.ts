import { NextRequest } from "next/server";

import { enforceStagingAccess } from "./lib/staging-access";
import { refreshSupabaseAuthSession } from "./lib/supabase-auth/proxy";

export async function proxy(request: NextRequest) {
  const stagingResponse = await enforceStagingAccess(request);
  if (stagingResponse) {
    return stagingResponse;
  }

  return refreshSupabaseAuthSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt|sitemap.xml).*)"],
};
