import { createClient } from "@supabase/supabase-js";

const getSupabaseUrl = (): string => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return value;
};

const getSupabaseServerKey = (): string => {
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

export const getVerbleSupabaseAdmin = () => {
  return createClient(getSupabaseUrl(), getSupabaseServerKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: "verble",
    },
  });
};
