export const getSupabaseUrl = (): string => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return value;
};

export const getSupabaseServerKey = (): string => {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (secretKey) {
    return secretKey;
  }

  const legacyServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (legacyServiceRole) {
    return legacyServiceRole;
  }

  throw new Error("Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)");
};

export const getSupabasePublishableKey = (): string => {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (publishableKey) {
    return publishableKey;
  }

  const legacyAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (legacyAnon) {
    return legacyAnon;
  }

  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)",
  );
};

export const getSupabaseDbSchema = (): string => {
  const value = process.env.SUPABASE_DB_SCHEMA;
  if (!value) {
    return "agegaple";
  }
  return value;
};
