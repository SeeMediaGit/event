"use client";

import { Check, Lock } from "lucide-react";

export type StepState = {
  n: number;
  label: string;
  // Filled in when the step cannot be opened yet — shown as the tooltip and
  // announced to screen readers, so a locked step always says *why*.
  lockedReason?: string;
  done: boolean;
};

// A numbered circle with its label underneath, sitting on a single connector
// line that runs the width of the row. Each circle punches a hole in that line
// with its own `bg-ink` padding, which is what keeps the line from crossing the
// markers without needing per-segment divs.
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
    <nav aria-label="Алхмууд" className="w-full overflow-x-auto pb-1">
      <ol className="relative flex min-w-[560px] items-start justify-between">
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
