import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCard } from "@/data/deck";
import { PRODUCT_NAME } from "@/data/scenes";
import { TarotCardFace } from "@/components/reading/tarot-card-face";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toPublicShareView } from "@/lib/public-share";
import { getReadingByPublicShareToken } from "@/lib/store/readings";

export const metadata: Metadata = {
  title: `分享的牌阵 · ${PRODUCT_NAME}`,
  description: "朋友分享的牌阵摘要 — 仅供娱乐与自我反思",
  robots: { index: false, follow: false },
};

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw || "").trim();
  if (!token) notFound();

  const reading = await getReadingByPublicShareToken(token);
  if (!reading) notFound();

  const view = toPublicShareView(reading);

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-xs tracking-widest text-primary/80">🕯️ {view.productName}</p>
        <h1 className="text-xl font-medium tracking-wide text-foreground">
          朋友分享的牌阵
        </h1>
        <p className="text-sm text-muted-foreground">
          只读摘要 · 不含解读全文
        </p>
      </div>

      <Card className="border-primary/25 bg-card/50 shadow-[0_0_40px_oklch(0.78_0.12_75/8%)]">
        <CardHeader className="space-y-2">
          <CardDescription>今晚这一问</CardDescription>
          <CardTitle className="text-lg leading-relaxed font-normal">
            {view.question}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            场景 · {view.sceneLabel}
            <span className="mx-1.5 opacity-40">·</span>
            牌阵 · {view.spreadLabel}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="mb-3 text-xs tracking-wide text-muted-foreground">
              烛下牌面
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {view.cards.map((c) => {
                const card = getCard(c.cardId);
                return (
                  <li
                    key={`${c.positionLabel}-${c.cardId}-${c.reversed ? "r" : "u"}`}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-2.5"
                  >
                    <div className="w-14 shrink-0">
                      <TarotCardFace
                        card={card}
                        reversed={c.reversed}
                        compact
                        className="h-20 w-full"
                      />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        {c.positionLabel}
                      </p>
                      <p className="truncate text-sm font-medium">
                        {c.nameZh}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          {c.reversed ? "逆位" : "正位"}
                        </span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
            {view.verse}
          </p>

          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            {view.disclaimer}
            <br />
            — 来自 {view.productName}，愿烛火陪你轻轻看清一步
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-2 pb-4">
        <Button asChild size="sm">
          <Link href="/reading/new" prefetch>
            也点亮一盏烛火
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground">
          去 {view.productName} 为自己起一卦
        </p>
      </div>
    </div>
  );
}
