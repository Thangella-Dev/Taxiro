import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
      global: {
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
          if (response.status === 400 && url.includes("/auth/v1/token?grant_type=refresh_token")) {
            queueMicrotask(() => {
              void browserClient?.auth.signOut({ scope: "local" });
            });
          }
          return response;
        },
      },
    });
  }

  return browserClient;
}
