"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FileText, Hash } from "lucide-react";
import {
  fetchMyApplications,
  type ApplicationSummary,
} from "@/lib/challenge/api";
import { STATUS_LABEL, statusRank } from "@/lib/challenge/types";
import { formatDateTime } from "@/lib/events/format";
import { eventImage } from "@/lib/events/types";

// Everything the signed-in user has applied to. RLS scopes the table to their
// own rows, so there is no user filter here and no way for this list to widen.
export default function MyApplications() {
  const [rows, setRows] = useState<ApplicationSummary[] | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchMyApplications().then((data) => {
      if (mounted) setRows(data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (rows === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
        <FileText size={30} className="mb-4 text-white/20" />
        <p className="text-sm font-semibold text-white/80">Өргөдөл алга</p>
        <p className="mt-1 text-xs text-muted">
          Уралдаанд бүртгүүлснээр анкет тань энд харагдана.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
        >
          Уралдаан үзэх
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        // An application whose event row is gone (unpublished, or the anon /
        // authenticated policy no longer matches) still has to render — it is
        // the applicant's own record.
        const href = row.event?.slug
          ? `/challenge/${row.event.slug}`
          : `/events/${row.event_id}`;

        return (
          <Link
            key={row.id}
            href={href}
            className="group flex items-center gap-4 rounded-2xl border border-white/8 bg-ink-surface/70 p-4 transition hover:border-brand/40"
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-ink-elevated">
              {row.event && eventImage(row.event) ? (
                <Image
                  src={eventImage(row.event)!}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <FileText size={18} className="text-white/20" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white transition group-hover:text-brand-light">
                {row.event?.name ?? "Уралдаан"}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/50">
                <span
                  className={
                    statusRank(row.status) >= 2
                      ? "font-semibold text-brand"
                      : "font-semibold text-white/70"
                  }
                >
                  {STATUS_LABEL[row.status]}
                </span>
                {row.registration_no && (
                  <span className="inline-flex items-center gap-1">
                    <Hash size={11} />
                    {row.registration_no}
                  </span>
                )}
                <span>
                  {row.submitted_at
                    ? `Илгээсэн: ${formatDateTime(row.submitted_at)}`
                    : `Шинэчилсэн: ${formatDateTime(row.updated_at)}`}
                </span>
              </p>
            </div>

            <ArrowRight
              size={16}
              className="shrink-0 text-white/25 transition group-hover:text-brand"
            />
          </Link>
        );
      })}
    </div>
  );
}
