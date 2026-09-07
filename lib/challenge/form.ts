// The application form's own state, plus the translation between it and the
// database row.
//
// Everything the user types is held as a string — that is what an <input>
// gives you, and keeping `age` as "" rather than 0 or NaN while the field is
// empty is what lets the form distinguish "not filled in yet" from "filled in
// with a zero". The conversion to numbers, nulls and text[] happens once, in
// buildPayload, right before the row leaves for PostgREST.
//
// No form library. react-hook-form + zod would each earn their keep on a form
// with cross-field async validation or dozens of fields re-rendering per
// keystroke; this one has five sections of plain inputs and the rest of the
// project (LoginForm) already validates with useState, so adding two
// dependencies would buy consistency loss rather than clarity.

import {
  OTHER_VALUE,
  type ChallengeApplication,
  type ClientWritableStatus,
  type Gender,
  type Participation,
  type ShotWith,
} from "./types";

export type ApplicationFormState = {
  // 1. Хувийн
  full_name: string;
  age: string;
  gender: Gender | "";
  phone: string;
  email: string;
  social_url: string;
  city: string;

  // 2. Багийн
  participation: Participation | "";
  team_name: string;
  team_leader: string;
  team_size: string;

  // 3. Киноны
  film_title: string;
  film_genre: string[];
  film_genre_other: string;
  film_synopsis: string;

  // 4. Бүтээлийн
  shot_with: ShotWith | "";
  edit_software: string[];
  edit_software_other: string;

  // 5. Нэмэлт
  has_prior_films: boolean | null;
  prior_films_note: string;
};

export const EMPTY_FORM: ApplicationFormState = {
  full_name: "",
  age: "",
  gender: "",
  phone: "",
  email: "",
  social_url: "",
  city: "",
  participation: "",
  team_name: "",
  team_leader: "",
  team_size: "",
  film_title: "",
  film_genre: [],
  film_genre_other: "",
  film_synopsis: "",
  shot_with: "",
  edit_software: [],
  edit_software_other: "",
  has_prior_films: null,
  prior_films_note: "",
};

// Prefill from the signed-in user's profile. Only fills blanks, so a saved
// draft always wins over whatever is on the profile.
export function prefillFromProfile(
  form: ApplicationFormState,
  profile: { full_name: string | null; phone: string | null } | null,
  email: string | null,
): ApplicationFormState {
  return {
    ...form,
    full_name: form.full_name || profile?.full_name?.trim() || "",
    phone: form.phone || profile?.phone?.trim() || "",
    email: form.email || email?.trim() || "",
  };
}

export function formFromApplication(
  row: ChallengeApplication,
): ApplicationFormState {
  return {
    full_name: row.full_name ?? "",
    age: row.age === null ? "" : String(row.age),
    gender: row.gender ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    social_url: row.social_url ?? "",
    city: row.city ?? "",
    participation: row.participation ?? "",
    team_name: row.team_name ?? "",
    team_leader: row.team_leader ?? "",
    team_size: row.team_size === null ? "" : String(row.team_size),
    film_title: row.film_title ?? "",
    film_genre: row.film_genre ?? [],
    film_genre_other: row.film_genre_other ?? "",
    film_synopsis: row.film_synopsis ?? "",
    shot_with: row.shot_with ?? "",
    edit_software: row.edit_software ?? [],
    edit_software_other: row.edit_software_other ?? "",
    has_prior_films: row.has_prior_films,
    prior_films_note: row.prior_films_note ?? "",
  };
}

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

// Exactly the columns `authenticated` holds an UPDATE grant on in
// 20260907_challenge_applications.sql, and nothing else. Adding a key here that
// is not in that grant does not fail on that one column — PostgREST rejects the
// whole request with 42501, so the save silently stops working.
export type ApplicationFields = {
  full_name: string | null;
  age: number | null;
  gender: Gender | null;
  phone: string | null;
  email: string | null;
  social_url: string | null;
  city: string | null;
  participation: Participation | null;
  team_name: string | null;
  team_leader: string | null;
  team_size: number | null;
  film_title: string | null;
  film_genre: string[];
  film_genre_other: string | null;
  film_synopsis: string | null;
  shot_with: ShotWith | null;
  edit_software: string[];
  edit_software_other: string | null;
  has_prior_films: boolean | null;
  prior_films_note: string | null;
};

