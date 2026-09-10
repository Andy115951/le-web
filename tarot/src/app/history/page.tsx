import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">历史</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            卡片将显示问题、牌阵与关键牌名（P4）
          </p>
        </div>
        <Button asChild>
          <Link href="/reading/new">新占卜</Link>
        </Button>
      </div>
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base text-muted-foreground">
            还没有记录
          </CardTitle>
          <CardDescription>完成一局占卜后，会出现在这里</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
