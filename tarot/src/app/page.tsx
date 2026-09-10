import Link from "next/link";
import { DailyCardSection } from "@/components/home/daily-card";
import { Button } from "@/components/ui/button";
import {
  Card,
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
        <div className="flex justify-center gap-3 pt-2">
          <Button asChild size="lg">
            <Link href="/reading/new">开始占卜</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/history">查看历史</Link>
          </Button>
        </div>
      </section>

      <DailyCardSection draw={daily} />

      <section className="grid gap-3 sm:grid-cols-2">
        {SCENES.map((scene) => (
          <Link key={scene.id} href={`/reading/new?scene=${scene.id}`}>
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/30">
              <CardHeader>
                <CardTitle className="text-lg">{scene.label}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {scene.exampleQuestion}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
        <Link href="/reading/new?scene=custom">
          <Card className="h-full border-dashed transition-colors hover:border-primary/40">
            <CardHeader>
              <CardTitle className="text-lg">自定义</CardTitle>
              <CardDescription>写下你自己的问题</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </section>
    </div>
  );
}
