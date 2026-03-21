const ADMIN_SESSION_COOKIE = "agegaple_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = {
  sub: "admin";
  exp: number;
};

const base64UrlEncode = (input: string): string =>
  btoa(input).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

const base64UrlDecode = (input: string): string => {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(`${normalized}${padding}`);
};

const base64UrlEncodeBytes = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return base64UrlEncode(binary);
};

const base64UrlDecodeBytes = (encoded: string): Uint8Array => {
  const decoded = base64UrlDecode(encoded);
  const output = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) {
    output[i] = decoded.charCodeAt(i);
  }
  return output;
};

const constantTimeEqualBytes = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
};

const hmacSha256 = async (value: string, secret: string): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return new Uint8Array(signature);
};

const getAdminPassword = (): string => process.env.ADMIN_PASSWORD ?? "";
const getAdminAuthSecret = (): string => process.env.ADMIN_AUTH_SECRET ?? "";

const constantTimeEqualStrings = (a: string, b: string): boolean =>
  constantTimeEqualBytes(new TextEncoder().encode(a), new TextEncoder().encode(b));

export const getAdminSessionCookieName = (): string => ADMIN_SESSION_COOKIE;

export const isValidAdminPassword = (password: string): boolean => {
  const expected = getAdminPassword();
  if (!expected) {
    return false;
  }
  return constantTimeEqualStrings(password, expected);
};

export const createAdminSessionToken = async (): Promise<string | null> => {
  const secret = getAdminAuthSecret();
  if (!secret) {
    return null;
  }

  const payload: SessionPayload = {
    sub: "admin",
    exp: Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000,
  };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSha256(payloadPart, secret);
  const signaturePart = base64UrlEncodeBytes(signature);
  return `${payloadPart}.${signaturePart}`;
};

export const isValidAdminSessionToken = async (token: string | undefined): Promise<boolean> => {
  if (!token) {
    return false;
  }

  const secret = getAdminAuthSecret();
  if (!secret) {
    return false;
  }

  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) {
    return false;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadPart)) as SessionPayload;
  } catch {
    return false;
  }

  if (payload.sub !== "admin" || typeof payload.exp !== "number" || payload.exp <= Date.now()) {
    return false;
  }

  const expectedSignature = await hmacSha256(payloadPart, secret);
  let givenSignature: Uint8Array;
  try {
    givenSignature = base64UrlDecodeBytes(signaturePart);
  } catch {
    return false;
  }

  return constantTimeEqualBytes(givenSignature, expectedSignature);
};
