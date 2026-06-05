import { createClient } from "@supabase/supabase-js";
import { getSupabaseDbSchema, getSupabaseServerKey, getSupabaseUrl } from "@/lib/agegaple/supabase/env";

export const getSupabaseAdmin = () => {
  const supabaseUrl = getSupabaseUrl();
  const supabaseServerKey = getSupabaseServerKey();
  const supabaseDbSchema = getSupabaseDbSchema();

  return createClient(supabaseUrl, supabaseServerKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: supabaseDbSchema,
    },
  });
};
