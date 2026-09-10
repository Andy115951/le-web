"use client";

import { useState } from "react";
import Link from "next/link";
import type { DeckCard, Suit } from "@/data/deck";
import { TarotCardFace } from "@/components/reading/tarot-card-face";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SUIT_LABEL: Record<Suit, string> = {
  wands: "权杖",
  cups: "圣杯",
  swords: "宝剑",
  pentacles: "星币",
};

function arcanaLabel(card: DeckCard) {
  if (card.arcana === "major") return "大阿尔卡纳";
  if (card.suit) return `小阿尔卡纳 · ${SUIT_LABEL[card.suit]}`;
  return "小阿尔卡纳";
}

export function CardDetailView({ card }: { card: DeckCard }) {
  const [reversed, setReversed] = useState(false);
  const meaning = reversed ? card.reversed : card.upright;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
        <div className="w-44 shrink-0 sm:w-52">
          <TarotCardFace
            card={card}
            reversed={reversed}
            className="h-64 w-full sm:h-72"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-4 text-center sm:text-left">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary/80">
              {arcanaLabel(card)}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {card.nameZh}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{card.nameEn}</p>
          </div>

          <div
            role="group"
            aria-label="正逆位切换"
            className="inline-flex rounded-lg border border-border/70 p-0.5"
          >
            <button
              type="button"
              aria-pressed={!reversed}
              onClick={() => setReversed(false)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                !reversed
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              正位
            </button>
            <button
              type="button"
              aria-pressed={reversed}
              onClick={() => setReversed(true)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                reversed
                  ? "bg-destructive/15 text-destructive"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              逆位
            </button>
          </div>

          {card.keywords.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs tracking-wide text-muted-foreground">
                关键词
              </p>
              <ul className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {card.keywords.map((kw) => (
                  <li
                    key={kw}
                    className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs text-primary"
                  >
                    {kw}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {reversed ? "逆位牌义" : "正位牌义"}
          </CardTitle>
          <CardDescription>
            意象供自我反思，不是确定预言；牌义会随语境轻轻变化。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-foreground/90">
          <p>{meaning}</p>
          <p className="text-xs text-muted-foreground">
            烛火只照见片刻。若你心里已有问题，不如把它带进一次占卜。
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/cards">返回图鉴</Link>
        </Button>
        <Button asChild>
          <Link href="/reading/new">去占卜</Link>
        </Button>
      </div>
    </div>
  );
}
