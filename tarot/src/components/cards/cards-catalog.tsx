"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TAROT_DECK, type DeckCard } from "@/data/deck";
import { TarotCardFace } from "@/components/reading/tarot-card-face";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterChips, type CardFilter } from "@/components/cards/filter-chips";
import { hasCardArt } from "@/data/card-art";

function matchesFilter(card: DeckCard, filter: CardFilter) {
  if (filter === "all") return true;
  if (filter === "major") return card.arcana === "major";
  return card.suit === filter;
}

function matchesQuery(card: DeckCard, q: string) {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    card.nameZh.toLowerCase().includes(needle) ||
    card.nameEn.toLowerCase().includes(needle) ||
    card.id.toLowerCase().includes(needle)
  );
}

export function CardsCatalog() {
  const [filter, setFilter] = useState<CardFilter>("all");
  const [query, setQuery] = useState("");
  const [artOnly, setArtOnly] = useState(false);

  const cards = useMemo(
    () =>
      TAROT_DECK.filter(
        (c) =>
          matchesFilter(c, filter) &&
          matchesQuery(c, query) &&
          (!artOnly || hasCardArt(c.id)),
      ),
    [filter, query, artOnly],
  );

  return (
    <div className="space-y-5">
      <FilterChips value={filter} onChange={setFilter} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={artOnly}
          onClick={() => setArtOnly((v) => !v)}
          className={
            artOnly
              ? "rounded-full border border-primary/50 bg-primary/15 px-3 py-1 text-xs tracking-wide text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              : "rounded-full border border-border/70 bg-background/40 px-3 py-1 text-xs tracking-wide text-muted-foreground hover:border-primary/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          }
        >
          仅看已配图
        </button>
        <span className="text-xs text-muted-foreground">
          混合位图渐进补齐中，示意牌仍可查义
        </span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cards-search">搜索牌义</Label>
        <Input
          id="cards-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="中文或英文牌名…"
          autoComplete="off"
          aria-describedby="cards-search-hint"
        />
        <p id="cards-search-hint" className="text-xs text-muted-foreground">
          可按中文或英文牌名筛选 · 当前 {cards.length} / {TAROT_DECK.length} 张
        </p>
      </div>

      {cards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
          烛火里还没找到这张牌。换个关键词，或点「全部」再看看。
        </p>
      ) : (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          aria-label="牌义列表"
        >
          {cards.map((card) => (
            <li key={card.id}>
              <Link
                href={`/cards/${card.id}`}
                className="group block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="space-y-2 rounded-lg border border-border/50 bg-card/40 p-2 transition-colors group-hover:border-primary/40 group-hover:bg-accent/20 motion-reduce:transition-none">
                  <TarotCardFace card={card} compact className="w-full" />
                  <div className="px-0.5 text-center">
                    <p className="text-sm font-medium text-foreground">
                      {card.nameZh}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {card.nameEn}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
