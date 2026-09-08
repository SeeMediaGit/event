"use client";

import { Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";

export type StepState = {
  n: number;
  label: string;
  // Filled in when the step cannot be opened yet — shown as the tooltip and
  // announced to screen readers, so a locked step always says *why*.
  lockedReason?: string;
  done: boolean;
};

// Two shapes, one state. From `sm` up it is the numbered row with labels
// underneath; on a phone that row needed a 560px scroller — four Mongolian
// labels do not fit in 375px — and a stepper the user has to swipe sideways to
// read is not a stepper. The phone gets a compact bar instead: prev / next
// arrows, the current step's name, and a four-segment progress track that says
// where they are without spelling out every stop.
export default function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: StepState[];
  current: number;
  onSelect: (n: number) => void;
}) {
  return (
    <>
      <MobileStepper steps={steps} current={current} onSelect={onSelect} />
      <WideStepper steps={steps} current={current} onSelect={onSelect} />
    </>
  );
}

function MobileStepper({
  steps,
  current,
  onSelect,
}: {
  steps: StepState[];
  current: number;
  onSelect: (n: number) => void;
}) {
  const active = steps.find((s) => s.n === current) ?? steps[0];
  // Only steps that are actually open can be stepped to; the arrows skip a
  // locked one rather than landing on a screen that refuses to render.
  const prev = [...steps]
    .reverse()
    .find((s) => s.n < current && !s.lockedReason);
  const next = steps.find((s) => s.n > current && !s.lockedReason);

  return (
    <nav aria-label="Алхмууд" className="sm:hidden">
      <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-ink-surface/60 p-2">
        <ArrowButton
          direction="prev"
          target={prev}
          onSelect={onSelect}
          label="Өмнөх алхам"
        />

        <div className="min-w-0 flex-1 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Алхам {current} / {steps.length}
          </p>
          <p className="truncate text-sm font-bold text-white">
            {active?.label}
          </p>
        </div>

        <ArrowButton
          direction="next"
          target={next}
          onSelect={onSelect}
          label="Дараагийн алхам"
        />
      </div>

      {/* Segmented track: done is solid brand, the current step is a dimmer
          brand, and anything still locked stays grey. */}
      <ol className="mt-2 flex gap-1.5" aria-hidden="true">
        {steps.map((step) => (
          <li
            key={step.n}
            className={`h-1 flex-1 rounded-full transition ${
              step.done
                ? "bg-brand"
                : step.n === current
                  ? "bg-brand/45"
                  : "bg-white/10"
            }`}
          />
        ))}
      </ol>
    </nav>
  );
}

// 44px square — the whole arrow is the target, not just the 16px glyph.
function ArrowButton({
  direction,
  target,
  onSelect,
  label,
}: {
  direction: "prev" | "next";
  target: StepState | undefined;
  onSelect: (n: number) => void;
  label: string;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!target}
      onClick={() => target && onSelect(target.n)}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/70 transition active:bg-white/5 disabled:border-white/5 disabled:text-white/15"
    >
      <Icon size={18} />
    </button>
  );
}

// A numbered circle with its label underneath, sitting on a single connector
// line that runs the width of the row. Each circle punches a hole in that line
// with its own `bg-ink` padding, which is what keeps the line from crossing the
// markers without needing per-segment divs.
function WideStepper({
  steps,
  current,
  onSelect,
}: {
  steps: StepState[];
  current: number;
  onSelect: (n: number) => void;
}) {
  return (
    <nav aria-label="Алхмууд" className="hidden w-full sm:block">
      <ol className="relative flex items-start justify-between">
        <span
          aria-hidden="true"
          className="absolute left-0 top-4 h-px w-full -translate-y-1/2 bg-white/10"
        />

        {steps.map((step) => {
          const locked = Boolean(step.lockedReason);
          const active = step.n === current;

          return (
            <li key={step.n} className="relative z-10 bg-ink px-3">
              <button
                type="button"
                disabled={locked}
                onClick={() => onSelect(step.n)}
                title={step.lockedReason}
                aria-current={active ? "step" : undefined}
                aria-disabled={locked}
                className="group flex w-full flex-col items-center gap-2 disabled:cursor-not-allowed"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black transition ${
                    step.done
                      ? "border-brand bg-brand text-black shadow-glow"
                      : active
                        ? "border-brand bg-brand/15 text-brand-light"
                        : locked
                          ? "border-white/10 bg-white/[0.03] text-white/25"
                          : "border-white/15 bg-ink-elevated text-white/50 group-hover:border-white/35 group-hover:text-white"
                  }`}
                >
                  {step.done ? (
                    <Check size={14} strokeWidth={3.5} />
                  ) : locked ? (
                    <Lock size={12} />
                  ) : (
                    step.n
                  )}
                </span>

                <span
                  className={`whitespace-nowrap text-[11px] font-semibold transition ${
                    active
                      ? "text-brand-light"
                      : step.done
                        ? "text-white/75"
                        : locked
                          ? "text-white/25"
                          : "text-white/50 group-hover:text-white"
                  }`}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