export type ApplicationWrite = ApplicationFields & {
  status: ClientWritableStatus;
  submitted_at?: string;
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

// Turn the form into the row body. Two shaping rules beyond the type coercion:
//
//   * team fields are dropped when the entry is solo, so switching from team to
//     solo actually clears them in the database instead of leaving a stale team
//     name behind;
//   * the "Бусад" free-text companions are dropped unless "Бусад" is still
//     ticked, for the same reason.
export function buildFields(form: ApplicationFormState): ApplicationFields {
  const isTeam = form.participation === "team";
  const genreOther = form.film_genre.includes(OTHER_VALUE);
  const softwareOther = form.edit_software.includes(OTHER_VALUE);

  return {
    full_name: text(form.full_name),
    age: int(form.age),
    gender: form.gender === "" ? null : form.gender,
    phone: text(form.phone),
    email: text(form.email),
    social_url: text(form.social_url),
    city: text(form.city),

    participation: form.participation === "" ? null : form.participation,
    team_name: isTeam ? text(form.team_name) : null,
    team_leader: isTeam ? text(form.team_leader) : null,
    team_size: isTeam ? int(form.team_size) : null,

    film_title: text(form.film_title),
    film_genre: form.film_genre,
    film_genre_other: genreOther ? text(form.film_genre_other) : null,
    film_synopsis: text(form.film_synopsis),

    shot_with: form.shot_with === "" ? null : form.shot_with,
    edit_software: form.edit_software,
    edit_software_other: softwareOther ? text(form.edit_software_other) : null,

    has_prior_films: form.has_prior_films,
    prior_films_note:
      form.has_prior_films === true ? text(form.prior_films_note) : null,
  };
}

// ---------------------------------------------------------------------------
// Validation — only enforced on submit. A draft may be as empty as the
// applicant likes; the database's own CHECK constraints are the floor.
// ---------------------------------------------------------------------------

export type FieldErrors = Partial<Record<keyof ApplicationFormState, string>>;

export function validateForSubmit(form: ApplicationFormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.full_name.trim()) errors.full_name = "Нэрээ бичнэ үү.";

  const age = int(form.age);
  if (age === null) errors.age = "Насаа бичнэ үү.";
  else if (age < 1 || age > 120) errors.age = "Нас 1–120 хооронд байна.";

  if (!form.gender) errors.gender = "Хүйсээ сонгоно уу.";
  if (!form.phone.trim()) errors.phone = "Утасны дугаараа бичнэ үү.";

  const email = form.email.trim();
  if (!email) errors.email = "И-мэйлээ бичнэ үү.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "И-мэйл хаяг буруу байна.";

  if (!form.city.trim()) errors.city = "Хот / аймгаа бичнэ үү.";

  if (!form.participation) {
    errors.participation = "Ганцаараа эсвэл багаараа гэдгээ сонгоно уу.";
  } else if (form.participation === "team") {
    if (!form.team_name.trim()) errors.team_name = "Багийн нэрээ бичнэ үү.";
    if (!form.team_leader.trim())
      errors.team_leader = "Багийн ахлагчийн нэрийг бичнэ үү.";
    const size = int(form.team_size);
    if (size === null) errors.team_size = "Багийн бүрэлдэхүүний тоог бичнэ үү.";
    else if (size < 1) errors.team_size = "Хамгийн багадаа 1 байна.";
  }

  if (!form.film_title.trim()) errors.film_title = "Киноны нэрээ бичнэ үү.";
  if (form.film_genre.length === 0)
    errors.film_genre = "Дор хаяж нэг төрөл сонгоно уу.";
  if (form.film_genre.includes(OTHER_VALUE) && !form.film_genre_other.trim())
    errors.film_genre_other = "«Бусад» төрлөө бичнэ үү.";
  if (!form.film_synopsis.trim())
    errors.film_synopsis = "Товч агуулгаа бичнэ үү.";

  if (!form.shot_with) errors.shot_with = "Юугаар хийснээ сонгоно уу.";
  if (form.edit_software.length === 0)
    errors.edit_software = "Дор хаяж нэг програм сонгоно уу.";
  if (
    form.edit_software.includes(OTHER_VALUE) &&
    !form.edit_software_other.trim()
  )
    errors.edit_software_other = "«Бусад» програмаа бичнэ үү.";

  if (form.has_prior_films === null)
    errors.has_prior_films = "Тийм эсвэл Үгүй гэдгээ сонгоно уу.";
  if (form.has_prior_films === true && !form.prior_films_note.trim())
    errors.prior_films_note = "Өмнөх бүтээлээ товч бичнэ үү.";

  return errors;
}

// Which of the five sections a field lives in, so an invalid submit can point
// at the first section that needs attention rather than a wall of red.
export const SECTION_OF_FIELD: Record<keyof ApplicationFormState, number> = {
  full_name: 1,
  age: 1,
  gender: 1,
  phone: 1,
  email: 1,
  social_url: 1,
  city: 1,
  participation: 2,
  team_name: 2,
  team_leader: 2,
  team_size: 2,
  film_title: 3,
  film_genre: 3,
  film_genre_other: 3,
  film_synopsis: 3,
  shot_with: 4,
  edit_software: 4,
  edit_software_other: 4,
  has_prior_films: 5,
  prior_films_note: 5,
};
