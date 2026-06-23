import { NextRequest } from "next/server";

import { finishGoogleAdminOAuth } from "@/lib/google-oauth";

export async function GET(request: NextRequest) {
  return finishGoogleAdminOAuth(request);
}
