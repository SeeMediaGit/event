"use client";

import { getSupabaseBrowserClient } from "../../supabase/client";
import type { FilmFields } from "./form";
import type { ChallengeFilm, ClientWritableFilmStatus } from "./types";

// Every column the UI reads, named explicitly rather than select("*") — the
// same rule EVENT_COLUMNS and APPLICATION_COLUMNS follow. `authenticated` holds
// a SELECT grant on the whole table, so the organiser's columns (reviewed_by,
// reviewed_at, review_note) would come along with a star; they are left off
// because no screen shows them and a review note is not the entrant's to read.
const FILM_COLUMNS = [
  "id",
  "application_id",
  "event_id",
  "status",
  "poster_url",
  "horizontal_poster_url",
  "title",
  "director",
  "actors",
  "producer",
  "synopsis",
  "release_year",
  "studio",
  "age_rating",
  "genre",
  "genre_other",
  "duration_minutes",
  "trailer_url",
  "film_url",
  "film_path",
  "film_video_id",
  "film_status",
  "film_uploaded_at",
  "submitted_at",
  "created_at",
  "updated_at",
].join(", ");

export type FilmsResult =
  | { ok: true; films: ChallengeFilm[] }
  | { ok: false; message: string };

export type FilmResult =
  | { ok: true; film: ChallengeFilm }
  | { ok: false; message: string };

export type DeleteResult = { ok: true } | { ok: false; message: string };

// PostgREST error codes, translated for the person looking at the form. The raw
// message ("new row violates row-level security policy…") is accurate and
// completely useless to an entrant, so it goes to the console instead.
function filmErrorMessage(code: string | undefined): string {
  switch (code) {
    case "42501":
      // A column outside the grant, or a status the policy refuses.
      return "Кино хадгалах эрх алга. Дахин нэвтэрч орно уу.";
    case "23514":
      return "Оруулсан утга буруу байна. Талбаруудаа шалгана уу.";
    case "42703":
      // undefined_column: the live schema is behind the code.
      return "Өгөгдлийн сангийн бүтэц кодтой таарахгүй байна. Хүлээгдэж буй миграцийг ажиллуулна уу.";
    case "PGRST301":
      return "Нэвтрэлт дууссан байна. Дахин нэвтэрч орно уу.";
    default:
      // The insert policy refuses a row whose application is unpaid or whose
      // submission window has closed, and PostgREST reports both as a plain
      // policy violation with no code of their own. Naming the two real causes
      // beats "something went wrong".
      return "Кино нэмэгдсэнгүй. Төлбөр төлөгдсөн эсэх, бүтээл хүлээн авах хугацаа дууссан эсэхийг шалгана уу.";
  }
}

// Every film under one application, oldest first — entrants think of their
// entries in the order they added them, and a list that reshuffles when a row
// is edited is disorienting.
//
// RLS scopes the table to the caller's own applications, so there is no user
// filter here and no way for this list to widen.
export async function fetchMyFilms(
  applicationId: string,
): Promise<FilmsResult> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("challenge_films")
    .select(FILM_COLUMNS)
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(`fetchMyFilms(${applicationId}) error:`, error);
    return { ok: false, message: filmErrorMessage(error.code) };
  }

  return { ok: true, films: (data as unknown as ChallengeFilm[]) ?? [] };
}

// Create the row. Note what is NOT sent:
//
//   film_url, film_path, film_video_id, film_status, film_uploaded_at
//                    — no column grant; the upload route writes them under the
//                      service role.
//   reviewed_*       — organiser's.
//
// PostgREST rejects the ENTIRE request with 42501 if any ungranted column
// appears, so one stray key breaks the whole save, not just that field.
export async function createFilm(
  applicationId: string,
  eventId: string,
  fields: FilmFields,
  status: ClientWritableFilmStatus,
): Promise<FilmResult> {
  const supabase = getSupabaseBrowserClient();

  const payload: Record<string, unknown> = {
    ...fields,
    application_id: applicationId,
    event_id: eventId,
    status,
  };
  if (status === "submitted") payload.submitted_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("challenge_films")
    .insert(payload)
    .select(FILM_COLUMNS)
    .single();

  if (error) {
    console.error("createFilm error:", error);
    return { ok: false, message: filmErrorMessage(error.code) };
  }
  return { ok: true, film: data as unknown as ChallengeFilm };
}

// Update the row. `application_id` and `event_id` are absent on purpose: unlike
// the INSERT grant, the UPDATE grant does not cover them, so a film cannot be
// moved to another entrant or another competition.
export async function updateFilm(
  filmId: string,
  fields: FilmFields,
  status: ClientWritableFilmStatus,
): Promise<FilmResult> {
  const supabase = getSupabaseBrowserClient();

  const payload: Record<string, unknown> = { ...fields, status };
  if (status === "submitted") payload.submitted_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("challenge_films")
    .update(payload)
    .eq("id", filmId)
    .select(FILM_COLUMNS)
    .single();

  if (error) {
    console.error(`updateFilm(${filmId}) error:`, error);
    return { ok: false, message: filmErrorMessage(error.code) };
  }
  return { ok: true, film: data as unknown as ChallengeFilm };
}

export function saveFilm(
  applicationId: string,
  eventId: string,
  existing: ChallengeFilm | null,
  fields: FilmFields,
  status: ClientWritableFilmStatus,
): Promise<FilmResult> {
  return existing
    ? updateFilm(existing.id, fields, status)
    : createFilm(applicationId, eventId, fields, status);
}

// Only a draft can go. The delete policy enforces it; this is the friendly half.
export async function deleteFilm(filmId: string): Promise<DeleteResult> {
  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase
    .from("challenge_films")
    .delete()
    .eq("id", filmId);

  if (error) {
    console.error(`deleteFilm(${filmId}) error:`, error);
    return {
      ok: false,
      message: "Устгаж чадсангүй. Зөвхөн ноорог киног устгах боломжтой.",
    };
  }
  return { ok: true };
}

// Re-read one row after the upload route has written to it under the service
// role. Reading back is also what proves the write landed — patching a guess
// into local state would show a film as delivered that is not.
export async function refetchFilm(filmId: string): Promise<FilmResult> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("challenge_films")
    .select(FILM_COLUMNS)
    .eq("id", filmId)
    .single();

  if (error) {
    console.error(`refetchFilm(${filmId}) error:`, error);
    return { ok: false, message: filmErrorMessage(error.code) };
  }
  return { ok: true, film: data as unknown as ChallengeFilm };
}
