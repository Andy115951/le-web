"use client";

import Link from "next/link";
import { getCard } from "@/data/deck";
import type { DrawnCard, Reading, SpreadResult } from "@/lib/types";
import { spreadLabel } from "@/lib/spread-label";
import { TarotCardFace } from "@/components/reading/tarot-card-face";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function CardCell({ drawn }: { drawn: DrawnCard }) {
  const card = getCard(drawn.cardId);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-center text-[11px] tracking-wide text-muted-foreground">
        {drawn.positionLabel}
      </p>
      <TarotCardFace
        card={card}
        reversed={drawn.reversed}
        compact
        className="w-16 sm:w-20"
      />
      <p className="text-center text-[11px] text-foreground/90">
        {card?.nameZh ?? drawn.cardId}
        <span className="text-muted-foreground">
          {" "}
          · {drawn.reversed ? "逆位" : "正位"}
        </span>
      </p>
    </div>
  );
}

function SpreadColumn({
  title,
  subtitle,
  spread,
  readingId,
  linkLabel,
}: {
  title: string;
  subtitle: string;
  spread: SpreadResult;
  readingId?: string;
  linkLabel?: string;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-primary/15 bg-card/40 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <Badge variant="outline">{spreadLabel(spread.spread)}</Badge>
        {readingId && linkLabel ? (
          <Link
            href={`/reading/${readingId}`}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            {linkLabel}
          </Link>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {spread.cards.map((c) => (
          <CardCell key={`${c.position}-${c.cardId}`} drawn={c} />
        ))}
      </div>
    </div>
  );
}

function AlignedRows({
  prior,
  current,
}: {
  prior: SpreadResult;
  current: SpreadResult;
}) {
  const len = Math.max(prior.cards.length, current.cards.length);
  const rows = Array.from({ length: len }, (_, i) => ({
    prior: prior.cards[i],
    current: current.cards[i],
  }));

  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <div
          key={row.prior?.position ?? row.current?.position ?? i}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"
        >
          <div className="flex justify-center rounded-lg border border-primary/10 bg-card/30 p-3">
            {row.prior ? (
              <CardCell drawn={row.prior} />
            ) : (
              <p className="self-center text-xs text-muted-foreground">—</p>
            )}
          </div>
          <div className="flex justify-center rounded-lg border border-primary/10 bg-card/30 p-3">
            {row.current ? (
              <CardCell drawn={row.current} />
            ) : (
              <p className="self-center text-xs text-muted-foreground">—</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ComparePriorSection({
  prior,
  current,
}: {
  prior: Reading;
  current: Reading;
}) {
  const sameSpread = prior.spreadType === current.spreadType;
  const priorWhen = new Date(prior.createdAt).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
  });

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">与上一卦轻轻对照</CardTitle>
        <CardDescription>
          同一问题再起一卦时，把关键牌并排放在烛光下看一眼。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sameSpread ? (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">上一卦</span>
                <Badge variant="outline">{spreadLabel(prior.spreadType)}</Badge>
                <Link
                  href={`/reading/${prior.id}`}
                  className="text-xs text-primary underline-offset-2 hover:underline"
                >
                  打开
                </Link>
                <span className="text-[11px] text-muted-foreground">{priorWhen}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-start">
                <span className="text-sm font-medium">本卦</span>
                <Badge variant="secondary">{spreadLabel(current.spreadType)}</Badge>
              </div>
            </div>
            <AlignedRows
              prior={prior.spreadResult}
              current={current.spreadResult}
            />
          </>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SpreadColumn
              title="上一卦"
              subtitle={priorWhen}
              spread={prior.spreadResult}
              readingId={prior.id}
              linkLabel="打开"
            />
            <SpreadColumn
              title="本卦"
              subtitle="此刻"
              spread={current.spreadResult}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
