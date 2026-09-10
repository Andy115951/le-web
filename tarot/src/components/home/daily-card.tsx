import Link from "next/link";
import { TarotCardFace } from "@/components/reading/tarot-card-face";
import { Button } from "@/components/ui/button";
import {
  dailyCardBlurb,
  dailyCardKeywords,
  type DailyCardDraw,
} from "@/lib/daily-card";

export function DailyCardSection({ draw }: { draw: DailyCardDraw }) {
  const blurb = dailyCardBlurb(draw);
  const keywords = dailyCardKeywords(draw);
  const orientation = draw.reversed ? "逆位" : "正位";

  return (
    <section
      aria-labelledby="daily-card-heading"
      className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card/60 to-background p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Link
          href={`/cards/${draw.cardId}`}
          className="mx-auto w-28 shrink-0 sm:mx-0"
        >
          <TarotCardFace
            card={draw.card}
            reversed={draw.reversed}
            className="h-40 w-full"
          />
        </Link>
        <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
          <p className="text-xs uppercase tracking-[0.2em] text-primary/80">
            今日一牌
          </p>
          <h2
            id="daily-card-heading"
            className="text-xl font-semibold tracking-tight"
          >
            {draw.card.nameZh}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {orientation}
            </span>
          </h2>
          <p className="text-xs text-primary/70">{keywords}</p>
          <p className="text-sm text-muted-foreground">{blurb}</p>
          <p className="text-xs text-muted-foreground/80">
            不计入占卜额度，只作今日提示；想深入可去看牌义或起一卦。
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1 sm:justify-start">
            <Button asChild size="sm" variant="secondary">
              <Link href={`/cards/${draw.cardId}`}>查看牌义</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/reading/new">开始占卜</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
