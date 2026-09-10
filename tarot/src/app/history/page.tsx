import Link from "next/link";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import { listReadings } from "@/lib/store/readings";
import { getCard } from "@/data/deck";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
            {user ? `已登录：${user.username}` : "访客记录保存在本机身份下"}
          </p>
        </div>
        <Button asChild>
          <Link href="/reading/new">新占卜</Link>
        </Button>
      </div>
      {readings.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">还没有占卜记录</CardTitle>
            <CardDescription>
              点亮一盏烛火，写下你的问题；完成后，解读会出现在这里。
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
              <Link key={r.id} href={`/reading/${r.id}`}>
                <Card className="transition-colors hover:border-primary/40">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{r.title || r.question}</CardTitle>
                      <Badge variant="outline">
                        {r.spreadType === "single" ? "单牌" : "三牌"}
                      </Badge>
                    </div>
                    <CardDescription>
                      {names}
                      <span className="mx-2">·</span>
                      {new Date(r.updatedAt).toLocaleString("zh-CN")}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
