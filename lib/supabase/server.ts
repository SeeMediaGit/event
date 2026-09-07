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
// Both spellings are accepted, exactly as see_media_admin/lib/supabaseAdmin.ts
// does it: the admin project's own .env ships the key under the NEXT_PUBLIC_
// name, and these two projects are meant to share one env block verbatim.
//
// The prefix does NOT leak it. Next inlines a NEXT_PUBLIC_ variable only where
// the code that references it is bundled for the browser, and this file is
// `import "server-only"` — importing it from a client component fails the
// build rather than shipping the key.
const SERVICE_ROLE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ??
  ""
).trim();

export function getSupabaseServiceClient(): SupabaseClient {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) is not set. Copy it from see_media_admin/.env into events/.env",
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
