"use client";

import { Clapperboard, Info } from "lucide-react";
import { formatDateTime } from "@/lib/events/format";
import type { SeeEvent } from "@/lib/events/types";

// Step 4. A placeholder on purpose: there is no table for submissions yet, and
// the upload itself will not go through Vercel when it arrives — a 4–5 GB file
// cannot pass a serverless function's 4.5 MB body limit, so the browser will
// talk to Bunny directly with a signed ticket (ARCHITECTURE.md §7).
export default function UploadStep({ event }: { event: SeeEvent }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center">
        <Clapperboard size={30} className="mb-4 text-white/20" />
        <p className="text-sm font-semibold text-white/80">
          Upload хэсэг удахгүй нээгдэнэ.
        </p>
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted">
          Бүтээлээ илгээх боломж нээгдэхэд энэ хуудсанд файл оруулах талбар гарч
          ирнэ.
        </p>
      </div>

      {event.submission_ends_at && (
        <div className="flex items-start gap-3 rounded-xl border border-white/8 bg-ink-surface/60 p-4">
          <Info size={15} className="mt-0.5 shrink-0 text-white/30" />
          <p className="text-xs leading-relaxed text-white/70">
            Бүтээл хүлээн авах эцсийн хугацаа:{" "}
            <span className="font-semibold text-white">
              {formatDateTime(event.submission_ends_at)}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
