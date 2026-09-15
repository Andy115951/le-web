"use client";

import { useEffect, useMemo, useState } from "react";
import type { Message } from "@/lib/types";
import {
  deriveReadingTimeline,
  type TimelineStep,
  type TimelineStepStatus,
} from "@/lib/reading-timeline";
import { cn } from "@/lib/utils";

function scrollToAnchor(anchor: string) {
  const el = document.getElementById(anchor);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  // Brief focus ring for a11y without stealing permanent focus from inputs
  if (typeof el.focus === "function") {
    const prev = el.getAttribute("tabindex");
    if (prev === null) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    if (prev === null) {
      window.setTimeout(() => el.removeAttribute("tabindex"), 800);
    }
  }
}

function Dot({ status }: { status: TimelineStepStatus }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        status === "done" && "bg-amber-400/90 shadow-[0_0_8px_oklch(0.78_0.12_75/45%)]",
        status === "current" &&
          "bg-primary shadow-[0_0_10px_oklch(0.78_0.12_75/55%)] ring-2 ring-primary/35",
        status === "pending" && "bg-muted-foreground/35",
      )}
      aria-hidden
    />
  );
}

function StepButton({
  step,
  onJump,
}: {
  step: TimelineStep;
  onJump: (anchor: string) => void;
}) {
  const disabled = !step.reachable;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onJump(step.anchor)}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1.5 py-1.5 text-center transition-colors",
        disabled
          ? "cursor-default opacity-45"
          : "hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        step.status === "current" && "bg-primary/8",
      )}
      aria-label={`${step.label}：${step.hint}${disabled ? "（尚未到达）" : "，点击回看"}`}
      aria-current={step.status === "current" ? "step" : undefined}
    >
      <Dot status={step.status} />
      <span
        className={cn(
          "text-[11px] font-medium tracking-wide",
          step.status === "pending" && "text-muted-foreground",
          step.status === "current" && "text-primary",
          step.status === "done" && "text-foreground/90",
        )}
      >
        {step.label}
      </span>
      <span className="hidden text-[10px] leading-tight text-muted-foreground sm:block">
        {step.hint}
      </span>
    </button>
  );
}

/**
 * P48 — light in-reading timeline (揭晓→解读→追问→信物).
 * Shown only after ritual; foldable on mobile; scroll-to rewind.
 */
export function ReadingTimeline({
  ritualDone,
  messages,
  interpreting,
  tokenLit,
}: {
  ritualDone: boolean;
  messages: Message[];
  interpreting: boolean;
  tokenLit: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    // Desktop: start expanded; mobile stays collapsed until user opens.
    if (typeof window !== "undefined") {
      const wide = window.matchMedia("(min-width: 640px)").matches;
      setExpanded(wide);
    }
  }, []);

  const steps = useMemo(
    () =>
      deriveReadingTimeline({
        ritualDone,
        messages,
        interpreting,
        tokenLit,
      }),
    [ritualDone, messages, interpreting, tokenLit],
  );

  if (!ritualDone) return null;

  const current =
    steps.find((s) => s.status === "current") ??
    steps.find((s) => s.status === "done") ??
    steps[0]!;

  function onJump(anchor: string) {
    scrollToAnchor(anchor);
  }

  return (
    <nav
      className="sticky top-0 z-20 -mx-1 rounded-xl border border-amber-500/20 bg-background/90 px-2 py-2 shadow-[0_8px_24px_oklch(0.2_0.02_60/35%)] backdrop-blur-md sm:mx-0"
      aria-label="本卦时间线"
    >
      <div className="flex items-center gap-2 sm:hidden">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-primary/10"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="reading-timeline-steps"
        >
          <Dot status={current.status} />
          <span className="min-w-0 flex-1 truncate text-xs text-foreground/90">
            本卦 · {current.label}
            <span className="text-muted-foreground"> · {current.hint}</span>
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {expanded ? "收起" : "展开"}
          </span>
        </button>
        {!expanded ? (
          <button
            type="button"
            className="shrink-0 rounded-md border border-primary/25 px-2 py-1 text-[10px] text-primary"
            onClick={() => onJump(current.anchor)}
            aria-label={`回到${current.label}`}
          >
            回看
          </button>
        ) : null}
      </div>

      <div
        id="reading-timeline-steps"
        className={cn(
          "sm:block",
          expanded || !hydrated ? "mt-1.5 block sm:mt-0" : "hidden",
        )}
      >
        <div className="mb-1 hidden px-1 text-[10px] tracking-wide text-muted-foreground sm:block">
          本卦时间线 · 轻点回看
        </div>
        <div className="flex items-stretch gap-0.5">
          {steps.map((step, i) => (
            <div key={step.id} className="flex min-w-0 flex-1 items-center">
              <StepButton step={step} onJump={onJump} />
              {i < steps.length - 1 ? (
                <span
                  className={cn(
                    "mx-0.5 h-px w-2 shrink-0 sm:w-3",
                    step.status === "done"
                      ? "bg-amber-400/50"
                      : "bg-border/70",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
