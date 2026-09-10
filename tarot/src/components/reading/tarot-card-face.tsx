import type { DeckCard, Suit } from "@/data/deck";
import { cn } from "@/lib/utils";

const SUIT_META: Record<
  Suit,
  { glyph: string; labelZh: string; accent: string }
> = {
  wands: {
    glyph: "✦",
    labelZh: "权杖",
    accent: "from-amber-500/25 via-card to-background/90",
  },
  cups: {
    glyph: "☾",
    labelZh: "圣杯",
    accent: "from-sky-500/20 via-card to-background/90",
  },
  swords: {
    glyph: "†",
    labelZh: "宝剑",
    accent: "from-slate-400/25 via-card to-background/90",
  },
  pentacles: {
    glyph: "◈",
    labelZh: "星币",
    accent: "from-emerald-500/20 via-card to-background/90",
  },
};

const MAJOR_ACCENT = "from-primary/30 via-card to-background/90";

function majorGlyph(n?: number) {
  if (n === undefined) return "✧";
  const roman = [
    "0",
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "XIV",
    "XV",
    "XVI",
    "XVII",
    "XVIII",
    "XIX",
    "XX",
    "XXI",
  ];
  return roman[n] ?? String(n);
}

export function cardGlyph(card: DeckCard | undefined) {
  if (!card) return "✧";
  if (card.arcana === "major") return majorGlyph(card.number);
  if (card.suit) return SUIT_META[card.suit].glyph;
  return "✧";
}

function CornerMarks({ compact }: { compact?: boolean }) {
  const size = compact ? "h-2 w-2" : "h-3 w-3";
  const mark =
    "pointer-events-none absolute border-primary/45 " + size;
  return (
    <>
      <span className={cn(mark, "left-1.5 top-1.5 border-l border-t")} />
      <span className={cn(mark, "right-1.5 top-1.5 border-r border-t")} />
      <span className={cn(mark, "bottom-1.5 left-1.5 border-b border-l")} />
      <span className={cn(mark, "bottom-1.5 right-1.5 border-b border-r")} />
    </>
  );
}

function OrnamentRing({
  glyph,
  compact,
}: {
  glyph: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full border border-primary/35 bg-background/40 shadow-[0_0_18px_oklch(0.78_0.12_75/18%)]",
        compact ? "h-9 w-9" : "h-14 w-14",
      )}
      aria-hidden
    >
      <span
        className={cn(
          "font-serif tracking-widest text-primary",
          compact ? "text-lg" : "text-2xl",
        )}
      >
        {glyph}
      </span>
      <span className="pointer-events-none absolute inset-0.5 rounded-full border border-dashed border-primary/20" />
    </div>
  );
}

export function TarotCardBack({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "tarot-card-back relative overflow-hidden rounded-lg border border-primary/40 bg-gradient-to-br from-primary/20 via-background to-background",
        compact ? "h-20" : "min-h-44 h-full",
        className,
      )}
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 opacity-50 [background:repeating-linear-gradient(135deg,oklch(0.28_0.04_60/40%)_0_5px,oklch(0.18_0.03_55/35%)_5px_10px)]" />
      <div className="pointer-events-none absolute inset-2 rounded-md border border-primary/30" />
      <CornerMarks compact={compact} />
      <div className="relative flex h-full min-h-[inherit] flex-col items-center justify-center gap-1">
        <span
          className={cn(
            "font-serif text-primary/90",
            compact ? "text-xl" : "text-3xl",
          )}
        >
          ✧
        </span>
        {!compact && (
          <span className="text-[10px] tracking-[0.35em] text-primary/70">
            CANDLE
          </span>
        )}
      </div>
    </div>
  );
}

export function TarotCardFace({
  card,
  reversed,
  className,
  compact,
}: {
  card: DeckCard | undefined;
  reversed?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const glyph = cardGlyph(card);
  const label = card?.nameZh ?? "未知";
  const suit = card?.suit ? SUIT_META[card.suit] : undefined;
  const accent =
    card?.arcana === "major" ? MAJOR_ACCENT : (suit?.accent ?? MAJOR_ACCENT);
  const subLabel =
    card?.arcana === "major"
      ? "大阿尔卡纳"
      : suit
        ? suit.labelZh
        : undefined;

  return (
    <div
      className={cn(
        "tarot-card-face relative overflow-hidden rounded-lg border border-primary/40 bg-gradient-to-b shadow-[inset_0_0_28px_oklch(0.78_0.12_75/14%)]",
        accent,
        reversed && "tarot-card-face--reversed",
        compact ? "h-20" : "h-44",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(ellipse_at_50%_18%,oklch(0.78_0.12_75/28%),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-1.5 rounded-md border border-primary/25" />
      <CornerMarks compact={compact} />

      {!compact && (
        <div
          className={cn(
            "absolute left-2.5 top-2.5 z-10 rounded-full border px-1.5 py-0.5 text-[9px] tracking-wider",
            reversed
              ? "border-destructive/50 bg-destructive/15 text-destructive"
              : "border-primary/40 bg-primary/10 text-primary",
          )}
        >
          {reversed ? "逆位" : "正位"}
        </div>
      )}

      <div
        className={cn(
          "relative flex h-full flex-col items-center justify-center gap-1.5 px-2 text-center",
          reversed && "rotate-180",
        )}
      >
        <OrnamentRing glyph={glyph} compact={compact} />
        <span
          className={cn(
            "font-medium text-foreground",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {label}
        </span>
        {!compact && subLabel && (
          <span className="text-[10px] tracking-[0.18em] text-muted-foreground">
            {subLabel}
          </span>
        )}
        {!compact && card?.keywords?.length ? (
          <span className="max-w-[90%] truncate text-[10px] text-muted-foreground/90">
            {card.keywords.slice(0, 2).join(" · ")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
