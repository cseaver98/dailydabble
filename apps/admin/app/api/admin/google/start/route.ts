import { NextRequest } from "next/server";

import { startGoogleAdminOAuth } from "@/lib/google-oauth";

export async function GET(request: NextRequest) {
  return startGoogleAdminOAuth(request);
}
