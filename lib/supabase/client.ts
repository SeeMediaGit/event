"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

// Browser-side Supabase client. Session lives in localStorage so a user stays
// logged in across reloads.
//
// NOTE the storageKey: it is deliberately different from landing's
// "seemedia-web-auth". Sessions are per-origin anyway (events.seemedia.mn and
// seemedia.mn are different origins, so they could never share storage), but a
// distinct key means that if the two apps are ever served from one host the
// sessions still will not stomp on each other.
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "seemedia-events-auth",
    },
  });

  return browserClient;
}
