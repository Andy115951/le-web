import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ReadingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">占卜进行中</h1>
        <Badge variant="outline">P0 空壳</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">本局参数</CardTitle>
          <CardDescription>真实抽牌 / 仪式 / AI 将在后续阶段接入</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="text-foreground">id：</span>
            {id}
          </p>
          <p>
            <span className="text-foreground">问题：</span>
            {sp.q ?? "—"}
          </p>
          <p>
            <span className="text-foreground">场景：</span>
            {sp.scene ?? "—"}
          </p>
          <p>
            <span className="text-foreground">牌阵：</span>
            {sp.spread ?? "—"} · 解读 {sp.detail ?? "—"} · 速度{" "}
            {sp.speed ?? "—"}
          </p>
        </CardContent>
      </Card>
      <div className="rounded-xl border border-dashed border-primary/30 bg-card/40 p-8 text-center text-muted-foreground">
        仪式舞台（文本动画）与牌面示意将放在这里
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link href="/reading/new">新占卜</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/history">历史</Link>
        </Button>
      </div>
    </div>
  );
}
