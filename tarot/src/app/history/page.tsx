import Link from "next/link";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import { listReadings } from "@/lib/store/readings";
import { getCard } from "@/data/deck";
import { spreadLabel } from "@/lib/spread-label";
import { CUSTOM_SCENE, SCENES } from "@/data/scenes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HistoryCard } from "@/components/history/history-card";

function sceneLabel(scene: string) {
  if (scene === "custom") return CUSTOM_SCENE.label;
  return SCENES.find((s) => s.id === scene)?.label ?? scene;
}

export default async function HistoryPage() {
  const user = await getCurrentUser();
  const anon = await ensureAnonymousId();
  const readings = await listReadings({
    userId: user?.id,
    anonymousId: user ? null : anon,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">历史</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user ? `已登录：${user.username}` : "访客记录会安静地留在这台设备上"}
          </p>
        </div>
        <Button asChild>
          <Link href="/reading/new">新占卜</Link>
        </Button>
      </div>
      {readings.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">烛火还安静着</CardTitle>
            <CardDescription>
              还没有留下占卜记录。点亮一盏烛火，把问题轻轻放下；解读会出现在这里。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/reading/new">开始新占卜</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {readings.map((r) => {
            const names = r.spreadResult.cards
              .map((c) => getCard(c.cardId)?.nameZh ?? c.cardId)
              .join(" / ");
            return (
              <HistoryCard
                key={r.id}
                reading={{
                  id: r.id,
                  title: r.title,
                  question: r.question,
                  sceneLabel: sceneLabel(r.scene),
                  spreadLabel: spreadLabel(r.spreadType),
                  cardNames: names,
                  updatedAt: r.updatedAt,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
