"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Hash,
  Loader2,
  QrCode,
  RefreshCw,
} from "lucide-react";
import {
  checkPaymentStatus,
  createPaymentInvoice,
  type PaymentInvoice,
} from "@/lib/challenge/payment";
import { statusRank, type ChallengeApplication } from "@/lib/challenge/types";
import { formatDateTime } from "@/lib/events/format";
import type { SeeEvent } from "@/lib/events/types";

// Step 3. The amount is read from the event row by the edge function, never
// entered or sent by the browser: pricing is the organiser's, and a client that
// can name its own fee is a client that will.
//
// Both the invoice and its confirmation live in edge functions
// (challenge-payment-create / challenge-payment-callback) rather than in a Next
// route, so the mobile app runs the identical flow. When the callback confirms
// payment it also assigns registration_no and sends the e-barimt.
const POLL_MS = 4000;

export default function FeeStep({
  event,
  application,
  onPaid,
}: {
  event: SeeEvent;
  application: ChallengeApplication | null;
  onPaid: () => void;
}) {
  const [invoice, setInvoice] = useState<PaymentInvoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paid = statusRank(application?.status ?? null) >= 2;
  const fee =
    event.entry_fee === null || event.entry_fee === 0
      ? "Төлбөргүй"
      : `${event.entry_fee.toLocaleString("mn-MN")}₮`;

  // Kept in a ref so the polling effect below does not restart every time the
  // parent re-renders with a new callback identity.
  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  const start = useCallback(async () => {
    setError(null);
    setLoading(true);
    const result = await createPaymentInvoice(event.id);
    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      // "Already paid" is not an error the entrant can act on — the row simply
      // moved on without this tab noticing. Re-read and let the step unlock.
      if (result.alreadyPaid) onPaidRef.current();
      return;
    }
    if ("free" in result) {
      onPaidRef.current();
      return;
    }
    setInvoice(result.invoice);
  }, [event.id]);

  const check = useCallback(
    async (silent = false) => {
      if (!invoice) return;
      if (!silent) setChecking(true);
      const status = await checkPaymentStatus(invoice.transactionId);
      if (!silent) setChecking(false);

      if (status === "paid") {
        onPaidRef.current();
        return;
      }
      if (!silent) {
        setError("Төлбөр хараахан баталгаажаагүй байна. Түр хүлээгээд дахин шалгана уу.");
      }
    },
    [invoice],
  );

  // Poll while a QR is on screen. QPay calls the callback itself, but its
  // callback can be late or lost — and the entrant is sitting here watching, so
  // asking every few seconds is what makes the screen feel finished.
  useEffect(() => {
    if (!invoice || paid) return;
    const id = setInterval(() => void check(true), POLL_MS);
    return () => clearInterval(id);
  }, [invoice, paid, check]);

  // ---------------------------------------------------------------------
  // Paid
  // ---------------------------------------------------------------------
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

        <p className="flex items-start gap-2 rounded-xl border border-white/12 bg-white/[0.02] px-4 py-3 text-xs text-white/70">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-brand" />
          И-баримт таны бүртгэлтэй и-мэйл хаяг руу илгээгдсэн.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Not paid
  // ---------------------------------------------------------------------
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/8 bg-ink-surface/60 p-6 sm:p-8">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          <CreditCard size={13} />
          Суурь хураамж
        </p>
        <p className="mt-3 text-4xl font-black tracking-tight text-white">{fee}</p>
        <p className="mt-2 text-xs text-muted">
          Анкет хүлээн авагдсаны дараа нэг удаа төлнө. Төлбөр баталгаажмагц
          бүртгэлийн дугаар тань энд гарч ирнэ.
        </p>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {!invoice ? (
        <button
          type="button"
          onClick={start}
          disabled={loading || !application}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-bold text-black shadow-glow transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <QrCode size={16} />
          )}
          {loading ? "Нэхэмжлэх үүсгэж байна…" : "QPay-ээр төлөх"}
        </button>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/8 bg-ink-surface/60 p-5 text-center sm:p-6">
            <p className="text-xs font-semibold text-white/80">
              QPay аппаараа уншуулна уу
            </p>

            {invoice.qrImage && (
              // Bunny/Supabase are the only remote hosts configured for
              // next/image; the QR arrives as a base64 data URL, so it goes
              // through a plain <img> instead.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  invoice.qrImage.startsWith("data:")
                    ? invoice.qrImage
                    : `data:image/png;base64,${invoice.qrImage}`
                }
                alt="QPay QR"
                className="mx-auto mt-4 h-56 w-56 rounded-xl bg-white p-3"
              />
            )}

            <p className="mt-4 text-2xl font-black text-white">
              {invoice.amount.toLocaleString("mn-MN")}₮
            </p>
          </div>

          {invoice.urls.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-white/70">
                Эсвэл банкны аппаа сонгоно уу
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {invoice.urls.map((bank) => (
                  <a
                    key={bank.name}
                    href={bank.link}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink px-3 py-2.5 text-xs font-semibold text-white/80 transition hover:border-brand/40 hover:text-white"
                  >
                    {bank.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={bank.logo}
                        alt=""
                        className="h-5 w-5 shrink-0 rounded"
                      />
                    )}
                    <span className="truncate">{bank.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => void check(false)}
            disabled={checking}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 py-3.5 text-sm font-semibold text-white/80 transition hover:border-brand/40 hover:text-white disabled:opacity-50"
          >
            {checking ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Төлбөрөө шалгах
          </button>

          <p className="text-center text-[11px] text-muted">
            Төлбөр хийсний дараа энэ хуудас өөрөө шинэчлэгдэнэ.
          </p>
        </div>
      )}
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
