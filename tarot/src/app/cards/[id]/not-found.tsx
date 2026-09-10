import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CardNotFound() {
  return (
    <div className="space-y-4 py-10 text-center">
      <h1 className="text-xl font-semibold">找不到这张牌</h1>
      <p className="text-sm text-muted-foreground">
        烛火里没有这张牌义。回到图鉴再选一张吧。
      </p>
      <Button asChild>
        <Link href="/cards">返回图鉴</Link>
      </Button>
    </div>
  );
}
