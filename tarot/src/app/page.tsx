import Link from "next/link";
import { DailyCardSection } from "@/components/home/daily-card";
import {
  DailyHabitNudge,
  DailyHabitOpenScroll,
} from "@/components/home/daily-habit";
import { FirstVisitGuide } from "@/components/home/first-visit-guide";
import { GuestQuotaNudge } from "@/components/home/guest-quota-nudge";
import { QuickStartButton } from "@/components/home/quick-start-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PRODUCT_NAME, SCENES } from "@/data/scenes";
import { getTodayDailyCard } from "@/lib/daily-card";

export default async function HomePage() {
  const daily = await getTodayDailyCard();

  return (
    <div className="space-y-10">
      <section className="space-y-4 text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-primary/80">
          Candlelight · Reading
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {PRODUCT_NAME}
        </h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          烛火未熄。选一个场景，把问题轻轻放下；牌阵会替你照见当下。
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Button asChild size="lg">
            <Link href="/reading/new" prefetch>
              开始占卜
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/history" prefetch>
              查看历史
            </Link>
          </Button>
        </div>
        <FirstVisitGuide />
        <DailyHabitNudge />
        <GuestQuotaNudge />
        <DailyHabitOpenScroll />
      </section>

      <section aria-label="选择一个场景" className="grid gap-3 sm:grid-cols-2">
        {SCENES.map((scene) => (
          <Card
            key={scene.id}
            className="h-full transition-colors hover:border-primary/40 hover:bg-accent/30"
          >
            <Link href={`/reading/new?scene=${scene.id}`} prefetch className="block">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{scene.label}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {scene.exampleQuestion}
                </CardDescription>
                <p className="pt-1 text-xs font-medium text-primary/85">
                  完善问题 →
                </p>
              </CardHeader>
            </Link>
            <CardContent className="pt-0">
              <QuickStartButton sceneId={scene.id} label="直接起卦" />
            </CardContent>
          </Card>
        ))}
        <Link href="/reading/new?scene=custom" prefetch>
          <Card className="h-full border-dashed transition-colors hover:border-primary/40">
            <CardHeader>
              <CardTitle className="text-lg">自定义</CardTitle>
              <CardDescription>写下你自己的问题</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </section>

      <DailyCardSection draw={daily} />
    </div>
  );
}
