import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="space-y-4 py-10 text-center">
      <p className="text-xs tracking-widest text-primary/80">🕯️</p>
      <h1 className="text-xl font-semibold">烛火里找不到这一页</h1>
      <p className="mx-auto max-w-sm text-sm text-muted-foreground">
        链接可能已失效，或分享已关闭。回到首页，再点一盏烛火吧。
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <Button asChild>
          <Link href="/">回首页</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/reading/new">新占卜</Link>
        </Button>
      </div>
    </div>
  );
}
