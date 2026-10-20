import Link from "next/link";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import { listHistoryPage } from "@/lib/store/history";
import { DEFAULT_HISTORY_QUERY } from "@/lib/history-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HistoryList } from "@/components/history/history-list";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  const anon = await ensureAnonymousId();
  const initialData = await listHistoryPage(
    {
      userId: user?.id,
      anonymousId: user ? null : anon,
    },
    DEFAULT_HISTORY_QUERY,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">历史</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user
              ? `已登录：${user.username}`
              : "访客记录会安静地留在这台设备上"}
          </p>
        </div>
        <Button asChild>
          <Link href="/reading/new">新占卜</Link>
        </Button>
      </div>
      {initialData.total === 0 ? (
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
        <HistoryList initialData={initialData} />
      )}
    </div>
  );
}
