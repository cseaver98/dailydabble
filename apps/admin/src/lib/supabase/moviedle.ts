import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerKey, getSupabaseUrl } from "@/lib/supabase/env";

export const getMoviedleSupabaseAdmin = () => {
  const supabaseUrl = getSupabaseUrl();
  const supabaseServerKey = getSupabaseServerKey();

  return createClient(supabaseUrl, supabaseServerKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: "moviedle",
    },
  });
};
