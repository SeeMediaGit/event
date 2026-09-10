"use client";

import { getSupabaseBrowserClient } from "../supabase/client";
import type { SeeEvent } from "./types";

// Every column the UI needs. Listed explicitly rather than `select("*")` so
// that a column added later for internal use (an admin note, a Bunny video id,
// an unpublished playback URL) does not silently start shipping to browsers —
// the same discipline as MOVIE_COLUMNS in landing/lib/watch/api.ts.
const EVENT_COLUMNS = [
  "id",
  "name",
  "slug",
  "subtitle",
  "description",
  "poster_url",
  "cover_url",
  "location",
  "status",
  "starts_at",
  "ends_at",
  "registration_ends_at",
  "is_featured",
  "sort_order",
  "created_at",
  "updated_at",
  // 20260907_challenge_applications.sql. `next_registration_no` stays off this
  // list on purpose — it is the organiser's counter and no page reads it.
  "kind",
  "entry_fee",
  "submission_ends_at",
  "rules",
  "show_on_home",
  "registration_prefix",
  // 20260910_challenge_films_and_payments.sql
  "max_films_per_user",
].join(", ");

// RLS on public.events already restricts reads to status = 'published' for
// authenticated users, so the filter below is defence in depth, not the gate.
export async function fetchEvents(): Promise<SeeEvent[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("starts_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchEvents error:", error);
    return [];
  }
  return (data as unknown as SeeEvent[]) ?? [];
}

// The challenge intro step renders for signed-out visitors, so this read has to
// survive an anon key. It does exactly when
// supabase/migrations/20260908_events_anon_challenge_read.sql has been applied;
// until then PostgREST answers with an empty set and the caller shows its "sign
// in to view" card rather than an error.
export async function fetchChallengeBySlug(
  slug: string,
): Promise<SeeEvent | null> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .eq("kind", "challenge")
    .maybeSingle();

  if (error) {
    console.error(`fetchChallengeBySlug(${slug}) error:`, error);
    return null;
  }
  return (data as unknown as SeeEvent) ?? null;
}

export async function fetchEventById(id: string): Promise<SeeEvent | null> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error(`fetchEventById(${id}) error:`, error);
    return null;
  }
  return (data as unknown as SeeEvent) ?? null;
}
