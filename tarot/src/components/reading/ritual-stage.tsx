"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { RitualSpeed } from "@/data/scenes";
import type { DrawnCard, SpreadResult } from "@/lib/types";
import { getCard } from "@/data/deck";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TarotCardBack, TarotCardFace } from "@/components/reading/tarot-card-face";
import { spreadLabel } from "@/lib/spread-label";
import { cn } from "@/lib/utils";

const SPEEDS: Record<RitualSpeed, number> = {
  slow: 1600,
  normal: 900,
  fast: 400,
};

const STEPS = ["静心…", "洗牌…", "问牌…", "翻开牌面…"] as const;

/** Celtic Cross CSS grid areas (classic cross + vertical staff). */
const CELTIC_AREA: Record<string, string> = {
  present: "present",
  cross: "cross",
  foundation: "foundation",
  recent_past: "past",
  crown: "crown",
  near_future: "future",
  self: "self",
  environment: "environment",
  hopes_fears: "hopes",
  outcome: "outcome",
};

function SpreadCard({
  drawn,
  visible,
  className,
  style,
}: {
  drawn: DrawnCard;
  visible: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const card = getCard(drawn.cardId);
  const name = card?.nameZh ?? drawn.cardId;
  const orient = drawn.reversed ? "逆位" : "正位";
  return (
    <Card
      className={cn(
        "bg-card/80 transition-opacity duration-500",
        visible ? "opacity-100" : "opacity-40",
        className,
      )}
      style={style}
      aria-label={
        visible
          ? `${drawn.positionLabel}：${name}，${orient}`
          : `${drawn.positionLabel}：尚未翻开`
      }
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{drawn.positionLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className={cn("tarot-flip", visible && "tarot-flip--revealed")}>
          <div className="tarot-flip-inner">
            <div className="tarot-flip-back">
              <TarotCardBack />
            </div>
            <div className="tarot-flip-front space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-medium text-primary">{name}</span>
                <Badge variant={drawn.reversed ? "destructive" : "secondary"}>
                  {orient}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {card?.keywords.join(" · ")}
              </p>
              <TarotCardFace card={card} reversed={drawn.reversed} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RitualStage({
  speed,
  spread,
  onDone,
  alreadyDone = false,
}: {
  speed: RitualSpeed;
  spread: SpreadResult;
  onDone: () => void;
  alreadyDone?: boolean;
}) {
  const delay = SPEEDS[speed] ?? 900;
  const cards = useMemo(() => spread.cards, [spread]);
  const isCeltic = spread.spread === "celtic_cross";
  const [step, setStep] = useState(alreadyDone ? STEPS.length : 0);
  const [revealedCount, setRevealedCount] = useState(
    alreadyDone ? cards.length : 0,
  );
  const finished = useRef(alreadyDone);
  const done = step >= STEPS.length;
  const flipping = step === STEPS.length - 1;

  // Advance ritual steps; stay on the flip step until every card is revealed.
  useEffect(() => {
    if (alreadyDone) {
      if (!finished.current) {
        finished.current = true;
        onDone();
      }
      return;
    }
    if (flipping) {
      if (revealedCount < cards.length) return;
      const t = setTimeout(() => setStep((s) => s + 1), Math.max(280, Math.floor(delay * 0.35)));
      return () => clearTimeout(t);
    }
    if (done) {
      if (!finished.current) {
        finished.current = true;
        onDone();
      }
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), delay);
    return () => clearTimeout(t);
  }, [step, delay, done, flipping, revealedCount, cards.length, onDone, alreadyDone]);

  useEffect(() => {
    if (alreadyDone || !flipping) return;
    if (revealedCount >= cards.length) return;
    const t = setTimeout(
      () => setRevealedCount((n) => n + 1),
      Math.max(220, Math.floor(delay * 0.55)),
    );
    return () => clearTimeout(t);
  }, [alreadyDone, flipping, revealedCount, cards.length, delay]);

  const showCards = flipping || done;
  const stageLabel = done ? "牌已显现" : STEPS[step];

  return (
    <div className="space-y-6" aria-label="占卜仪式">
      <div
        className={cn(
          "ritual-panel relative overflow-hidden rounded-xl border border-primary/20 bg-card/50 p-8 text-center",
          step === 0 && "ritual-panel--breathe",
          step === 1 && "ritual-panel--shuffle",
          step === 2 && "ritual-panel--ask",
        )}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="ritual-glow pointer-events-none absolute inset-0" aria-hidden />
        <p className="relative text-sm tracking-[0.35em] text-primary/80">仪式</p>
        <p className="relative mt-3 text-lg text-foreground">{stageLabel}</p>
        <div
          className="relative mx-auto mt-4 h-1 max-w-xs overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={STEPS.length}
          aria-valuenow={Math.min(step, STEPS.length)}
          aria-label="仪式进度"
        >
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{
              width: `${(Math.min(step, STEPS.length) / STEPS.length) * 100}%`,
            }}
            aria-hidden
          />
        </div>
        {step === 1 && (
          <div className="ritual-deck mx-auto mt-6 flex justify-center gap-1" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="ritual-deck-card inline-block h-10 w-7 rounded-sm border border-primary/40 bg-primary/10"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        )}
      </div>

      {showCards && (
        <div className="space-y-3">
          <p className="text-center text-xs tracking-[0.2em] text-primary/70">
            {spreadLabel(spread.spread)}
          </p>

          {isCeltic ? (
            <>
              {/* Mobile: compact 2-column sequential */}
              <div
                className="grid grid-cols-2 gap-3 sm:hidden"
                aria-label="牌阵结果"
              >
                {cards.map((c, index) => (
                  <SpreadCard
                    key={c.position}
                    drawn={c}
                    visible={index < revealedCount}
                  />
                ))}
              </div>
              {/* sm+: Celtic-ish cross + vertical staff */}
              <div
                className="hidden gap-3 sm:grid"
                style={{
                  gridTemplateColumns: "minmax(0,1fr) minmax(0,1.15fr) minmax(0,1fr) minmax(0,1fr)",
                  gridTemplateAreas: `
                    ". crown crown self"
                    "past present future environment"
                    ". cross . hopes"
                    ". foundation . outcome"
                  `,
                }}
                aria-label="牌阵结果"
              >
                {cards.map((c, index) => {
                  const area = CELTIC_AREA[c.position] ?? undefined;
                  return (
                    <SpreadCard
                      key={c.position}
                      drawn={c}
                      visible={index < revealedCount}
                      style={area ? { gridArea: area } : undefined}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <div
              className={cn(
                "grid gap-3",
                cards.length === 1
                  ? "mx-auto max-w-xs"
                  : cards.length === 5
                    ? "grid-cols-2 sm:grid-cols-3"
                    : "sm:grid-cols-3",
              )}
              aria-label="牌阵结果"
            >
              {cards.map((c, index) => (
                <SpreadCard
                  key={c.position}
                  drawn={c}
                  visible={index < revealedCount}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
