// Shape of one row of public.challenge_films. Kept in sync by hand with
// supabase/migrations/20260910_challenge_films_and_payments.sql — this project
// has no generated types and no migration history (schema is applied through
// the SQL editor), so the same discipline as lib/challenge/types.ts applies:
// change the table, change this file in the same commit.
//
// WHY THIS TABLE EXISTS: until 20260910 a film lived inside the application
// row, which `unique (event_id, user_id)` limited to one per person. The
// application is now the *entrant* (one registration number, one fee) and each
// film hangs off it.

// Every value the CHECK constraint allows.
export type FilmStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected";

// What the browser may write. The RLS policy's WITH CHECK rejects anything
// else, so narrowing here turns a runtime 403 into a compile error — the same
// trick ClientWritableStatus plays for applications.
export type ClientWritableFilmStatus = Extract<
  FilmStatus,
  "draft" | "submitted"
>;

// Where the video file itself is. Separate from `status` on purpose: a film can
// be fully described and submitted while its upload is still transcoding, and
// an organiser reviewing entries needs to tell "no film yet" from "film sent,
// not reviewed yet".
export type FilmFileStatus = "pending" | "processing" | "ready" | "failed";

export type ChallengeFilm = {
  id: string;
  application_id: string;
  event_id: string;

  status: FilmStatus;

  // Posters. Bunny Storage URLs — images are small, so they keep going through
  // the server route the admin panel already uses.
  poster_url: string | null;
  horizontal_poster_url: string | null;

  title: string | null;
  director: string | null;
  actors: string | null;
  producer: string | null;
  synopsis: string | null;
  release_year: number | null;
  studio: string | null;
  age_rating: string | null;
  genre: string[];
  genre_other: string | null;
  duration_minutes: number | null;

  trailer_url: string | null;

  // Written by the upload route under the service role — the client holds no
  // grant on any of these four.
  film_url: string | null;
  film_path: string | null;
  film_video_id: string | null;
  film_status: FilmFileStatus;
  film_uploaded_at: string | null;

  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export const FILM_STATUS_LABEL: Record<FilmStatus, string> = {
  draft: "Ноорог",
  submitted: "Илгээсэн",
  under_review: "Хянагдаж байна",
  approved: "Баталгаажсан",
  rejected: "Буцаагдсан",
};

export const FILM_FILE_STATUS_LABEL: Record<FilmFileStatus, string> = {
  pending: "Бичлэг ороогүй",
  processing: "Боловсруулж байна",
  ready: "Бэлэн",
  failed: "Амжилтгүй",
};

// True once the organiser has the film in hand. From here the form is
// read-only: RLS still allows an update while the row is 'submitted' (so a
// mistake can be fixed by flipping it back), but the UI treats sending it in as
// final — same rule isLocked() applies to the application.
export function isFilmLocked(status: FilmStatus): boolean {
  return status !== "draft" && status !== "submitted";
}

// A submitted film needs its video; a draft does not. Used by the list to show
// what is still missing before the deadline.
export function isFilmComplete(film: ChallengeFilm): boolean {
  return (
    film.status !== "draft" &&
    film.film_status === "ready" &&
    Boolean(film.film_url)
  );
}

// ---------------------------------------------------------------------------
// Choice lists. Values are what lands in the database; labels are what the
// entrant reads. `genre` is a text[] column holding these exact strings, so
// FILM_GENRE_CHOICES is deliberately the same list the application form uses
// (lib/challenge/types.ts) — one vocabulary across both tables.
// ---------------------------------------------------------------------------
export { OTHER_VALUE, FILM_GENRE_CHOICES } from "../types";

// public.movies.age_category holds free text, so these are suggestions rather
// than a constraint. Kept as a fixed list here because an entrant typing "18+",
// "18 +", "R18" three different ways makes the organiser's filtering useless.
export const AGE_RATING_CHOICES: string[] = [
  "Бүх насны",
  "7+",
  "13+",
  "16+",
  "18+",
];
