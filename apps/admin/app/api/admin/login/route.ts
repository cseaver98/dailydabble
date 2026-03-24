import { NextResponse } from "next/server";

import {
  createAdminSessionToken,
  getAdminSessionCookieName,
  isValidAdminPassword,
} from "@/lib/admin-auth";

type LoginPayload = {
  password?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as LoginPayload;
  const password = String(payload.password ?? "");

  if (!isValidAdminPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await createAdminSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Admin auth is not configured" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getAdminSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
