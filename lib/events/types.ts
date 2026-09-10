// Shape of one row of public.events. Kept in sync by hand with
// supabase/migrations/20260729_events_schema.sql — the project has no generated
// types and no migration history (schema is applied through the SQL editor),
// so this file is the single source of truth for the app's view of the table.

export type EventStatus = "draft" | "published" | "archived";

// 'event'     → the plain list + detail page that has always existed.
// 'challenge' → the four-step Reel Film Challenge flow at /challenge/[slug].
// Added by supabase/migrations/20260907_challenge_applications.sql; every
// pre-existing row defaulted to 'event'.
export type EventKind = "event" | "challenge";

export type SeeEvent = {
  id: string;
  name: string;
  slug: string | null;
  subtitle: string | null;
  description: string | null;
  poster_url: string | null;
  cover_url: string | null;
  location: string | null;
  status: EventStatus;
  starts_at: string | null;
  ends_at: string | null;
  registration_ends_at: string | null;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;

  // 20260907_challenge_applications.sql. `next_registration_no` is deliberately
  // absent: it is the organiser's counter, bumped by the payment callback under
  // the service role, and nothing in the browser has any use for it — leaving it
  // out of the type keeps it out of EVENT_COLUMNS too.
  kind: EventKind;
  entry_fee: number | null;
  submission_ends_at: string | null;
  rules: string | null;
  show_on_home: boolean;
  registration_prefix: string | null;

  // 20260910_challenge_films_and_payments.sql. NULL = no cap on how many films
  // one entrant may send. Enforced by the UI and the upload route rather than
  // by a policy — counting rows inside RLS would re-scan every film on each
  // insert.
  max_films_per_user: number | null;
};

export function isChallenge(event: SeeEvent): boolean {
  return event.kind === "challenge";
}

// Where a challenge row is linked from. Falls back to the id-based detail page
// when a challenge somehow has no slug, so a missing slug degrades to the old
// page instead of a dead /challenge/null link.
export function eventHref(event: SeeEvent): string {
  if (event.kind === "challenge" && event.slug) {
    return `/challenge/${event.slug}`;
  }
  return `/events/${event.id}`;
}

// Where an event sits in time. Derived from starts_at / ends_at on read rather
// than stored, so no cron job or scheduled function is needed to keep a status
// column honest — the phase is simply always correct.
export type EventPhase = "upcoming" | "ongoing" | "finished" | "undated";

export function getEventPhase(event: SeeEvent, now = new Date()): EventPhase {
  const start = event.starts_at ? new Date(event.starts_at) : null;
  const end = event.ends_at ? new Date(event.ends_at) : null;

  if (!start && !end) return "undated";
  if (end && end < now) return "finished";
  if (start && start > now) return "upcoming";
  return "ongoing";
}

// True while people can still sign up for the competition.
export function isRegistrationOpen(event: SeeEvent, now = new Date()): boolean {
  if (!event.registration_ends_at) return false;
  return new Date(event.registration_ends_at) > now;
}

// True while films can still be handed in. Separate from registration: you sign
// up in August and deliver in October.
export function isSubmissionOpen(event: SeeEvent, now = new Date()): boolean {
  if (!event.submission_ends_at) return true;
  return new Date(event.submission_ends_at) > now;
}

// `rules` is stored as a small markdown-ish blob typed into the SQL editor by
// hand. Rather than pull in a markdown renderer (and the XSS surface that comes
// with rendering hand-entered content as HTML), the UI only needs the bullets,
// so strip one leading marker per line and hand back plain strings.
export function parseRules(rules: string | null): string[] {
  if (!rules) return [];
  return rules
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0);
}
