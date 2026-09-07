import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

// Service-role client — ONLY for use inside route handlers (app/api/*).
// It bypasses RLS, so it must never be imported into a client component.
//
// Nothing in the current event list needs it: published events are readable by
// any signed-in user through RLS. It exists for the writes and the
// entitlement-style checks that come later (Bunny upload tickets, admin
// mutations, contest submissions).
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function getSupabaseServiceClient(): SupabaseClient {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to events/.env.local",
    );
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Anon client for verifying a caller's access token server-side (getUser).
export function getSupabaseAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
