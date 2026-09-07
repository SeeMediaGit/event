// Supabase project configuration. Same project as landing/ and mobile/ — the
// events site signs users in against the very same auth.users table, which is
// why an existing SeeMedia app account just works here with no signup step.
//
// The anon key is a public client key (it already ships inside every JS bundle
// and every copy of the mobile app), so it is safe to expose. Values can be
// overridden via env for other stages.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://sxvnidtuspoxcgpzffdo.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4dm5pZHR1c3BveGNncHpmZmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NjAxMjgsImV4cCI6MjEwMTMzNjEyOH0.eboDzARIAnGzcNPINHKP5K1aESIsh-EQMH-WbQ6hdGo";
