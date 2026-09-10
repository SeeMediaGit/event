"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Clapperboard,
  Clock,
  FileVideo,
  Loader2,
  Plus,
  Video,
} from "lucide-react";
import { createFilm, fetchMyFilms } from "@/lib/challenge/films/api";
import { buildFilmFields, EMPTY_FILM_FORM } from "@/lib/challenge/films/form";
import {
  FILM_STATUS_LABEL,
  type ChallengeFilm,
} from "@/lib/challenge/films/types";
import type { ChallengeApplication } from "@/lib/challenge/types";
import { formatDateTime } from "@/lib/events/format";
import { isSubmissionOpen, type SeeEvent } from "@/lib/events/types";
import FilmForm from "./FilmForm";

// Step 4. One entrant, many films — the whole point of
// 20260910_challenge_films_and_payments.sql. This screen has two faces: the
// list of everything sent so far, and one film's form. They are the same route
// rather than two, because a film is only ever reached from its own list.
export default function FilmsStep({
  event,
  application,
}: {
  event: SeeEvent;
  application: ChallengeApplication | null;
}) {
  const [films, setFilms] = useState<ChallengeFilm[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ChallengeFilm | null>(null);
  const [creating, setCreating] = useState(false);

  const applicationId = application?.id ?? null;
  const open = isSubmissionOpen(event);

  useEffect(() => {
    if (!applicationId) {
      setFilms([]);
      return;
    }
    let mounted = true;

    fetchMyFilms(applicationId).then((result) => {
      if (!mounted) return;
      if (result.ok) {
        setFilms(result.films);
        setError(null);
      } else {
        setFilms([]);
        setError(result.message);
      }
    });

    return () => {
      mounted = false;
    };
  }, [applicationId]);

  // Adding a film creates the empty draft row first, then opens the form on it.
  // The form needs a real id before it can accept a poster: the upload route
  // files bytes under the film's id, and there is no such thing as an upload
  // that belongs to a row that does not exist yet.
  const addFilm = useCallback(async () => {
    if (!applicationId || creating) return;
    setError(null);
    setCreating(true);

    const result = await createFilm(
      applicationId,
      event.id,
      buildFilmFields(EMPTY_FILM_FORM),
      "draft",
    );
    setCreating(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    setFilms((prev) => [...(prev ?? []), result.film]);
    setEditing(result.film);
  }, [applicationId, creating, event.id]);

  const handleSaved = useCallback((saved: ChallengeFilm) => {
    setFilms((prev) =>
      (prev ?? []).map((f) => (f.id === saved.id ? saved : f)),
    );
    setEditing((prev) => (prev && prev.id === saved.id ? saved : prev));
  }, []);

  const handleDeleted = useCallback((filmId: string) => {
    setFilms((prev) => (prev ?? []).filter((f) => f.id !== filmId));
  }, []);

  if (!application) {
    return (
      <Empty
        icon={<Clapperboard size={30} className="mb-4 text-white/20" />}
        title="Анкет олдсонгүй"
        note="Эхлээд анкетаа бөглөж илгээнэ үү."
      />
    );
  }

  if (editing) {
    return (
      <FilmForm
        event={event}
        applicationId={application.id}
        film={editing}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        onClose={() => setEditing(null)}
      />
    );
  }

  const limit = event.max_films_per_user;
  const count = films?.length ?? 0;
  // The limit is enforced here and in the route, not in a policy: counting rows
  // inside RLS would re-scan every film on each insert. See the column comment
  // in 20260910_challenge_films_and_payments.sql.
  const atLimit = limit !== null && count >= limit;

  return (
    <div className="space-y-5">
      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">Миний кинонууд</h2>
          <p className="mt-1 text-xs text-muted">
            {limit === null
              ? "Хэдэн ч кино оруулж болно."
              : `${count} / ${limit} кино.`}
            {event.submission_ends_at && open && (
              <>
                {" "}
                Эцсийн хугацаа:{" "}
                <span className="font-semibold text-white/80">
                  {formatDateTime(event.submission_ends_at)}
                </span>
              </>
            )}
          </p>
        </div>

        {open && !atLimit && (
          <button
            type="button"
            onClick={addFilm}
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-black shadow-glow transition hover:bg-brand-light disabled:opacity-50"
          >
            {creating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Кино нэмэх
          </button>
        )}
      </div>

      {!open && (
        <p className="flex items-start gap-2 rounded-xl border border-white/12 bg-white/[0.02] px-4 py-3 text-xs text-white/75">
          <Clock size={14} className="mt-0.5 shrink-0 text-white/40" />
          Бүтээл хүлээн авах хугацаа дууссан
          {event.submission_ends_at
            ? ` (${formatDateTime(event.submission_ends_at)})`
            : ""}
          . Одоо байгаа кинонуудаа харах боломжтой.
        </p>
      )}

      {atLimit && open && (
        <p className="flex items-start gap-2 rounded-xl border border-white/12 bg-white/[0.02] px-4 py-3 text-xs text-white/75">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-white/40" />
          Энэ уралдаанд нэг оролцогч дээд тал нь {limit} кино оруулна.
        </p>
      )}

      {films === null ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : films.length === 0 ? (
        <Empty
          icon={<Video size={30} className="mb-4 text-white/20" />}
          title="Кино алга"
          note="«Кино нэмэх» дарж эхний бүтээлээ бүртгүүлнэ үү."
        />
      ) : (
        <div className="space-y-3">
          {films.map((film) => (
            <FilmRow key={film.id} film={film} onOpen={() => setEditing(film)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilmRow({
  film,
  onOpen,
}: {
  film: ChallengeFilm;
  onOpen: () => void;
}) {
  const hasVideo = Boolean(film.film_url);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-2xl border border-white/8 bg-ink-surface/60 p-3 text-left transition hover:border-brand/25 sm:p-4"
    >
      <span className="relative h-[72px] w-[48px] shrink-0 overflow-hidden rounded-lg border border-white/8 bg-ink">
        {film.poster_url ? (
          <Image
            src={film.poster_url}
            alt={film.title ?? "Постер"}
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <FileVideo size={16} className="text-white/20" />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-white">
          {film.title || "Нэргүй кино"}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {[film.director, film.release_year, film.duration_minutes && `${film.duration_minutes} мин`]
            .filter(Boolean)
            .join(" · ") || "Мэдээлэл дутуу"}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70">
            {FILM_STATUS_LABEL[film.status]}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              hasVideo
                ? "border border-brand/30 bg-brand/10 text-brand-light"
                : "border border-white/10 bg-white/5 text-white/50"
            }`}
          >
            {hasVideo ? "Бичлэг орсон" : "Бичлэг ороогүй"}
          </span>
        </span>
      </span>
    </button>
  );
}

function Empty({
  icon,
  title,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
      {icon}
      <p className="text-sm font-semibold text-white/80">{title}</p>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted">{note}</p>
    </div>
  );
}
