import { NextRequest, NextResponse } from "next/server";

const STAGING_ACCESS_COOKIE = "dd_staging_access";
const STAGING_ACCESS_TTL_SECONDS = 60 * 60 * 24 * 7;

const isStagingEnvironment = (): boolean => process.env.NEXT_PUBLIC_APP_ENV === "staging";

const base64UrlEncodeBytes = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

const createStagingAccessToken = async (password: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("dailydabble-staging-access"));
  return base64UrlEncodeBytes(new Uint8Array(signature));
};

const renderStagingAccessForm = (error?: string): NextResponse =>
  new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>DailyDabble Staging</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f3e9; color: #2c2f31; font-family: ui-sans-serif, system-ui, sans-serif; }
      main { width: min(420px, calc(100vw - 32px)); border: 1px solid #d8d1bf; border-radius: 28px; background: #fffaf0; padding: 28px; box-shadow: 0 24px 70px rgba(44, 47, 49, 0.16); }
      h1 { margin: 0 0 8px; font-size: 28px; line-height: 1; }
      p { margin: 0 0 20px; color: #5d625f; line-height: 1.45; }
      label { display: grid; gap: 8px; font-weight: 800; }
      input { border: 1px solid #cfc7b6; border-radius: 14px; font: inherit; padding: 12px 14px; }
      button { margin-top: 14px; width: 100%; border: 0; border-radius: 999px; background: #3f7f3a; color: white; cursor: pointer; font: inherit; font-weight: 900; padding: 12px 16px; }
      .error { color: #a33a2b; font-weight: 800; }
    </style>
  </head>
  <body>
    <main>
      <h1>Private staging</h1>
      <p>Enter the staging password to continue.</p>
      ${error ? `<p class="error">${error}</p>` : ""}
      <form method="post">
        <label>
          Password
          <input name="password" type="password" autocomplete="current-password" autofocus />
        </label>
        <button type="submit">Continue</button>
      </form>
    </main>
  </body>
</html>`,
    {
      status: 401,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-robots-tag": "noindex, nofollow",
      },
    },
  );

export const enforceStagingAccess = async (request: NextRequest): Promise<NextResponse | null> => {
  if (!isStagingEnvironment()) {
    return null;
  }

  const stagingPassword = process.env.STAGING_ACCESS_PASSWORD ?? "";
  if (!stagingPassword) {
    return new NextResponse("Staging access is not configured.", {
      status: 503,
      headers: { "x-robots-tag": "noindex, nofollow" },
    });
  }

  const expectedToken = await createStagingAccessToken(stagingPassword);
  const givenToken = request.cookies.get(STAGING_ACCESS_COOKIE)?.value ?? "";
  if (givenToken && constantTimeEqual(givenToken, expectedToken)) {
    return null;
  }

  if (request.method === "POST") {
    const formData = await request.formData().catch(() => null);
    const password = String(formData?.get("password") ?? "");
    if (constantTimeEqual(password, stagingPassword)) {
      const redirectUrl = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, request.url);
      const response = NextResponse.redirect(redirectUrl, { status: 303 });
      response.cookies.set(STAGING_ACCESS_COOKIE, expectedToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: STAGING_ACCESS_TTL_SECONDS,
      });
      return response;
    }

    return renderStagingAccessForm("That password did not match.");
  }

  return renderStagingAccessForm();
};
