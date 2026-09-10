// The film form's own state, plus the translation between it and the database
// row. Same shape and same reasoning as lib/challenge/form.ts: every value the
// user types is held as a string, because that is what an <input> gives you and
// because keeping `release_year` as "" rather than 0 or NaN is what lets the
// form tell "not filled in yet" from "filled in with a zero". The conversion to
// numbers, nulls and text[] happens once, in buildFilmFields, right before the
// row leaves for PostgREST.

import { OTHER_VALUE, type ChallengeFilm } from "./types";

export type FilmFormState = {
  // Постер
  poster_url: string;
  horizontal_poster_url: string;

  // Киноны мэдээлэл
  title: string;
  director: string;
  actors: string;
  producer: string;
  synopsis: string;
  release_year: string;
  studio: string;
  age_rating: string;
  genre: string[];
  genre_other: string;
  duration_minutes: string;

  // Линк
  trailer_url: string;
};

export const EMPTY_FILM_FORM: FilmFormState = {
  poster_url: "",
  horizontal_poster_url: "",
  title: "",
  director: "",
  actors: "",
  producer: "",
  synopsis: "",
  release_year: "",
  studio: "",
  age_rating: "",
  genre: [],
  genre_other: "",
  duration_minutes: "",
  trailer_url: "",
};

export function formFromFilm(row: ChallengeFilm): FilmFormState {
  return {
    poster_url: row.poster_url ?? "",
    horizontal_poster_url: row.horizontal_poster_url ?? "",
    title: row.title ?? "",
    director: row.director ?? "",
    actors: row.actors ?? "",
    producer: row.producer ?? "",
    synopsis: row.synopsis ?? "",
    release_year: row.release_year === null ? "" : String(row.release_year),
    studio: row.studio ?? "",
    age_rating: row.age_rating ?? "",
    genre: row.genre ?? [],
    genre_other: row.genre_other ?? "",
    duration_minutes:
      row.duration_minutes === null ? "" : String(row.duration_minutes),
    trailer_url: row.trailer_url ?? "",
  };
}

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

// Exactly the columns `authenticated` holds an UPDATE grant on in
// 20260910_challenge_films_and_payments.sql, and nothing else. Adding a key
// here that is not in that grant does not fail on that one column — PostgREST
// rejects the whole request with 42501, so the save silently stops working.
export type FilmFields = {
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
};

function text(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function int(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

// Turn the form into the row body. One shaping rule beyond the type coercion:
// the "Бусад" free-text companion is dropped unless "Бусад" is still ticked, so
// unticking it actually clears the note in the database instead of leaving a
// stale genre behind.
export function buildFilmFields(form: FilmFormState): FilmFields {
  const genreOther = form.genre.includes(OTHER_VALUE);

  return {
    poster_url: text(form.poster_url),
    horizontal_poster_url: text(form.horizontal_poster_url),
    title: text(form.title),
    director: text(form.director),
    actors: text(form.actors),
    producer: text(form.producer),
    synopsis: text(form.synopsis),
    release_year: int(form.release_year),
    studio: text(form.studio),
    age_rating: text(form.age_rating),
    genre: form.genre,
    genre_other: genreOther ? text(form.genre_other) : null,
    duration_minutes: int(form.duration_minutes),
    trailer_url: text(form.trailer_url),
  };
}

// ---------------------------------------------------------------------------
// Validation — only enforced on submit. A draft may be as empty as the entrant
// likes; the database's own CHECK constraints are the floor.
// ---------------------------------------------------------------------------

export type FilmFieldErrors = Partial<Record<keyof FilmFormState, string>>;

// A trailer is optional, but a link that is present has to be a link. Anything
// else lands in the organiser's export as text nobody can click.
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateFilmForSubmit(form: FilmFormState): FilmFieldErrors {
  const errors: FilmFieldErrors = {};

  if (!form.poster_url) errors.poster_url = "Босоо постероо оруулна уу.";
  if (!form.horizontal_poster_url)
    errors.horizontal_poster_url = "Хэвтээ постероо оруулна уу.";

  if (!form.title.trim()) errors.title = "Киноны нэрээ бичнэ үү.";
  if (!form.director.trim()) errors.director = "Найруулагчийн нэрийг бичнэ үү.";
  if (!form.actors.trim()) errors.actors = "Жүжигчдийн нэрийг бичнэ үү.";
  if (!form.producer.trim()) errors.producer = "Продюсерийн нэрийг бичнэ үү.";
  if (!form.synopsis.trim()) errors.synopsis = "Товч тайлбараа бичнэ үү.";

  const year = int(form.release_year);
  const thisYear = new Date().getFullYear();
  if (year === null) errors.release_year = "Оноо бичнэ үү.";
  else if (year < 1900 || year > thisYear + 1)
    errors.release_year = `Он 1900–${thisYear + 1} хооронд байна.`;

  if (!form.studio.trim()) errors.studio = "Студи эсвэл хувь хүний нэрийг бичнэ үү.";
  if (!form.age_rating.trim()) errors.age_rating = "Насны ангиллаа сонгоно уу.";

  if (form.genre.length === 0) errors.genre = "Дор хаяж нэг жанр сонгоно уу.";
  if (form.genre.includes(OTHER_VALUE) && !form.genre_other.trim())
    errors.genre_other = "«Бусад» жанраа бичнэ үү.";

  const minutes = int(form.duration_minutes);
  if (minutes === null) errors.duration_minutes = "Үргэлжлэх хугацааг бичнэ үү.";
  else if (minutes < 1 || minutes > 1000)
    errors.duration_minutes = "Хугацаа 1–1000 минут хооронд байна.";

  if (form.trailer_url.trim() && !isHttpUrl(form.trailer_url.trim()))
    errors.trailer_url = "Линк http:// эсвэл https:// -ээр эхлэх ёстой.";

  return errors;
}

// Which of the three sections a field lives in, so an invalid submit can point
// at the first section that needs attention rather than a wall of red.
export const SECTION_OF_FILM_FIELD: Record<keyof FilmFormState, number> = {
  poster_url: 1,
  horizontal_poster_url: 1,
  title: 2,
  director: 2,
  actors: 2,
  producer: 2,
  synopsis: 2,
  release_year: 2,
  studio: 2,
  age_rating: 2,
  genre: 2,
  genre_other: 2,
  duration_minutes: 2,
  trailer_url: 3,
};
