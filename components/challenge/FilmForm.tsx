"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Send,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { deleteFilm, refetchFilm, saveFilm } from "@/lib/challenge/films/api";
import {
  buildFilmFields,
  EMPTY_FILM_FORM,
  formFromFilm,
  SECTION_OF_FILM_FIELD,
  validateFilmForSubmit,
  type FilmFieldErrors,
  type FilmFormState,
} from "@/lib/challenge/films/form";
import {
  AGE_RATING_CHOICES,
  FILM_GENRE_CHOICES,
  isFilmLocked,
  OTHER_VALUE,
  type ChallengeFilm,
} from "@/lib/challenge/films/types";
import {
  ACCEPTED_FILM_TYPES,
  ACCEPTED_IMAGE_TYPES,
  checkFile,
  formatBytes,
  MAX_FILM_SIZE,
  uploadChallengeFile,
  type UploadKind,
} from "@/lib/challenge/upload";
import { formatDateTime } from "@/lib/events/format";
import { isSubmissionOpen, type SeeEvent } from "@/lib/events/types";
import {
  CheckboxGroup,
  Field,
  RadioGroup,
  Section,
  TextArea,
  TextInput,
} from "./FormFields";

// One film's details. The row already exists when this opens — "Кино нэмэх"
// creates an empty draft first — because a poster cannot be uploaded without a
// film id to file it under, and inventing a temporary id client-side would mean
// orphaned bytes in the storage zone every time someone changed their mind.
export default function FilmForm({
  event,
  applicationId,
  film,
  onSaved,
  onDeleted,
  onClose,
}: {
  event: SeeEvent;
  applicationId: string;
  film: ChallengeFilm;
  onSaved: (film: ChallengeFilm) => void;
  onDeleted: (filmId: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FilmFormState>(() =>
    film.title || film.poster_url ? formFromFilm(film) : EMPTY_FILM_FORM,
  );
  const [errors, setErrors] = useState<FilmFieldErrors>({});
  const [saving, setSaving] = useState<null | "draft" | "submit">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [current, setCurrent] = useState<ChallengeFilm>(film);
  const [deleting, setDeleting] = useState(false);

  const locked = isFilmLocked(current.status);
  const open = isSubmissionOpen(event);
  const readOnly = locked || !open;

  const set = <K extends keyof FilmFormState>(key: K, value: FilmFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clearing the error as soon as the field is touched, rather than on the
    // next submit, is what stops a corrected field from staying red.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const save = async (mode: "draft" | "submit") => {
    setMessage(null);

    if (mode === "submit") {
      const found = validateFilmForSubmit(form);
      const keys = Object.keys(found) as (keyof FilmFormState)[];
      if (keys.length > 0) {
        setErrors(found);
        // Point at the first section that needs attention rather than leaving
        // the entrant to hunt through a wall of red.
        const first = Math.min(...keys.map((k) => SECTION_OF_FILM_FIELD[k]));
        setMessage(`${first}-р хэсэгт дутуу талбар байна.`);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      // The video is not part of validateFilmForSubmit because it is not a form
      // field — it is written by the upload route — but an entry without it is
      // not an entry.
      if (!current.film_url) {
        setMessage("Бүтээлээ оруулсны дараа илгээнэ үү.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setErrors({});
    }

    setSaving(mode);
    const result = await saveFilm(
      applicationId,
      event.id,
      current,
      buildFilmFields(form),
      mode === "submit" ? "submitted" : "draft",
    );
    setSaving(null);

    if (!result.ok) {
      setMessage(result.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setCurrent(result.film);
    onSaved(result.film);
    if (mode === "submit") onClose();
    else setMessage("Хадгаллаа.");
  };

  const remove = async () => {
    setMessage(null);
    setDeleting(true);
    const result = await deleteFilm(current.id);
    setDeleting(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    onDeleted(current.id);
    onClose();
  };

  // The upload route wrote the row under the service role, so re-read it rather
  // than patching a guess into local state — that read is also what proves the
  // write landed.
  const afterFilmUpload = async () => {
    const fresh = await refetchFilm(current.id);
    if (fresh.ok) {
      setCurrent(fresh.film);
      onSaved(fresh.film);
    } else {
      setMessage(fresh.message);
    }
  };

  const genreOther = form.genre.includes(OTHER_VALUE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
        >
          <ArrowLeft size={14} />
          Жагсаалт руу
        </button>

        {current.status === "draft" && (
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/25 px-3.5 py-2 text-xs font-semibold text-red-300 transition hover:border-red-500/50 hover:text-red-200 disabled:opacity-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Устгах
          </button>
        )}
      </div>

      {message && (
        <p className="flex items-start gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-xs text-white/80">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-white/40" />
          {message}
        </p>
      )}

      {readOnly && (
        <p className="flex items-start gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-xs text-white/80">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-brand" />
          {locked
            ? "Энэ кино хянагдаж эхэлсэн тул засах боломжгүй."
            : `Бүтээл хүлээн авах хугацаа дууссан${
                event.submission_ends_at
                  ? ` (${formatDateTime(event.submission_ends_at)})`
                  : ""
              }.`}
        </p>
      )}

      <Section n={1} title="Постер" hint="Босоо ба хэвтээ хоёуланг нь оруулна.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PosterPicker
            label="Босоо постер"
            filmId={current.id}
            kind="poster"
            aspect="aspect-[2/3]"
            value={form.poster_url}
            onChange={(url) => set("poster_url", url)}
            error={errors.poster_url}
            disabled={readOnly}
          />
          <PosterPicker
            label="Хэвтээ постер"
            filmId={current.id}
            kind="horizontal_poster"
            aspect="aspect-[16/9]"
            value={form.horizontal_poster_url}
            onChange={(url) => set("horizontal_poster_url", url)}
            error={errors.horizontal_poster_url}
            disabled={readOnly}
          />
        </div>
      </Section>

      <Section n={2} title="Киноны мэдээлэл">
        <Field label="Киноны нэр" htmlFor="title" error={errors.title} required>
          <TextInput
            id="title"
            value={form.title}
            onChange={(v) => set("title", v)}
            disabled={readOnly}
            invalid={Boolean(errors.title)}
          />
        </Field>

        <Field label="Найруулагч" htmlFor="director" error={errors.director} required>
          <TextInput
            id="director"
            value={form.director}
            onChange={(v) => set("director", v)}
            disabled={readOnly}
            invalid={Boolean(errors.director)}
          />
        </Field>

        <Field
          label="Жүжигчид"
          htmlFor="actors"
          error={errors.actors}
          required
        >
          <TextArea
            id="actors"
            rows={2}
            value={form.actors}
            onChange={(v) => set("actors", v)}
            placeholder="Таслалаар тусгаарлан бичнэ үү"
            disabled={readOnly}
            invalid={Boolean(errors.actors)}
          />
        </Field>

        <Field label="Продюсер" htmlFor="producer" error={errors.producer} required>
          <TextInput
            id="producer"
            value={form.producer}
            onChange={(v) => set("producer", v)}
            disabled={readOnly}
            invalid={Boolean(errors.producer)}
          />
        </Field>

        <Field
          label="Киноны товч тайлбар"
          htmlFor="synopsis"
          error={errors.synopsis}
          required
        >
          <TextArea
            id="synopsis"
            value={form.synopsis}
            onChange={(v) => set("synopsis", v)}
            disabled={readOnly}
            invalid={Boolean(errors.synopsis)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Он" htmlFor="release_year" error={errors.release_year} required>
            <TextInput
              id="release_year"
              inputMode="numeric"
              value={form.release_year}
              onChange={(v) => set("release_year", v)}
              placeholder="2026"
              disabled={readOnly}
              invalid={Boolean(errors.release_year)}
            />
          </Field>

          <Field
            label="Үргэлжлэх хугацаа (минут)"
            htmlFor="duration_minutes"
            error={errors.duration_minutes}
            required
          >
            <TextInput
              id="duration_minutes"
              inputMode="numeric"
              value={form.duration_minutes}
              onChange={(v) => set("duration_minutes", v)}
              placeholder="12"
              disabled={readOnly}
              invalid={Boolean(errors.duration_minutes)}
            />
          </Field>
        </div>

        <Field
          label="Студи / хувь хүн"
          htmlFor="studio"
          error={errors.studio}
          required
        >
          <TextInput
            id="studio"
            value={form.studio}
            onChange={(v) => set("studio", v)}
            disabled={readOnly}
            invalid={Boolean(errors.studio)}
          />
        </Field>

        <Field label="Насны ангилал" error={errors.age_rating} required>
          <RadioGroup
            name="age_rating"
            value={form.age_rating}
            choices={AGE_RATING_CHOICES.map((c) => ({ value: c, label: c }))}
            onChange={(v) => set("age_rating", v)}
            disabled={readOnly}
          />
        </Field>

        <Field label="Жанр" error={errors.genre} required>
          <CheckboxGroup
            name="genre"
            values={form.genre}
            choices={FILM_GENRE_CHOICES}
            onChange={(v) => set("genre", v)}
            disabled={readOnly}
          />
        </Field>

        {genreOther && (
          <Field label="Бусад жанр" htmlFor="genre_other" error={errors.genre_other}>
            <TextInput
              id="genre_other"
              value={form.genre_other}
              onChange={(v) => set("genre_other", v)}
              disabled={readOnly}
              invalid={Boolean(errors.genre_other)}
            />
          </Field>
        )}
      </Section>

      <Section n={3} title="Трейлэр ба бүтээл">
        <Field label="Трейлэр линк" htmlFor="trailer_url" error={errors.trailer_url}>
          <TextInput
            id="trailer_url"
            inputMode="url"
            value={form.trailer_url}
            onChange={(v) => set("trailer_url", v)}
            placeholder="https://…"
            disabled={readOnly}
            invalid={Boolean(errors.trailer_url)}
          />
        </Field>

        <FilmPicker
          filmId={current.id}
          film={current}
          disabled={readOnly}
          onUploaded={afterFilmUpload}
        />
      </Section>

      {!readOnly && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => save("draft")}
            disabled={saving !== null}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/12 py-3.5 text-sm font-semibold text-white/80 transition hover:border-white/25 hover:text-white disabled:opacity-50"
          >
            {saving === "draft" && <Loader2 size={16} className="animate-spin" />}
            Ноорогт хадгалах
          </button>
          <button
            type="button"
            onClick={() => save("submit")}
            disabled={saving !== null}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-bold text-black shadow-glow transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {saving === "submit" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            Илгээх
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Poster
// ---------------------------------------------------------------------------

// The upload happens the moment a file is picked, and the returned URL goes
// into form state — it is only persisted when the entrant saves. So an
// abandoned form leaves an unreferenced object in the storage zone, which is
// the cheap side of the trade: the alternative is showing no preview until save.
function PosterPicker({
  label,
  filmId,
  kind,
  aspect,
  value,
  onChange,
  error,
  disabled,
}: {
  label: string;
  filmId: string;
  kind: Extract<UploadKind, "poster" | "horizontal_poster">;
  aspect: string;
  value: string;
  onChange: (url: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const pick = async (file: File | null) => {
    setFailed(null);
    if (!file) return;

    const problem = checkFile(file, kind);
    if (problem) {
      setFailed(problem);
      return;
    }

    setBusy(true);
    const result = await uploadChallengeFile({ file, filmId, kind });
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";

    if (!result.ok) {
      setFailed(result.message);
      return;
    }
    onChange(result.url);
  };

  return (
    <Field label={label} error={error ?? failed ?? undefined} required>
      <label
        className={`relative flex ${aspect} w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-ink transition hover:border-brand/40 ${
          disabled || busy ? "pointer-events-none opacity-60" : ""
        } ${error ? "border-red-500/50" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          disabled={disabled || busy}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />

        {value ? (
          <Image
            src={value}
            alt={label}
            fill
            sizes="(max-width: 640px) 100vw, 320px"
            className="object-cover"
          />
        ) : (
          <span className="flex flex-col items-center gap-2 px-4 text-center">
            <ImagePlus size={22} className="text-white/25" />
            <span className="text-xs text-muted">JPG, PNG, WebP</span>
          </span>
        )}

        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/70">
            <Loader2 size={20} className="animate-spin text-brand" />
          </span>
        )}

        {value && !busy && !disabled && (
          <span className="absolute bottom-2 right-2 rounded-lg bg-ink/80 px-2 py-1 text-[11px] font-semibold text-white/80 backdrop-blur">
            Солих
          </span>
        )}
      </label>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Film file
// ---------------------------------------------------------------------------

function FilmPicker({
  filmId,
  film,
  disabled,
  onUploaded,
}: {
  filmId: string;
  film: ChallengeFilm;
  disabled?: boolean;
  onUploaded: () => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const busy = progress !== null;
  const uploaded = Boolean(film.film_url);

  const pick = (selected: File | null) => {
    setFailed(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const problem = checkFile(selected, "film");
    if (problem) {
      setFailed(problem);
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const send = async () => {
    if (!file) return;
    setFailed(null);
    setProgress(0);

    const result = await uploadChallengeFile({
      file,
      filmId,
      kind: "film",
      onProgress: setProgress,
    });

    setProgress(null);
    if (!result.ok) {
      setFailed(result.message);
      return;
    }

    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    await onUploaded();
  };

  return (
    <div>
      <p className="mb-1.5 block text-xs font-semibold text-white/70">
        Киноны файл<span className="ml-1 text-brand">*</span>
      </p>

      {uploaded && (
        <div className="mb-3 flex items-start gap-3 rounded-xl border border-brand/30 bg-brand/5 p-4">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white">Бүтээл хүлээн авлаа.</p>
            <p className="mt-1 break-all text-[11px] text-muted">{film.film_path}</p>
            {film.film_uploaded_at && (
              <p className="mt-1 text-[11px] text-muted">
                {formatDateTime(film.film_uploaded_at)}
              </p>
            )}
          </div>
        </div>
      )}

      {!disabled && (
        <>
          <label
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-ink px-6 py-8 text-center transition hover:border-brand/40 ${
              busy ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_FILM_TYPES.join(",")}
              className="sr-only"
              disabled={busy}
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            <UploadCloud size={22} className="mb-3 text-white/25" />
            {file ? (
              <>
                <span className="max-w-full break-all text-xs font-bold text-white">
                  {file.name}
                </span>
                <span className="mt-1 text-[11px] text-muted">
                  {formatBytes(file.size)}
                </span>
              </>
            ) : (
              <>
                <span className="text-xs font-semibold text-white/80">
                  {uploaded ? "Бүтээлээ солих" : "Файлаа сонгоно уу"}
                </span>
                <span className="mt-1 text-[11px] text-muted">
                  MP4, MOV, WebM, MKV. Дээд хэмжээ {formatBytes(MAX_FILM_SIZE)}.
                </span>
              </>
            )}

            {busy && file && (
              <span className="mt-5 block w-full">
                <span className="mb-2 flex items-end justify-between">
                  <span className="text-[11px] text-muted">Байршуулж байна…</span>
                  <span className="text-xs font-bold text-brand">{progress}%</span>
                </span>
                <span className="block h-2 w-full overflow-hidden rounded-full border border-white/8 bg-ink-elevated">
                  <span
                    className="block h-full rounded-full bg-brand shadow-[0_0_10px_rgba(34,197,94,0.5)] transition-[width] duration-200 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </span>
              </span>
            )}
          </label>

          {failed && (
            <p className="mt-2 flex items-start gap-2 text-xs text-red-300">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              {failed}
            </p>
          )}

          <button
            type="button"
            onClick={send}
            disabled={!file || busy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 py-3 text-xs font-semibold text-white/80 transition hover:border-brand/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <UploadCloud size={14} />
            )}
            {busy ? "Байршуулж байна…" : "Бичлэг байршуулах"}
          </button>
        </>
      )}
    </div>
  );
}
