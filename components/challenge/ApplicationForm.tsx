"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Save,
  Send,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { saveApplication } from "@/lib/challenge/api";
import {
  buildFields,
  EMPTY_FORM,
  formFromApplication,
  prefillFromProfile,
  SECTION_OF_FIELD,
  validateForSubmit,
  type ApplicationFormState,
  type FieldErrors,
} from "@/lib/challenge/form";
import {
  EDIT_SOFTWARE_CHOICES,
  FILM_GENRE_CHOICES,
  GENDER_CHOICES,
  isLocked,
  OTHER_VALUE,
  PARTICIPATION_CHOICES,
  SHOT_WITH_CHOICES,
  type ChallengeApplication,
} from "@/lib/challenge/types";
import { formatDateTime } from "@/lib/events/format";
import { isRegistrationOpen, type SeeEvent } from "@/lib/events/types";
import {
  CheckboxGroup,
  Field,
  RadioGroup,
  Section,
  TextArea,
  TextInput,
  YesNo,
} from "./FormFields";

type Feedback =
  | { kind: "saved" }
  | { kind: "submitted" }
  | { kind: "error"; message: string }
  | null;

export default function ApplicationForm({
  event,
  application,
  onSaved,
}: {
  event: SeeEvent;
  application: ChallengeApplication | null;
  onSaved: (application: ChallengeApplication) => void;
}) {
  const { appUser, user } = useAuth();

  const [form, setForm] = useState<ApplicationFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const errorBoxRef = useRef<HTMLDivElement>(null);

  const locked = isLocked(application?.status ?? null);
  const registrationOpen = isRegistrationOpen(event);

  // Seed the form once from the saved row, or — for a first-time applicant —
  // from their profile. The saved draft always wins: prefillFromProfile only
  // fills fields that are still blank.
  useEffect(() => {
    const base = application ? formFromApplication(application) : EMPTY_FORM;
    setForm(prefillFromProfile(base, appUser, user?.email ?? null));
  }, [application, appUser, user?.email]);

  const set = <K extends keyof ApplicationFormState>(
    key: K,
    value: ApplicationFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear this field's error as soon as it is touched — leaving stale red
    // text under a field the user just fixed is its own small lie.
    setErrors((prev) => (key in prev ? { ...prev, [key]: undefined } : prev));
    setFeedback(null);
  };

  const isTeam = form.participation === "team";
  const genreOther = form.film_genre.includes(OTHER_VALUE);
  const softwareOther = form.edit_software.includes(OTHER_VALUE);

  const errorSummary = useMemo(() => {
    const keys = Object.keys(errors).filter(
      (k) => errors[k as keyof FieldErrors],
    ) as (keyof ApplicationFormState)[];
    if (keys.length === 0) return null;
    const first = Math.min(...keys.map((k) => SECTION_OF_FIELD[k]));
    return { count: keys.length, section: first };
  }, [errors]);

  const save = async (status: "draft" | "submitted") => {
    if (locked) return;

    if (status === "submitted") {
      const found = validateForSubmit(form);
      if (Object.keys(found).length > 0) {
        setErrors(found);
        setFeedback(null);
        errorBoxRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        return;
      }
      setErrors({});
    }

    setBusy(status === "draft" ? "draft" : "submit");
    setFeedback(null);

    const result = await saveApplication(
      event.id,
      application,
      buildFields(form),
      status,
    );

    setBusy(null);

    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }

    onSaved(result.application);
    setFeedback({ kind: status === "draft" ? "saved" : "submitted" });
  };

  return (
    <div className="space-y-5">
      {locked && (
        <div className="flex items-start gap-3 rounded-2xl border border-brand/25 bg-brand/5 p-4">
          <Lock size={16} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <p className="text-sm font-semibold text-white">
              Анкет илгээгдсэн.
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {application?.submitted_at
                ? `${formatDateTime(application.submitted_at)}-д илгээсэн. `
                : ""}
              Илгээсний дараа анкет засагдахгүй. Засах шаардлагатай бол зохион
              байгуулагчтай холбогдоно уу.
            </p>
          </div>
        </div>
      )}

      <div ref={errorBoxRef}>
        {errorSummary && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-300" />
            <p className="text-xs leading-relaxed text-red-200">
              Бөглөөгүй {errorSummary.count} талбар байна. {errorSummary.section}
              -р хэсгээс эхлээд шалгана уу.
            </p>
          </div>
        )}
      </div>

      <Section n={1} title="Хувийн мэдээлэл">
        <Field label="Овог нэр" htmlFor="full_name" required error={errors.full_name}>
          <TextInput
            id="full_name"
            value={form.full_name}
            onChange={(v) => set("full_name", v)}
            placeholder="Бат-Эрдэнэ Дорж"
            autoComplete="name"
            disabled={locked}
            invalid={Boolean(errors.full_name)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Нас" htmlFor="age" required error={errors.age}>
            <TextInput
              id="age"
              value={form.age}
              onChange={(v) => set("age", v.replace(/\D/g, "").slice(0, 3))}
              inputMode="numeric"
              placeholder="24"
              disabled={locked}
              invalid={Boolean(errors.age)}
            />
          </Field>

          <Field label="Хүйс" required error={errors.gender}>
            <RadioGroup
              name="gender"
              value={form.gender}
              choices={GENDER_CHOICES}
              onChange={(v) => set("gender", v)}
              disabled={locked}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Утасны дугаар" htmlFor="phone" required error={errors.phone}>
            <TextInput
              id="phone"
              value={form.phone}
              onChange={(v) => set("phone", v)}
              type="tel"
              inputMode="tel"
              placeholder="99112233"
              autoComplete="tel"
              disabled={locked}
              invalid={Boolean(errors.phone)}
            />
          </Field>

          <Field label="И-мэйл" htmlFor="email" required error={errors.email}>
            <TextInput
              id="email"
              value={form.email}
              onChange={(v) => set("email", v)}
              type="email"
              inputMode="email"
              placeholder="name@example.com"
              autoComplete="email"
              disabled={locked}
              invalid={Boolean(errors.email)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Facebook / Instagram"
            htmlFor="social_url"
            error={errors.social_url}
          >
            <TextInput
              id="social_url"
              value={form.social_url}
              onChange={(v) => set("social_url", v)}
              inputMode="url"
              placeholder="facebook.com/username"
              disabled={locked}
            />
          </Field>

          <Field label="Хот / Аймаг" htmlFor="city" required error={errors.city}>
            <TextInput
              id="city"
              value={form.city}
              onChange={(v) => set("city", v)}
              placeholder="Улаанбаатар"
              disabled={locked}
              invalid={Boolean(errors.city)}
            />
          </Field>
        </div>
      </Section>

      <Section n={2} title="Багийн мэдээлэл">
        <Field label="Хэрхэн оролцох вэ" required error={errors.participation}>
          <RadioGroup
            name="participation"
            value={form.participation}
            choices={PARTICIPATION_CHOICES}
            onChange={(v) => set("participation", v)}
            disabled={locked}
          />
        </Field>

        {/* Team fields exist only for a team entry — and buildFields nulls them
            out on save, so switching back to solo actually clears them. */}
        {isTeam && (
          <div className="space-y-4 rounded-xl border border-white/8 bg-ink/40 p-4">
            <Field
              label="Багийн нэр"
              htmlFor="team_name"
              required
              error={errors.team_name}
            >
              <TextInput
                id="team_name"
                value={form.team_name}
                onChange={(v) => set("team_name", v)}
                disabled={locked}
                invalid={Boolean(errors.team_name)}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Багийн ахлагч"
                htmlFor="team_leader"
                required
                error={errors.team_leader}
              >
                <TextInput
                  id="team_leader"
                  value={form.team_leader}
                  onChange={(v) => set("team_leader", v)}
                  disabled={locked}
                  invalid={Boolean(errors.team_leader)}
                />
              </Field>

              <Field
                label="Гишүүдийн тоо"
                htmlFor="team_size"
                required
                error={errors.team_size}
              >
                <TextInput
                  id="team_size"
                  value={form.team_size}
                  onChange={(v) =>
                    set("team_size", v.replace(/\D/g, "").slice(0, 3))
                  }
                  inputMode="numeric"
                  placeholder="4"
                  disabled={locked}
                  invalid={Boolean(errors.team_size)}
                />
              </Field>
            </div>
          </div>
        )}
      </Section>

      <Section n={3} title="Киноны мэдээлэл">
        <Field
          label="Киноны нэр"
          htmlFor="film_title"
          required
          error={errors.film_title}
        >
          <TextInput
            id="film_title"
            value={form.film_title}
            onChange={(v) => set("film_title", v)}
            disabled={locked}
            invalid={Boolean(errors.film_title)}
          />
        </Field>

        <Field label="Төрөл" required error={errors.film_genre}>
          <CheckboxGroup
            name="film_genre"
            values={form.film_genre}
            choices={FILM_GENRE_CHOICES}
            onChange={(v) => set("film_genre", v)}
            disabled={locked}
          />
        </Field>

        {genreOther && (
          <Field
            label="«Бусад» төрөл"
            htmlFor="film_genre_other"
            required
            error={errors.film_genre_other}
          >
            <TextInput
              id="film_genre_other"
              value={form.film_genre_other}
              onChange={(v) => set("film_genre_other", v)}
              disabled={locked}
              invalid={Boolean(errors.film_genre_other)}
            />
          </Field>
        )}

        <Field
          label="Товч агуулга"
          htmlFor="film_synopsis"
          required
          error={errors.film_synopsis}
        >
          <TextArea
            id="film_synopsis"
            value={form.film_synopsis}
            onChange={(v) => set("film_synopsis", v)}
            rows={5}
            placeholder="Киноны санаа, өрнөлийг товчхон бичнэ үү."
            disabled={locked}
            invalid={Boolean(errors.film_synopsis)}
          />
        </Field>
      </Section>

      <Section n={4} title="Бүтээлийн мэдээлэл">
        <Field label="Юугаар зураг авалт хийх вэ" required error={errors.shot_with}>
          <RadioGroup
            name="shot_with"
            value={form.shot_with}
            choices={SHOT_WITH_CHOICES}
            onChange={(v) => set("shot_with", v)}
            disabled={locked}
          />
        </Field>

        <Field label="Засварын программ" required error={errors.edit_software}>
          <CheckboxGroup
            name="edit_software"
            values={form.edit_software}
            choices={EDIT_SOFTWARE_CHOICES}
            onChange={(v) => set("edit_software", v)}
            disabled={locked}
          />
        </Field>

        {softwareOther && (
          <Field
            label="«Бусад» программ"
            htmlFor="edit_software_other"
            required
            error={errors.edit_software_other}
          >
            <TextInput
              id="edit_software_other"
              value={form.edit_software_other}
              onChange={(v) => set("edit_software_other", v)}
              disabled={locked}
              invalid={Boolean(errors.edit_software_other)}
            />
          </Field>
        )}
      </Section>

      <Section n={5} title="Нэмэлт мэдээлэл">
        <Field
          label="Өмнө нь кино хийж байсан уу"
          required
          error={errors.has_prior_films}
        >
          <YesNo
            name="has_prior_films"
            value={form.has_prior_films}
            onChange={(v) => set("has_prior_films", v)}
            disabled={locked}
          />
        </Field>

        {form.has_prior_films === true && (
          <Field
            label="Ямар бүтээл хийж байсан бэ"
            htmlFor="prior_films_note"
            required
            error={errors.prior_films_note}
          >
            <TextArea
              id="prior_films_note"
              value={form.prior_films_note}
              onChange={(v) => set("prior_films_note", v)}
              rows={3}
              disabled={locked}
              invalid={Boolean(errors.prior_films_note)}
            />
          </Field>
        )}
      </Section>

      {feedback?.kind === "error" && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          {feedback.message}
        </p>
      )}
      {feedback?.kind === "saved" && (
        <p className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/80">
          <CheckCircle2 size={14} className="text-brand" />
          Ноорог хадгалагдлаа. Дараа үргэлжлүүлж болно.
        </p>
      )}
      {feedback?.kind === "submitted" && (
        <p className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-xs text-brand-light">
          <CheckCircle2 size={14} />
          Анкет амжилттай илгээгдлээ.
        </p>
      )}

      {!locked && (
        <div className="sticky bottom-16 z-10 flex flex-col gap-3 rounded-2xl border border-white/8 bg-ink-surface/95 p-4 backdrop-blur-xl sm:flex-row sm:items-center lg:bottom-4">
          <button
            type="button"
            onClick={() => save("draft")}
            disabled={busy !== null}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:text-white disabled:opacity-50"
          >
            {busy === "draft" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Түр хадгалах
          </button>

          <button
            type="button"
            onClick={() => save("submitted")}
            disabled={busy !== null || !registrationOpen}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-black shadow-glow transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {busy === "submit" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            Илгээх
          </button>

          {/* Why the button is dead, stated where the button is. */}
          {!registrationOpen && (
            <p className="text-xs text-red-300 sm:max-w-[15rem]">
              {event.registration_ends_at
                ? `Бүртгэл ${formatDateTime(event.registration_ends_at)}-д хаагдсан тул анкет илгээх боломжгүй.`
                : "Бүртгэлийн хугацаа зарлагдаагүй тул анкет илгээх боломжгүй."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
