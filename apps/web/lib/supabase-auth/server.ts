import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAuthUrl, getSupabasePublishableKey } from "./env";

export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseAuthUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can read cookies but cannot persist refreshed auth cookies.
          // The proxy refresh path handles those writes for normal page requests.
        }
      },
    },
  });
};
