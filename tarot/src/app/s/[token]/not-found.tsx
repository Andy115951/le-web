import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PublicShareNotFound() {
  return (
    <div className="space-y-4 py-10 text-center">
      <p className="text-xs tracking-widest text-primary/80">🕯️</p>
      <h1 className="text-xl font-semibold">分享已关闭或不存在</h1>
      <p className="mx-auto max-w-sm text-sm text-muted-foreground">
        这条短链可能已失效。回到 Candle Taro，自己起一卦吧。
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
