"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Clapperboard,
  Clock,
  FileVideo,
  Hash,
  Loader2,
  Plus,
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

  const router = useRouter();
  const searchParams = useSearchParams();
  const wantsAdd = searchParams.get("add") === "1";
  // One-shot: the flag is consumed on arrival and stripped from the URL, so a
  // refresh or a Back does not silently create another empty draft.
  const consumedAdd = useRef(false);

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

  // "Эхний киногоо нэмэх" on the payment screen lands here with ?add=1.
  useEffect(() => {
    if (!wantsAdd || consumedAdd.current) return;
    if (!applicationId || films === null || !open) return;
    consumedAdd.current = true;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("add");
    router.replace(`?${params.toString()}`, { scroll: false });

    void addFilm();
    // addFilm is stable enough for this one-shot; adding it would re-run the
    // effect on every films change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsAdd, applicationId, films, open]);

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
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-sm font-bold text-white">Миний кинонууд</h2>
            {/* The number lived only on the fee step, so anyone coming back had
                to walk backwards through the stepper to find it. */}
            {application.registration_no && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-brand/30 bg-brand/10 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider text-brand-light">
                <Hash size={11} />
                {application.registration_no}
              </span>
            )}
          </div>
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

      {/* Grid, not a list: in a film competition the poster is the content, and
          a 48px thumbnail in a row throws it away. */}
      {films === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {films.map((film) => (
            <FilmCard key={film.id} film={film} onOpen={() => setEditing(film)} />
          ))}

          {open && !atLimit && (
            <button
              type="button"
              onClick={addFilm}
              disabled={creating}
              className="flex aspect-[2/3] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 text-center transition hover:border-brand/40 hover:bg-brand/[0.03] disabled:opacity-50"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-ink text-white/40">
                {creating ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Plus size={18} />
                )}
              </span>
              <span className="text-xs font-semibold text-white/80">
                {films.length === 0 ? "Эхний киногоо нэмэх" : "Кино нэмэх"}
              </span>
              <span className="text-[11px] leading-relaxed text-muted">
                Постер, мэдээлэл, бичлэг
              </span>
            </button>
          )}
        </div>
      )}

      {films !== null && films.length === 0 && !open && (
        <Empty
          icon={<Clapperboard size={30} className="mb-4 text-white/20" />}
          title="Кино алга"
          note="Бүтээл хүлээн авах хугацаа дууссан тул шинээр нэмэх боломжгүй."
        />
      )}
    </div>
  );
}

function FilmCard({
  film,
  onOpen,
}: {
  film: ChallengeFilm;
  onOpen: () => void;
}) {
  // film_url is written when the upload ticket is issued, before any bytes
  // exist — only film_status says whether there is a playable stream.
  const hasVideo = film.film_status === "ready";
  const incomplete = !film.title || !film.poster_url;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex aspect-[2/3] flex-col justify-end overflow-hidden rounded-2xl border border-white/8 bg-ink-surface/60 text-left transition hover:border-brand/30"
    >
      {film.poster_url ? (
        <Image
          src={film.poster_url}
          alt={film.title ?? "Постер"}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center bg-ink-elevated">
          <FileVideo size={26} className="text-white/15" />
        </span>
      )}

      {/* Bottom-up scrim so the title stays readable over any poster. */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent" />

      <span className="relative space-y-1.5 p-3">
        <span className="block truncate text-sm font-bold text-white">
          {film.title || "Нэргүй кино"}
        </span>
        <span className="block truncate text-[11px] text-white/60">
          {[
            film.director,
            film.release_year,
            film.duration_minutes && `${film.duration_minutes} мин`,
          ]
            .filter(Boolean)
            .join(" · ") || "Мэдээлэл дутуу"}
        </span>

        <span className="flex flex-wrap items-center gap-1">
          <span className="rounded-full border border-white/15 bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur">
            {FILM_STATUS_LABEL[film.status]}
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur ${
              hasVideo
                ? "border border-brand/40 bg-brand/15 text-brand-light"
                : film.film_status === "failed"
                  ? "border border-red-500/40 bg-red-500/15 text-red-300"
                  : "border border-white/15 bg-black/50 text-white/60"
            }`}
          >
            {hasVideo
              ? "Бичлэг орсон"
              : film.film_status === "processing"
                ? "Боловсруулж байна"
                : film.film_status === "failed"
                  ? "Амжилтгүй"
                  : "Бичлэг ороогүй"}
          </span>
          {film.trailer_status === "ready" && (
            <span className="rounded-full border border-white/15 bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white/70 backdrop-blur">
              Трейлэртэй
            </span>
          )}
        </span>
      </span>

      {incomplete && (
        <span className="absolute right-2 top-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 backdrop-blur">
          Дутуу
        </span>
      )}
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
