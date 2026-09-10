import Link from "next/link";
import { notFound } from "next/navigation";
import { TAROT_DECK, getCard } from "@/data/deck";
import { CardDetailView } from "@/components/cards/card-detail-view";

type PageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return TAROT_DECK.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const card = getCard(id);
  if (!card) {
    return { title: "牌义 · Candle Taro" };
  }
  return {
    title: `${card.nameZh} · 牌义 · Candle Taro`,
    description: `${card.nameZh}（${card.nameEn}）的关键词与正逆位牌义`,
  };
}

export default async function CardDetailPage({ params }: PageProps) {
  const { id } = await params;
  const card = getCard(id);
  if (!card) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <nav aria-label="面包屑" className="text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/cards" className="hover:text-foreground">
              牌义图鉴
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground">{card.nameZh}</li>
        </ol>
      </nav>
      <CardDetailView card={card} />
    </div>
  );
}
