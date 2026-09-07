"use client";

import { getSupabaseBrowserClient } from "../supabase/client";
import type { SeeEvent } from "../events/types";
import type { ApplicationFields } from "./form";
import type {
  ApplicationStatus,
  ChallengeApplication,
  ClientWritableStatus,
} from "./types";

// Every column the UI reads, named explicitly rather than select("*") — the
// same rule EVENT_COLUMNS follows in lib/events/api.ts. `authenticated` holds a
// SELECT grant on the whole table, so the organiser-only columns (reviewed_by,
// reviewed_at, review_note) would come along with a star; they are left off
// here because no screen shows them and a review note is not the applicant's
// to read.
const APPLICATION_COLUMNS = [
  "id",
  "event_id",
  "user_id",
  "status",
  "registration_no",
  "submitted_at",
  "paid_at",
  "full_name",
  "age",
  "gender",
  "phone",
  "email",
  "social_url",
  "city",
  "participation",
  "team_name",
  "team_leader",
  "team_size",
  "film_title",
  "film_genre",
  "film_genre_other",
  "film_synopsis",
  "shot_with",
  "edit_software",
  "edit_software_other",
  "has_prior_films",
  "prior_films_note",
  "film_file_url",
  "film_file_path",
  "film_uploaded_at",
  "created_at",
  "updated_at",
].join(", ");

export type SaveResult =
  | { ok: true; application: ChallengeApplication }
  | { ok: false; message: string };

// PostgREST error codes, translated for the person who is looking at the form.
// The raw message ("new row violates row-level security policy…") is accurate
// and completely useless to an applicant, so it goes to the console instead.
function saveErrorMessage(code: string | undefined): string {
  switch (code) {
    case "23505":
      // unique (event_id, user_id) — a second tab already created the row.
      return "Та энэ уралдаанд аль хэдийн бүртгүүлсэн байна. Хуудсаа сэргээнэ үү.";
    case "42501":
      // A column outside the grant, or a status the policy refuses.
      return "Анкетыг хадгалах эрх алга. Дахин нэвтэрч орно уу.";
    case "23514":
      return "Оруулсан утга буруу байна. Талбаруудаа шалгана уу.";
    case "PGRST301":
      return "Нэвтрэлт дууссан байна. Дахин нэвтэрч орно уу.";
    default:
      return "Анкет хадгалагдсангүй. Интернэтээ шалгаад дахин оролдоно уу.";
  }
}

// The signed-in user's application for one challenge. RLS already restricts the
// table to auth.uid() = user_id, so no user filter is needed here — and adding
// one would be a second place to get wrong.
export async function fetchMyApplication(
  eventId: string,
): Promise<ChallengeApplication | null> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("challenge_applications")
    .select(APPLICATION_COLUMNS)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error(`fetchMyApplication(${eventId}) error:`, error);
    return null;
  }
  return (data as unknown as ChallengeApplication) ?? null;
}

// Create the row. Note what is NOT sent:
//
//   user_id          — column default is auth.uid(); sending it from the client
//                      only creates a way to send the wrong one.
//   registration_no  — organiser's, assigned when payment lands.
//   paid_at, reviewed_by, reviewed_at, review_note, created_at, updated_at
//                    — no column grant. PostgREST rejects the ENTIRE request
//                      with 42501 if any of them appears, so one stray key
//                      breaks the whole save, not just that field.
export async function createApplication(
  eventId: string,
  fields: ApplicationFields,
  status: ClientWritableStatus,
): Promise<SaveResult> {
  const supabase = getSupabaseBrowserClient();

  const payload: Record<string, unknown> = {
    ...fields,
    event_id: eventId,
    status,
  };
  if (status === "submitted") payload.submitted_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("challenge_applications")
    .insert(payload)
    .select(APPLICATION_COLUMNS)
    .single();

  if (error) {
    console.error("createApplication error:", error);
    return { ok: false, message: saveErrorMessage(error.code) };
  }
  return { ok: true, application: data as unknown as ChallengeApplication };
}

// Update the row. `event_id` is absent on purpose: unlike the INSERT grant, the
// UPDATE grant in 20260907_challenge_applications.sql does not cover it, and
// an application never changes which competition it belongs to anyway.
export async function updateApplication(
  applicationId: string,
  fields: ApplicationFields,
  status: ClientWritableStatus,
): Promise<SaveResult> {
  const supabase = getSupabaseBrowserClient();

  const payload: Record<string, unknown> = { ...fields, status };
  if (status === "submitted") payload.submitted_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("challenge_applications")
    .update(payload)
    .eq("id", applicationId)
    .select(APPLICATION_COLUMNS)
    .single();

  if (error) {
    console.error(`updateApplication(${applicationId}) error:`, error);
    return { ok: false, message: saveErrorMessage(error.code) };
  }
  return { ok: true, application: data as unknown as ChallengeApplication };
}

export function saveApplication(
  eventId: string,
  existing: ChallengeApplication | null,
  fields: ApplicationFields,
  status: ClientWritableStatus,
): Promise<SaveResult> {
  return existing
    ? updateApplication(existing.id, fields, status)
    : createApplication(eventId, fields, status);
}

// ---------------------------------------------------------------------------
// "Миний өргөдөл" list
// ---------------------------------------------------------------------------

export type ApplicationSummary = {
  id: string;
  event_id: string;
  status: ApplicationStatus;
  registration_no: string | null;
  submitted_at: string | null;
  updated_at: string;
  event: Pick<SeeEvent, "id" | "name" | "slug" | "poster_url" | "kind"> | null;
};

// Two round trips rather than one PostgREST embed. The embed would work, but it
// forces the event's column list to be written a second time inside a string
// where EVENT_COLUMNS cannot be reused, which is exactly the drift that the
// no-select("*") rule exists to prevent.
export async function fetchMyApplications(): Promise<ApplicationSummary[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("challenge_applications")
    .select(
      "id, event_id, status, registration_no, submitted_at, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("fetchMyApplications error:", error);
    return [];
  }

  const rows = (data ?? []) as unknown as Omit<ApplicationSummary, "event">[];
  if (rows.length === 0) return [];

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, name, slug, poster_url, kind")
    .in("id", rows.map((row) => row.event_id));

  if (eventsError) console.error("fetchMyApplications events error:", eventsError);

  const byId = new Map(
    ((events ?? []) as unknown as ApplicationSummary["event"][]).map((e) => [
      e!.id,
      e,
    ]),
  );

  return rows.map((row) => ({ ...row, event: byId.get(row.event_id) ?? null }));
}
