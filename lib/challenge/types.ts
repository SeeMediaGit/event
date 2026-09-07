// Shape of one row of public.challenge_applications. Kept in sync by hand with
// supabase/migrations/20260907_challenge_applications.sql — this project has no
// generated types and no migration history (schema is applied through the SQL
// editor), so the same discipline as lib/events/types.ts applies: change the
// table, change this file in the same commit.

// Every value the CHECK constraint allows. The client can only ever *write*
// 'draft' and 'submitted' (see ClientWritableStatus below); the rest arrive
// from the service role and are read-only here.
export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "paid"
  | "uploaded"
  | "under_review"
  | "approved"
  | "rejected";

// What the browser is allowed to put in `status`. The RLS policy's WITH CHECK
// rejects anything else, so narrowing the type here turns a runtime 403 into a
// compile error.
export type ClientWritableStatus = Extract<
  ApplicationStatus,
  "draft" | "submitted"
>;

export type Gender = "male" | "female" | "other";
export type Participation = "solo" | "team";
export type ShotWith = "phone" | "camera" | "mixed";

export type ChallengeApplication = {
  id: string;
  event_id: string;
  user_id: string;

  status: ApplicationStatus;
  registration_no: string | null;
  submitted_at: string | null;
  paid_at: string | null;

  // 1. Хувийн мэдээлэл
  full_name: string | null;
  age: number | null;
  gender: Gender | null;
  phone: string | null;
  email: string | null;
  social_url: string | null;
  city: string | null;

  // 2. Багийн мэдээлэл
  participation: Participation | null;
  team_name: string | null;
  team_leader: string | null;
  team_size: number | null;

  // 3. Киноны мэдээлэл
  film_title: string | null;
  film_genre: string[];
  film_genre_other: string | null;
  film_synopsis: string | null;

  // 4. Бүтээлийн мэдээлэл
  shot_with: ShotWith | null;
  edit_software: string[];
  edit_software_other: string | null;

  // 5. Нэмэлт мэдээлэл
  has_prior_films: boolean | null;
  prior_films_note: string | null;

  // 20260909_challenge_film_upload.sql. Written by the upload route under the
  // service role — the client holds no grant on these.
  film_file_url: string | null;
  film_file_path: string | null;
  film_uploaded_at: string | null;

  created_at: string;
  updated_at: string;
};

// How far along the flow a status sits. The stepper unlocks step N only when
// the row has reached the status that step needs, and comparing ranks means a
// paid application does not lose access to the fee step it already cleared.
//
// 'rejected' deliberately ranks alongside 'submitted': the organiser sent the
// application back, so the paid / upload steps are not open to it.
const STATUS_RANK: Record<ApplicationStatus, number> = {
  draft: 0,
  submitted: 1,
  rejected: 1,
  paid: 2,
  uploaded: 3,
  under_review: 3,
  approved: 3,
};

export function statusRank(status: ApplicationStatus | null): number {
  return status ? STATUS_RANK[status] : -1;
}

// True once the application has left the applicant's hands. From here the form
// is read-only: RLS still allows an update while the row is 'submitted' (so a
// mistake can be fixed by an organiser flipping it back to draft), but the UI
// treats sending it in as final.
export function isLocked(status: ApplicationStatus | null): boolean {
  return statusRank(status) >= 1;
}

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: "Ноорог",
  submitted: "Илгээсэн",
  paid: "Төлбөр төлсөн",
  uploaded: "Бүтээл ирсэн",
  under_review: "Хянагдаж байна",
  approved: "Баталгаажсан",
  rejected: "Буцаагдсан",
};

// ---------------------------------------------------------------------------
// Choice lists. Values are what lands in the database (English, stable);
// labels are what the applicant reads (Mongolian). The paper form is the
// source of truth for both the wording and the order.
// ---------------------------------------------------------------------------
export type Choice<T extends string = string> = { value: T; label: string };

export const GENDER_CHOICES: Choice<Gender>[] = [
  { value: "male", label: "Эрэгтэй" },
  { value: "female", label: "Эмэгтэй" },
  { value: "other", label: "Бусад" },
];

export const PARTICIPATION_CHOICES: Choice<Participation>[] = [
  { value: "solo", label: "Ганцаараа" },
  { value: "team", label: "Багаараа" },
];

export const SHOT_WITH_CHOICES: Choice<ShotWith>[] = [
  { value: "phone", label: "Утсаар" },
  { value: "camera", label: "Камераар" },
  { value: "mixed", label: "Хосолсон" },
];

// film_genre and edit_software are text[] columns holding these exact strings.
// OTHER_VALUE is the one that turns on the free-text companion field.
export const OTHER_VALUE = "Бусад";

export const FILM_GENRE_CHOICES: string[] = [
  "Инээдэм",
  "Романтик",
  "Аймшиг",
  "Адал явдал",
  "Тулаант",
  "Драм",
  "Уран зөгнөл",
  OTHER_VALUE,
];

export const EDIT_SOFTWARE_CHOICES: string[] = [
  "CapCut",
  "VN",
  "Premiere Pro",
  "DaVinci Resolve",
  "Final Cut Pro",
  OTHER_VALUE,
];
