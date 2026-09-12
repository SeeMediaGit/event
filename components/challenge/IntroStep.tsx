"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Film,
  Image as ImageIcon,
  ListChecks,
  LogIn,
  Ticket,
  Upload,
} from "lucide-react";
import PhaseBadge from "@/components/PhaseBadge";
import { formatDateTime, formatLongDate } from "@/lib/events/format";
import {
  eventImage,
  eventImages,
  getEventPhase,
  isRegistrationOpen,
  parseRules,
  type SeeEvent,
} from "@/lib/events/types";

// three / @react-three/fiber / @react-three/drei land in their own chunk and
// are fetched only when this step renders. ssr: false because WebGL has no
// meaning on the server, and because the component reads matchMedia on mount.
const Hero3D = dynamic(() => import("./hero/Hero3D"), {
  ssr: false,
  loading: () => null,
});

export default function IntroStep({
  event,
  isSignedIn,
  onStart,
  loginHref,
}: {
  event: SeeEvent;
  isSignedIn: boolean;
  onStart: () => void;
  loginHref: string;
}) {
  const [canvasReady, setCanvasReady] = useState(false);

  const phase = getEventPhase(event);
  const registrationOpen = isRegistrationOpen(event);
  const rules = parseRules(event.rules);
  const artwork = eventImage(event);
  // Бүх зураг: [0] нь hero дээр гарсан тул танилцуулгын хэсэг үлдсэнийг зурна.
  const promo = eventImages(event).slice(1);

  return (
    <div className="space-y-8">
      <section className="relative h-[300px] w-full overflow-hidden rounded-2xl border border-white/8 bg-ink-elevated sm:h-[420px]">
        {/* Always painted, always underneath. The canvas fades in over it, so
            there is never a moment where this area is a black square. */}
        {artwork ? (
          <Image
            src={artwork}
            alt={event.name}
            fill
            sizes="(max-width: 1024px) 100vw, 900px"
            priority
            className={`object-cover transition-opacity duration-700 ${
              canvasReady ? "opacity-25" : "opacity-100"
            }`}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand/30 via-brand-dark/10 to-ink" />
        )}

        <div
          className={`absolute inset-0 transition-opacity duration-700 ${
            canvasReady ? "opacity-100" : "opacity-0"
          }`}
        >
          <Hero3D
            posterUrl={artwork}
            coverUrl={eventImages(event)[1] ?? artwork}
            onReady={() => setCanvasReady(true)}
          />
        </div>

        {/* Text sits above the canvas; pointer-events-none keeps the parallax
            responding to the pointer across the whole hero. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-ink via-ink/40 to-transparent p-5 sm:p-8">
          <div className="pointer-events-auto">
            <PhaseBadge phase={phase} />
          </div>
          <h1 className="mt-3 max-w-2xl text-2xl font-black leading-tight text-white sm:text-4xl">
            {event.name}
          </h1>
          {event.subtitle && (
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-white/70 sm:text-sm">
              {event.subtitle}
            </p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoTile
          icon={<CalendarDays size={15} />}
          label="Эхлэх"
          value={formatLongDate(event.starts_at) || "Тодорхойгүй"}
        />
        <InfoTile
          icon={<Clock size={15} />}
          label={registrationOpen ? "Бүртгэл хаагдах" : "Бүртгэл хаагдсан"}
          value={formatDateTime(event.registration_ends_at) || "Тодорхойгүй"}
          highlight={registrationOpen}
        />
        <InfoTile
          icon={<Upload size={15} />}
          label="Бүтээл хүлээн авах"
          value={formatDateTime(event.submission_ends_at) || "Тодорхойгүй"}
        />
        <InfoTile
          icon={<Ticket size={15} />}
          label="Суурь хураамж"
          value={
            event.entry_fee === null
              ? "Төлбөргүй"
              : `${event.entry_fee.toLocaleString("mn-MN")}₮`
          }
        />
      </section>

      {event.description && (
        <section className="rounded-2xl border border-white/8 bg-ink-surface/60 p-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/60">
            <Film size={15} />
            Уралдааны тухай
          </h2>
          {/* Hand-entered text from the SQL editor, rendered as text with
              newlines preserved — never as HTML. */}
          <p className="whitespace-pre-line text-sm leading-relaxed text-white/75">
            {event.description}
          </p>
        </section>
      )}

      {rules.length > 0 && (
        <section className="rounded-2xl border border-white/8 bg-ink-surface/60 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/60">
            <ListChecks size={15} />
            Оролцох болзол
          </h2>
          <ul className="space-y-2.5">
            {rules.map((rule, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-white/75">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                {rule}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Зохион байгуулагчийн зарын хуудсууд. Эхний зураг hero дээр гарсан тул
          энд орохгүй. Дүрмийг текстээр давхардуулахгүй — эдгээр зураг ихэвчлэн
          бүрэн мэдээлэлтэй байдаг. */}
      {promo.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <ImageIcon size={15} />
            Уралдааны зар
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {promo.map((url, i) => (
              <div
                key={url}
                className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/8 bg-ink-elevated"
              >
                <Image
                  src={url}
                  alt={`${event.name} — ${i + 2}`}
                  fill
                  sizes="(max-width: 640px) 100vw, 480px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="relative overflow-hidden rounded-2xl border border-brand/25 bg-brand/5 p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-brand/10 blur-[60px]"
        />
        {isSignedIn ? (
          <>
            <p className="text-sm font-semibold text-white">
              Оролцохын тулд анкетаа бөглөнө үү.
            </p>
            <p className="mt-1 text-xs text-muted">
              Анкетаа түр хадгалаад дараа нь үргэлжлүүлж болно.
            </p>
            <button
              onClick={onStart}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-black shadow-glow transition hover:bg-brand-light"
            >
              Оролцох
              <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-white">
              Оролцохын тулд нэвтэрнэ үү.
            </p>
            <p className="mt-1 text-xs text-muted">
              SeeMedia аппликейшны утас, нууц үгээрээ нэвтэрнэ. Аккаунтгүй бол
              аппликейшнээр бүртгүүлээрэй.
            </p>
            <Link
              href={loginHref}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-black shadow-glow transition hover:bg-brand-light"
            >
              <LogIn size={16} />
              Нэвтэрч оролцох
            </Link>
          </>
        )}
      </section>
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
      <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
        {icon}
        {label}
      </p>
      <p
        className={`text-sm font-semibold ${
          highlight ? "text-brand" : "text-white/85"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
