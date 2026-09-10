// Supabase project configuration. Same project as landing/, mobile/ and
// see_media_admin/ — the events site signs users in against the very same
// auth.users table, which is why an existing SeeMedia app account just works
// here with no signup step.
//
// The variable NAMES are deliberately identical to see_media_admin/.env, so one
// set of values can be pasted into every project's env without renaming
// anything. `PUBLISHABLE_DEFAULT_KEY` is Supabase's current name for what used
// to be called the anon key; it is a public client key (it ships inside every
// JS bundle and every copy of the mobile app), so it is safe to expose.
//
// Nothing is hardcoded as a fallback any more. A wrong-but-present default is
// worse than a missing one: it fails at runtime with an empty result set that
// looks like "no data" instead of failing at boot with a message that names the
// variable to fix.

function required(value: string | undefined, name: string): string {
  // Trim first: a .env line written as `KEY=` yields an empty string, not
  // undefined, so `??` would happily hand back "" and Supabase would throw the
  // far less helpful "supabaseKey is required".
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(
      `${name} is not set. Copy it from see_media_admin/.env into events/.env`,
    );
  }
  return trimmed;
}

// Written out in full, never process.env[name]: Next inlines NEXT_PUBLIC_* by
// literal text substitution at build time, so a computed key would simply be
// undefined in the browser bundle.
export const SUPABASE_URL = required(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL",
);

export const SUPABASE_ANON_KEY = required(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
);

// Edge functions live under the same project host. The challenge fee's QPay
// invoice is created and confirmed there rather than in a Next route, so that
// the mobile app can call exactly the same two functions — one implementation,
// two clients.
export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
