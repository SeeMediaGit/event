"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarX } from "lucide-react";
import { fetchEvents } from "@/lib/events/api";
import { getEventPhase, type EventPhase, type SeeEvent } from "@/lib/events/types";
import EventCard from "./EventCard";
import EventListSkeleton from "./EventListSkeleton";

// Ongoing competitions matter most, then the ones about to open, then the
// archive. Within a group the server's ordering (sort_order, then start date)
// is preserved.
const SECTIONS: { phase: EventPhase; title: string }[] = [
  { phase: "ongoing", title: "Явагдаж байна" },
  { phase: "upcoming", title: "Удахгүй" },
  { phase: "undated", title: "Бусад" },
  { phase: "finished", title: "Дууссан" },
];

export default function EventList() {
  const [events, setEvents] = useState<SeeEvent[] | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchEvents().then((rows) => {
      if (mounted) setEvents(rows);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<EventPhase, SeeEvent[]>();
    for (const event of events ?? []) {
      const phase = getEventPhase(event);
      const bucket = map.get(phase);
      if (bucket) bucket.push(event);
      else map.set(phase, [event]);
    }
    return map;
  }, [events]);

  if (events === null) return <EventListSkeleton />;

  if (events.length === 0) {
    return (
      // Sized to its own content rather than stretched to the grid's full
      // width: an empty state as wide as three cards reads as a broken layout,
      // not as "nothing here yet".
      <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
        <CalendarX size={32} className="mb-4 text-white/20" />
        <p className="text-sm font-semibold text-white/80">
          Одоогоор нээлттэй уралдаан тэмцээн алга
        </p>
        <p className="mt-1 text-xs text-muted">
          Шинэ тэмцээн зарлагдмагц энд харагдана.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {SECTIONS.map(({ phase, title }) => {
        const rows = grouped.get(phase);
        if (!rows?.length) return null;

        return (
          <section key={phase}>
            <h2 className="mb-4 flex items-center gap-3 text-sm font-bold uppercase tracking-wider text-white/60">
              {title}
              <span className="text-xs font-semibold text-white/25">
                {rows.length}
              </span>
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
