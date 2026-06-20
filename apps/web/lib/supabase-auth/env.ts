export const getSupabaseAuthUrl = () => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return value;
};

export const getSupabasePublishableKey = () => {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (publishableKey) return publishableKey;

  const legacyAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (legacyAnonKey) return legacyAnonKey;

  throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
};
