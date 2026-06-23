import { cookies } from "next/headers";
import { randomUUID } from "crypto";

export const PLAYER_COOKIE_NAME = "dailydabble_player_id";

function cookieDomain() {
  return process.env.NODE_ENV === "production" ? ".dailydabble.app" : undefined;
}

function playerCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    domain: cookieDomain(),
    maxAge: 60 * 60 * 24 * 365 * 5,
  };
}

export async function getOrCreatePlayerId() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(PLAYER_COOKIE_NAME)?.value;
  if (existing) {
    return existing;
  }

  const created = randomUUID();
  cookieStore.set(PLAYER_COOKIE_NAME, created, playerCookieOptions());
  return created;
}

export async function getExistingPlayerId() {
  const cookieStore = await cookies();
  return cookieStore.get(PLAYER_COOKIE_NAME)?.value ?? null;
}

export async function resetPlayerId() {
  const cookieStore = await cookies();
  const created = randomUUID();
  cookieStore.set(PLAYER_COOKIE_NAME, created, playerCookieOptions());
  return created;
}
