import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAuthUrl, getSupabasePublishableKey } from "./env";

export const createSupabaseBrowserClient = () =>
  createBrowserClient(getSupabaseAuthUrl(), getSupabasePublishableKey());
