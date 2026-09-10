"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RitualSpeed } from "@/data/scenes";
import type { SpreadResult } from "@/lib/types";
import { getCard } from "@/data/deck";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
}: {
  speed: RitualSpeed;
  spread: SpreadResult;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const delay = SPEEDS[speed] ?? 900;
  const done = step >= STEPS.length;
  const finished = useRef(false);

  useEffect(() => {
    if (done) {
      if (!finished.current) {
        finished.current = true;
        onDone();
      }
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), delay);
    return () => clearTimeout(t);
  }, [step, delay, done, onDone]);

  const cards = useMemo(() => spread.cards, [spread]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/20 bg-card/50 p-8 text-center">
        <p className="text-sm tracking-[0.2em] text-primary/80">RITUAL</p>
        <p className="mt-3 text-lg text-foreground">
          {done ? "牌已显现" : STEPS[step]}
        </p>
        <div className="mx-auto mt-4 h-1 max-w-xs overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${(Math.min(step, STEPS.length) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {done && (
        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map((c) => {
            const card = getCard(c.cardId);
            return (
              <Card key={c.position} className="bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {c.positionLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
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
                  <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-primary/30 bg-background/40 text-xs text-muted-foreground">
                    牌面示意
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
