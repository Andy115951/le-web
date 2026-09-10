import { CardsCatalog } from "@/components/cards/cards-catalog";

export const metadata = {
  title: "牌义图鉴 · Candle Taro",
  description: "浏览七十八张牌的关键词与正逆位牌义",
};

export default function CardsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">牌义图鉴</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          不必起卦，也能静静翻阅牌义。选一张，看看它此刻想说什么。
        </p>
      </div>
      <CardsCatalog />
    </div>
  );
}
