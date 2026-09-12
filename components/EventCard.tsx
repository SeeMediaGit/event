"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MapPin, Trophy } from "lucide-react";
import { formatCountdown, formatDateRange } from "@/lib/events/format";
import { eventHref, getEventPhase, type SeeEvent, eventImage } from "@/lib/events/types";
import PhaseBadge from "./PhaseBadge";

export default function EventCard({ event }: { event: SeeEvent }) {
  const phase = getEventPhase(event);
  const image = eventImage(event);
  const countdown =
    phase === "upcoming" ? formatCountdown(event.starts_at) : "";

  return (
    <Link
      // kind = 'challenge' rows lead into the four-step flow; everything else
      // keeps the detail page it has always had.
      href={eventHref(event)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-ink-surface/70 transition hover:border-brand/40 hover:shadow-glow"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-ink-elevated">
        {image ? (
          <Image
            src={image}
            alt={event.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Trophy size={32} className="text-white/15" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-ink-surface to-transparent" />
        <div className="absolute left-3 top-3">
          <PhaseBadge phase={phase} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-base font-bold leading-snug text-white transition group-hover:text-brand-light">
          {event.name}
        </h3>

        {event.subtitle && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted">
            {event.subtitle}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-[11px] text-white/50">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={13} />
            {formatDateRange(event)}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={13} />
              {event.location}
            </span>
          )}
        </div>

        {countdown && (
          <p className="text-[11px] font-semibold text-brand">{countdown}</p>
        )}
      </div>
    </Link>
  );
}
