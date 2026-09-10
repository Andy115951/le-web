"use client";

import { cn } from "@/lib/utils";
import type { Suit } from "@/data/deck";

export type CardFilter =
  | "all"
  | "major"
  | Suit;

export const CARD_FILTERS: { id: CardFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "major", label: "大阿尔卡纳" },
  { id: "wands", label: "权杖" },
  { id: "cups", label: "圣杯" },
  { id: "swords", label: "宝剑" },
  { id: "pentacles", label: "星币" },
];

export function FilterChips({
  value,
  onChange,
}: {
  value: CardFilter;
  onChange: (next: CardFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="牌义筛选"
      className="flex flex-wrap gap-2"
    >
      {CARD_FILTERS.map((f) => {
        const selected = value === f.id;
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(f.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              selected
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border/70 bg-background/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
