"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RitualSpeed } from "@/data/scenes";
import type { SpreadResult } from "@/lib/types";
import { getCard } from "@/data/deck";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TarotCardBack, TarotCardFace } from "@/components/reading/tarot-card-face";
import { cn } from "@/lib/utils";

const SPEEDS: Record<RitualSpeed, number> = {
  slow: 1600,
  normal: 900,
  fast: 400,
};

const STEPS = ["静心…", "洗牌…", "问牌…", "翻开牌面…"] as const;

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
  const [step, setStep] = useState(alreadyDone ? STEPS.length : 0);
  const [revealedCount, setRevealedCount] = useState(
    alreadyDone ? cards.length : 0,
  );
  const finished = useRef(alreadyDone);
  const done = step >= STEPS.length;
  const flipping = step === STEPS.length - 1;

  useEffect(() => {
    if (alreadyDone) {
      if (!finished.current) {
        finished.current = true;
        onDone();
      }
      return;
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
  }, [step, delay, done, onDone, alreadyDone]);

  useEffect(() => {
    if (alreadyDone || !flipping) return;
    if (revealedCount >= cards.length) return;
    const t = setTimeout(
      () => setRevealedCount((n) => n + 1),
      Math.max(220, Math.floor(delay * 0.55)),
    );
    return () => clearTimeout(t);
  }, [alreadyDone, flipping, revealedCount, cards.length, delay]);

  useEffect(() => {
    if (alreadyDone || !done) return;
    if (revealedCount < cards.length) {
      setRevealedCount(cards.length);
    }
  }, [alreadyDone, done, revealedCount, cards.length]);

  const showCards = flipping || done;

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "ritual-panel relative overflow-hidden rounded-xl border border-primary/20 bg-card/50 p-8 text-center",
          step === 0 && "ritual-panel--breathe",
          step === 1 && "ritual-panel--shuffle",
          step === 2 && "ritual-panel--ask",
        )}
      >
        <div className="ritual-glow pointer-events-none absolute inset-0" aria-hidden />
        <p className="relative text-sm tracking-[0.35em] text-primary/80">仪式</p>
        <p className="relative mt-3 text-lg text-foreground">
          {done ? "牌已显现" : STEPS[step]}
        </p>
        <div className="relative mx-auto mt-4 h-1 max-w-xs overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{
              width: `${(Math.min(step, STEPS.length) / STEPS.length) * 100}%`,
            }}
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
        <div
          className={cn(
            "grid gap-3",
            cards.length === 1 ? "mx-auto max-w-xs" : "sm:grid-cols-3",
          )}
        >
          {cards.map((c, index) => {
            const card = getCard(c.cardId);
            const visible = index < revealedCount;
            return (
              <Card
                key={c.position}
                className={cn(
                  "bg-card/80 transition-opacity duration-500",
                  visible ? "opacity-100" : "opacity-40",
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{c.positionLabel}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div
                    className={cn(
                      "tarot-flip",
                      visible && "tarot-flip--revealed",
                    )}
                  >
                    <div className="tarot-flip-inner">
                      <div className="tarot-flip-back"><TarotCardBack /></div>
                      <div className="tarot-flip-front space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-medium text-primary">
                            {card?.nameZh ?? c.cardId}
                          </span>
                          <Badge variant={c.reversed ? "destructive" : "secondary"}>
                            {c.reversed ? "逆位" : "正位"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {card?.keywords.join(" · ")}
                        </p>
                        <TarotCardFace card={card} reversed={c.reversed} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
