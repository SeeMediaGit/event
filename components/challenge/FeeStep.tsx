"use client";

import { CreditCard, Hash, Info } from "lucide-react";
import { formatDateTime } from "@/lib/events/format";
import type { SeeEvent } from "@/lib/events/types";
import { statusRank, type ChallengeApplication } from "@/lib/challenge/types";

// Step 3. The amount is read from the event row, never entered or sent by the
// browser: pricing is the organiser's, and a client that can name its own fee
// is a client that will. QPay itself is out of scope for this task — the row's
// status goes to 'paid' from the payment callback under the service role, which
// is also what assigns registration_no.
export default function FeeStep({
  event,
  application,
}: {
  event: SeeEvent;
  application: ChallengeApplication | null;
}) {
  const paid = statusRank(application?.status ?? null) >= 2;
  const fee =
    event.entry_fee === null
      ? "Төлбөргүй"
      : `${event.entry_fee.toLocaleString("mn-MN")}₮`;

  if (paid) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-brand/30 bg-brand/5 p-6 text-center sm:p-10">
          <p className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand">
            <Hash size={13} />
            Бүртгэлийн дугаар
          </p>
          <p className="mt-3 break-all text-3xl font-black tracking-tight text-white sm:text-5xl">
            {application?.registration_no ?? "—"}
          </p>
          <p className="mt-4 text-xs text-muted">
            Энэ дугаараар таны бүтээл бүртгэгдэнэ. Хадгалж авна уу.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Tile label="Төлсөн дүн" value={fee} />
          <Tile
            label="Төлсөн огноо"
            value={formatDateTime(application?.paid_at ?? null) || "—"}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/8 bg-ink-surface/60 p-6 sm:p-8">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          <CreditCard size={13} />
          Суурь хураамж
        </p>
        <p className="mt-3 text-4xl font-black tracking-tight text-white">
          {fee}
        </p>
        {event.entry_fee !== null && (
          <p className="mt-2 text-xs text-muted">
            Анкет хүлээн авагдсаны дараа нэг удаа төлнө.
          </p>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-6">
        <Info size={16} className="mt-0.5 shrink-0 text-white/30" />
        <div>
          <p className="text-sm font-semibold text-white/80">
            Төлбөрийн хэсэг удахгүй нээгдэнэ.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Төлбөр төлөх боломж нээгдэхэд энэ хуудсанд QPay-ийн код гарч ирнэ.
            Төлбөр баталгаажмагц бүртгэлийн дугаар тань энд харагдана.
          </p>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-ink-surface/60 p-4">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className="text-sm font-semibold text-white/85">{value}</p>
    </div>
  );
}
