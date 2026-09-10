import type { DeckCard, Suit } from "@/data/deck";
import { cn } from "@/lib/utils";

const SUIT_GLYPH: Record<Suit, string> = {
  wands: "✦",
  cups: "☾",
  swords: "†",
  pentacles: "◈",
};

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
  if (card.suit) return SUIT_GLYPH[card.suit];
  return "✧";
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

  return (
    <div
      className={cn(
        "tarot-card-face relative overflow-hidden rounded-lg border border-primary/35 bg-gradient-to-b from-primary/15 via-card to-background/80 shadow-[inset_0_0_24px_oklch(0.78_0.12_75/12%)]",
        reversed && "tarot-card-face--reversed",
        compact ? "h-20" : "h-36",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(ellipse_at_50%_20%,oklch(0.78_0.12_75/25%),transparent_55%)]" />
      <div
        className={cn(
          "relative flex h-full flex-col items-center justify-center gap-1 px-2 text-center",
          reversed && "rotate-180",
        )}
      >
        <span
          className={cn(
            "font-serif tracking-widest text-primary",
            compact ? "text-xl" : "text-3xl",
          )}
          aria-hidden
        >
          {glyph}
        </span>
        <span
          className={cn(
            "font-medium text-foreground",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {label}
        </span>
        {!compact && card?.suit && (
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {card.suit}
          </span>
        )}
        {!compact && card?.arcana === "major" && (
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            major
          </span>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-2 top-2 h-px bg-primary/25" />
      <div className="pointer-events-none absolute inset-x-2 bottom-2 h-px bg-primary/25" />
    </div>
  );
}
