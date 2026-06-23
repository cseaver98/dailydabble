import { NextRequest, NextResponse } from "next/server";

import {
  createAdminSessionToken,
  getAdminAuthConfigurationError,
  getAdminSessionCookieName,
  isAllowedAdminEmail,
} from "@/lib/admin-auth";

const OAUTH_STATE_COOKIE = "dd_admin_oauth_state";
const OAUTH_NEXT_COOKIE = "dd_admin_oauth_next";
const OAUTH_COOKIE_TTL_SECONDS = 60 * 10;

type GoogleTokenResponse = {
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  error?: string;
};

const getGoogleClientId = (): string => process.env.GOOGLE_CLIENT_ID ?? "";
const getGoogleClientSecret = (): string => process.env.GOOGLE_CLIENT_SECRET ?? "";

const getRedirectUri = (request: NextRequest): string =>
  new URL("/api/admin/google/callback", request.url).toString();

const getSafeNextPath = (value: string | null): string =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/admin/agegaple";

const randomToken = (): string => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const redirectToLoginError = (request: NextRequest, message: string): NextResponse => {
  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("error", message);
  return NextResponse.redirect(loginUrl);
};

const getOAuthConfigurationError = (): string | null => {
  const adminAuthError = getAdminAuthConfigurationError();
  if (adminAuthError) {
    return adminAuthError;
  }

  if (!getGoogleClientId()) {
    return "GOOGLE_CLIENT_ID is not configured.";
  }

  if (!getGoogleClientSecret()) {
    return "GOOGLE_CLIENT_SECRET is not configured.";
  }

  return null;
};

const clearOAuthCookies = (response: NextResponse): void => {
  for (const cookieName of [OAUTH_STATE_COOKIE, OAUTH_NEXT_COOKIE]) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
};

export const startGoogleAdminOAuth = (request: NextRequest): NextResponse => {
  const clientId = getGoogleClientId();
  const configurationError = getOAuthConfigurationError();

  if (configurationError) {
    return redirectToLoginError(request, configurationError);
  }

  const state = randomToken();
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", getRedirectUri(request));
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid email profile");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authorizationUrl);
  for (const [name, value] of [
    [OAUTH_STATE_COOKIE, state],
    [OAUTH_NEXT_COOKIE, nextPath],
  ]) {
    response.cookies.set(name, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: OAUTH_COOKIE_TTL_SECONDS,
    });
  }
  return response;
};

export const finishGoogleAdminOAuth = async (request: NextRequest): Promise<NextResponse> => {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const configurationError = getOAuthConfigurationError();

  if (configurationError) {
    return redirectToLoginError(request, configurationError);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? "";
  const nextPath = getSafeNextPath(request.cookies.get(OAUTH_NEXT_COOKIE)?.value ?? null);

  if (!code || !state || state !== storedState) {
    return redirectToLoginError(request, "Could not verify Google sign-in.");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(request),
    }),
  });
  const tokenPayload = (await tokenResponse.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokenPayload.id_token) {
    return redirectToLoginError(request, "Google sign-in failed.");
  }

  const tokenInfoResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenPayload.id_token)}`,
  );
  const tokenInfo = (await tokenInfoResponse.json().catch(() => ({}))) as GoogleTokenInfo;
  const email = String(tokenInfo.email ?? "").trim().toLowerCase();
  const emailVerified = tokenInfo.email_verified === true || tokenInfo.email_verified === "true";

  if (!tokenInfoResponse.ok || tokenInfo.aud !== clientId || !emailVerified || !isAllowedAdminEmail(email)) {
    return redirectToLoginError(request, "That Google account is not allowed for admin.");
  }

  const sessionToken = await createAdminSessionToken(email);
  if (!sessionToken) {
    return redirectToLoginError(request, "Admin auth is not configured.");
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  response.cookies.set(getAdminSessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  clearOAuthCookies(response);
  return response;
};
