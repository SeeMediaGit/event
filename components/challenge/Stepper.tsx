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
    <ol className="flex items-center gap-1 overflow-x-auto pb-1 sm:gap-2">
      {steps.map((step, i) => {
        const locked = Boolean(step.lockedReason);
        const active = step.n === current;

        return (
          <li key={step.n} className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={() => onSelect(step.n)}
              title={step.lockedReason}
              aria-current={active ? "step" : undefined}
              aria-disabled={locked}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition sm:px-3.5 ${
                active
                  ? "border-brand/40 bg-brand/15 text-brand-light"
                  : locked
                    ? "cursor-not-allowed border-white/8 bg-white/[0.02] text-white/25"
                    : "border-white/10 bg-ink-surface/60 text-white/70 hover:border-white/25 hover:text-white"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                  step.done
                    ? "bg-brand text-black"
                    : active
                      ? "bg-brand/25 text-brand-light"
                      : "bg-white/10 text-white/50"
                }`}
              >
                {step.done ? (
                  <Check size={11} strokeWidth={3.5} />
                ) : locked ? (
                  <Lock size={10} />
                ) : (
                  step.n
                )}
              </span>
              <span className="hidden whitespace-nowrap sm:inline">
                {step.label}
              </span>
            </button>

            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`h-px w-3 sm:w-6 ${
                  step.done ? "bg-brand/50" : "bg-white/10"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
