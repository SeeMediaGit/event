"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Clock, MapPin, Trophy } from "lucide-react";
import { fetchEventById } from "@/lib/events/api";
import { formatDateRange, formatDateTime, formatLongDate } from "@/lib/events/format";
import {
  eventImage,
  getEventPhase,
  isRegistrationOpen,
  type SeeEvent,
} from "@/lib/events/types";
import PhaseBadge from "./PhaseBadge";

type State =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "ready"; event: SeeEvent };

export default function EventDetail({ eventId }: { eventId: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let mounted = true;
    fetchEventById(eventId).then((event) => {
      if (!mounted) return;
      setState(event ? { status: "ready", event } : { status: "not_found" });
    });
    return () => {
      mounted = false;
    };
  }, [eventId]);

  // A skeleton, not a spinner. A spinner says "something is happening"; a
  // skeleton says "the page will look like this", and it does not move the
  // layout when the real content lands.
  if (state.status === "loading") return <EventDetailSkeleton />;

  if (state.status === "not_found") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <Trophy size={32} className="mb-4 text-white/20" />
        <p className="text-sm font-semibold text-white/80">
          Ийм тэмцээн олдсонгүй
        </p>
        <p className="mt-1 text-xs text-muted">
          Устгагдсан эсвэл хараахан нээгдээгүй байж болно.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
        >
          <ArrowLeft size={14} />
          Жагсаалт руу буцах
        </Link>
      </div>
    );
  }

  const { event } = state;
  const phase = getEventPhase(event);
  const registrationOpen = isRegistrationOpen(event);
  const hero = eventImage(event);

  return (
    <article>
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-muted transition hover:text-white"
      >
        <ArrowLeft size={14} />
        Бүх тэмцээн
      </Link>

      {hero && (
        <div className="relative mb-8 aspect-[21/9] w-full overflow-hidden rounded-2xl border border-white/8 bg-ink-elevated">
          <Image
            src={hero}
            alt={event.name}
            fill
            sizes="(max-width: 1024px) 100vw, 1024px"
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
        </div>
      )}

      <div className="mb-3">
        <PhaseBadge phase={phase} />
      </div>

      <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl">
        {event.name}
      </h1>

      {event.subtitle && (
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          {event.subtitle}
        </p>
      )}

      <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InfoTile
          icon={<CalendarDays size={15} />}
          label="Хугацаа"
          value={formatDateRange(event)}
        />
        {event.location && (
          <InfoTile
            icon={<MapPin size={15} />}
            label="Байршил"
            value={event.location}
          />
        )}
        {event.registration_ends_at && (
          <InfoTile
            icon={<Clock size={15} />}
            label={registrationOpen ? "Бүртгэл хаагдах" : "Бүртгэл хаагдсан"}
            value={formatDateTime(event.registration_ends_at)}
            highlight={registrationOpen}
          />
        )}
      </dl>

      {event.description && (
        <div className="mt-10 rounded-2xl border border-white/8 bg-ink-surface/60 p-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/60">
            Дэлгэрэнгүй
          </h2>
          {/* Plain text from the DB, rendered with newlines preserved. Kept as
              text rather than HTML on purpose: the description is typed into
              Supabase by hand, and dangerouslySetInnerHTML on hand-entered
              content is how XSS gets in. */}
          <p className="whitespace-pre-line text-sm leading-relaxed text-white/75">
            {event.description}
          </p>
        </div>
      )}

      {event.starts_at && (
        <p className="mt-8 text-xs text-muted">
          Эхлэх: {formatLongDate(event.starts_at)}
        </p>
      )}
    </article>
  );
}

function EventDetailSkeleton() {
  return (
    <div>
      <div className="mb-6 h-4 w-28 animate-pulse rounded bg-white/5" />
      <div className="mb-8 aspect-[21/9] w-full animate-pulse rounded-2xl bg-white/5" />
      <div className="mb-3 h-6 w-24 animate-pulse rounded-full bg-white/5" />
      <div className="h-9 w-3/4 animate-pulse rounded bg-white/5 sm:h-11" />
      <div className="mt-3 h-4 w-full animate-pulse rounded bg-white/5" />
      <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-white/5" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[86px] animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
      <div className="mt-10 h-44 w-full animate-pulse rounded-2xl bg-white/5" />
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-ink-surface/60 p-4">
      <dt className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
        {icon}
        {label}
      </dt>
      <dd
        className={`text-sm font-semibold ${
          highlight ? "text-brand" : "text-white/85"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
