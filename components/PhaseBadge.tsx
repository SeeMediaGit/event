import { PHASE_LABEL } from "@/lib/events/format";
import type { EventPhase } from "@/lib/events/types";

const PHASE_STYLE: Record<EventPhase, string> = {
  ongoing: "border-brand/40 bg-brand/15 text-brand-light",
  upcoming: "border-white/15 bg-white/10 text-white/80",
  finished: "border-white/10 bg-white/5 text-muted",
  undated: "border-white/10 bg-white/5 text-muted",
};

export default function PhaseBadge({ phase }: { phase: EventPhase }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PHASE_STYLE[phase]}`}
    >
      {phase === "ongoing" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
        </span>
      )}
      {PHASE_LABEL[phase]}
    </span>
  );
}
