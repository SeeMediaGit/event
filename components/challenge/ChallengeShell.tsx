"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LogIn, Trophy } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { SeeMediaLogo } from "@/components/Brand";
import { useAuth } from "@/components/AuthProvider";
import { fetchChallengeBySlug } from "@/lib/events/api";
import { fetchMyApplication } from "@/lib/challenge/api";
import {
  isLocked,
  statusRank,
  STATUS_LABEL,
  type ChallengeApplication,
} from "@/lib/challenge/types";
import type { SeeEvent } from "@/lib/events/types";
import ApplicationForm from "./ApplicationForm";
import FeeStep from "./FeeStep";
import IntroStep from "./IntroStep";
import Stepper, { type StepState } from "./Stepper";
import UploadStep from "./UploadStep";

const STEP_LABELS = ["Танилцуулга", "Анкет", "Суурь хураамж", "Бүтээл"];
const FIRST_STEP = 1;
const LAST_STEP = 4;

type Load =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "ready"; event: SeeEvent };

export default function ChallengeShell({ slug }: { slug: string }) {
  const { session, isLoading: authLoading, appUser, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [application, setApplication] = useState<ChallengeApplication | null>(
    null,
  );
  const [appLoaded, setAppLoaded] = useState(false);

  const isSignedIn = Boolean(session);

  // The event read has to wait for the auth check: the same query answers
  // differently for anon and authenticated, and firing it early would fetch as
  // anon and then need doing again.
  useEffect(() => {
    if (authLoading) return;
    let mounted = true;

    fetchChallengeBySlug(slug).then((event) => {
      if (!mounted) return;
      setLoad(event ? { state: "ready", event } : { state: "missing" });
    });

    return () => {
      mounted = false;
    };
  }, [slug, authLoading]);

  const eventId = load.state === "ready" ? load.event.id : null;

  useEffect(() => {
    if (!eventId || !isSignedIn) {
      setAppLoaded(!isSignedIn);
      return;
    }
    let mounted = true;

    fetchMyApplication(eventId).then((row) => {
      if (!mounted) return;
      setApplication(row);
      setAppLoaded(true);
    });

    return () => {
      mounted = false;
    };
  }, [eventId, isSignedIn]);

  // ---------------------------------------------------------------------
  // Step gating
  // ---------------------------------------------------------------------
  const rank = statusRank(application?.status ?? null);

  const lockedReason = useCallback(
    (step: number): string | undefined => {
      if (step === 2 && !isSignedIn) return "Нэвтэрсний дараа нээгдэнэ.";
      if (step === 3 && rank < 1) return "Анкетаа илгээсний дараа нээгдэнэ.";
      if (step === 4 && rank < 2) return "Төлбөр төлсний дараа нээгдэнэ.";
      return undefined;
    },
    [isSignedIn, rank],
  );

  // The step lives in the URL so a refresh, a back button or a shared link all
  // land in the same place. A step the applicant has not unlocked falls back to
  // the furthest one they have, rather than 404-ing or showing a locked screen.
  const requested = Number.parseInt(searchParams.get("step") ?? "", 10);
  const step = useMemo(() => {
    const wanted =
      Number.isFinite(requested) && requested >= FIRST_STEP && requested <= LAST_STEP
        ? requested
        : FIRST_STEP;
    if (!lockedReason(wanted)) return wanted;
    for (let n = wanted - 1; n >= FIRST_STEP; n -= 1) {
      if (!lockedReason(n)) return n;
    }
    return FIRST_STEP;
  }, [requested, lockedReason]);

  const goToStep = useCallback(
    (n: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", String(n));
      // replace, not push: the stepper is one screen with four faces, and
      // stacking every tab click in history would make Back mean "previous tab".
      router.replace(`?${params.toString()}`, { scroll: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [router, searchParams],
  );

  const steps: StepState[] = STEP_LABELS.map((label, i) => {
    const n = i + 1;
    return {
      n,
      label,
      lockedReason: lockedReason(n),
      done:
        n === 1
          ? isSignedIn
          : n === 2
            ? rank >= 1
            : n === 3
              ? rank >= 2
              : rank >= 3,
    };
  });

  // Submitting the application is what unlocks the fee step; move there rather
  // than leaving the applicant on a form that just turned read-only.
  const handleSaved = useCallback(
    (saved: ChallengeApplication) => {
      const wasLocked = isLocked(application?.status ?? null);
      setApplication(saved);
      if (!wasLocked && isLocked(saved.status)) goToStep(3);
    },
    [application, goToStep],
  );

  const loginHref = `/login?next=${encodeURIComponent(`/challenge/${slug}?step=2`)}`;

  const displayName =
    appUser?.full_name?.trim() ||
    appUser?.username?.trim() ||
    appUser?.phone ||
    user?.phone ||
    "";

  return (
    <div className="min-h-screen lg:pl-[88px]">
      <AppSidebar />

      <header className="sticky top-0 z-30 border-b border-white/8 bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <SeeMediaLogo size={32} />
            <span className="hidden text-sm font-black tracking-tight text-white sm:block">
              SeeMedia <span className="font-semibold text-brand">Events</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {application && (
              <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/70">
                {STATUS_LABEL[application.status]}
              </span>
            )}
            {displayName && (
              <span className="hidden text-xs text-muted sm:block">
                {displayName}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-8 lg:pb-14">
        {/* The application read only gates the UI once there is an event to
            read it for — otherwise a missing event would leave a signed-in
            visitor on the skeleton forever, since appLoaded never flips. */}
        {load.state === "loading" ||
        (load.state === "ready" && isSignedIn && !appLoaded) ? (
          <ChallengeSkeleton />
        ) : load.state === "missing" ? (
          <MissingCard isSignedIn={isSignedIn} loginHref={loginHref} />
        ) : (
          <>
            <div className="mb-7">
              <Stepper steps={steps} current={step} onSelect={goToStep} />
            </div>

            {step === 1 && (
              <IntroStep
                event={load.event}
                isSignedIn={isSignedIn}
                loginHref={loginHref}
                onStart={() => goToStep(2)}
              />
            )}
            {step === 2 && (
              <ApplicationForm
                event={load.event}
                application={application}
                onSaved={handleSaved}
              />
            )}
            {step === 3 && (
              <FeeStep event={load.event} application={application} />
            )}
            {step === 4 && (
              <UploadStep
                event={load.event}
                application={application}
                onUploaded={setApplication}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// Two different reasons the event can be absent, and they need different words.
// For a signed-out visitor the likeliest cause is that
// 20260908_events_anon_challenge_read.sql has not been applied yet, in which
// case PostgREST returns an empty set rather than an error — signing in makes
// the row visible through the authenticated policy that has always existed.
function MissingCard({
  isSignedIn,
  loginHref,
}: {
  isSignedIn: boolean;
  loginHref: string;
}) {
  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
        <LogIn size={30} className="mb-4 text-white/20" />
        <p className="text-sm font-semibold text-white/80">Нэвтэрч үзнэ үү</p>
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted">
          Энэ уралдааны мэдээллийг харахын тулд SeeMedia аккаунтаараа нэвтэрнэ
          үү.
        </p>
        <Link
          href={loginHref}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-black shadow-glow transition hover:bg-brand-light"
        >
          <LogIn size={16} />
          Нэвтрэх
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
      <Trophy size={30} className="mb-4 text-white/20" />
      <p className="text-sm font-semibold text-white/80">
        Ийм уралдаан олдсонгүй
      </p>
      <p className="mt-1.5 text-xs text-muted">
        Устгагдсан эсвэл хараахан нээгдээгүй байж болно.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
      >
        Бүх уралдаан
      </Link>
    </div>
  );
}

function ChallengeSkeleton() {
  return (
    <div className="space-y-7">
      {/* Mirrors the real stepper, in both of its shapes: the compact bar on a
          phone, the numbered row from sm up. */}
      <div className="sm:hidden">
        <div className="h-[60px] w-full animate-pulse rounded-2xl bg-white/5" />
        <div className="mt-2 flex gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-1 flex-1 animate-pulse rounded-full bg-white/5" />
          ))}
        </div>
      </div>
      <div className="relative hidden items-start justify-between sm:flex">
        <span className="absolute left-0 top-4 h-px w-full bg-white/10" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="relative z-10 flex flex-col items-center gap-2 bg-ink px-3"
          >
            <div className="h-8 w-8 animate-pulse rounded-full bg-white/5" />
            <div className="h-3 w-16 animate-pulse rounded bg-white/5" />
          </div>
        ))}
      </div>
      <div className="h-[300px] w-full animate-pulse rounded-2xl bg-white/5 sm:h-[420px]" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[86px] animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
      <div className="h-40 w-full animate-pulse rounded-2xl bg-white/5" />
    </div>
  );
}
