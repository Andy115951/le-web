"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Star } from "lucide-react";
import { CUSTOM_SCENE, SCENES, type SceneId } from "@/data/scenes";
import { normalizeQuestion } from "@/lib/normalize-question";
import {
  listFavoriteIds,
  toggleFavorite,
} from "@/lib/history-favorites";
import { Button } from "@/components/ui/button";
import { HistoryCard, type HistoryCardData } from "@/components/history/history-card";
import { cn } from "cn";

export type HistoryListItem = HistoryCardData & {
  scene: SceneId;
  createdAt: string;
  questionNormalized?: string;
};

type SceneFilter = "all" | SceneId;
type TimeFilter = "all" | "7d" | "30d" | "older";

const SCENE_OPTIONS: { id: SceneFilter; label: string }[] = [
  { id: "all", label: "全部场景" },
  ...SCENES.map((s) => ({ id: s.id as SceneFilter, label: s.label })),
  { id: "custom", label: CUSTOM_SCENE.label },
];

const TIME_OPTIONS: { id: TimeFilter; label: string }[] = [
  { id: "all", label: "全部时间" },
  { id: "7d", label: "近 7 天" },
  { id: "30d", label: "近 30 天" },
  { id: "older", label: "更早" },
];

function inTimeRange(iso: string, filter: TimeFilter, now: number): boolean {
  if (filter === "all") return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const day = 24 * 60 * 60 * 1000;
  if (filter === "7d") return now - t <= 7 * day;
  if (filter === "30d") return now - t <= 30 * day;
  // older than 30 days
  return now - t > 30 * day;
}

type QuestionGroup = {
  key: string;
  label: string;
  items: HistoryListItem[];
  hasFavorite: boolean;
  latestAt: number;
};

export function HistoryList({ items }: { items: HistoryListItem[] }) {
  const [scene, setScene] = useState<SceneFilter>("all");
  const [time, setTime] = useState<TimeFilter>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setFavoriteIds(listFavoriteIds());
    setHydrated(true);
  }, []);

  const onToggleFavorite = useCallback((id: string) => {
    const { ids } = toggleFavorite(id);
    setFavoriteIds(ids);
  }, []);

  const now = useMemo(() => Date.now(), []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (scene !== "all" && item.scene !== scene) return false;
      if (!inTimeRange(item.updatedAt || item.createdAt, time, now)) return false;
      if (favoritesOnly && hydrated && !favoriteIds.includes(item.id)) return false;
      return true;
    });
  }, [items, scene, time, favoritesOnly, favoriteIds, hydrated, now]);

  const groups = useMemo((): QuestionGroup[] => {
    const map = new Map<string, HistoryListItem[]>();
    for (const item of filtered) {
      const key = normalizeQuestion(item.question) || item.id;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    const result: QuestionGroup[] = [];
    for (const [key, groupItems] of map) {
      const sorted = [...groupItems].sort((a, b) => {
        const af = favoriteIds.includes(a.id) ? 1 : 0;
        const bf = favoriteIds.includes(b.id) ? 1 : 0;
        if (af !== bf) return bf - af;
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
      const latestAt = Math.max(
        ...sorted.map((x) => new Date(x.updatedAt).getTime() || 0),
      );
      const hasFavorite = sorted.some((x) => favoriteIds.includes(x.id));
      const label =
        sorted[0]?.title ||
        sorted[0]?.question ||
        key;
      result.push({ key, label, items: sorted, hasFavorite, latestAt });
    }
    result.sort((a, b) => {
      if (a.hasFavorite !== b.hasFavorite) return a.hasFavorite ? -1 : 1;
      return b.latestAt - a.latestAt;
    });
    return result;
  }, [filtered, favoriteIds]);

  const hasActiveFilter =
    scene !== "all" || time !== "all" || favoritesOnly;

  return (
    <div className="space-y-4">
      <div
        className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-3"
        role="search"
        aria-label="历史筛选"
      >
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">场景</p>
          <div className="flex flex-wrap gap-1.5">
            {SCENE_OPTIONS.map((opt) => (
              <Button
                key={opt.id}
                type="button"
                size="xs"
                variant={scene === opt.id ? "default" : "outline"}
                aria-pressed={scene === opt.id}
                onClick={() => setScene(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">时间</p>
          <div className="flex flex-wrap gap-1.5">
            {TIME_OPTIONS.map((opt) => (
              <Button
                key={opt.id}
                type="button"
                size="xs"
                variant={time === opt.id ? "default" : "outline"}
                aria-pressed={time === opt.id}
                onClick={() => setTime(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant={favoritesOnly ? "default" : "outline"}
            aria-pressed={favoritesOnly}
            onClick={() => setFavoritesOnly((v) => !v)}
            className="gap-1"
          >
            <Star
              className={cn(
                "size-3",
                favoritesOnly && "fill-current",
              )}
              aria-hidden
            />
            只看收藏
          </Button>
          {hasActiveFilter ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => {
                setScene("all");
                setTime("all");
                setFavoritesOnly(false);
              }}
            >
              清除筛选
            </Button>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">
          收藏存在本机烛火旁（此设备）；同题会轻轻拢在一起。
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">
            烛火里暂时没有符合的记录
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasActiveFilter
              ? "换个场景或时间再看看，或先点亮一盏星标。"
              : "点亮一盏烛火，把问题轻轻放下；解读会出现在这里。"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => {
            const multi = group.items.length > 1;
            const isCollapsed = multi && collapsed[group.key] === true;
            const visible = isCollapsed ? group.items.slice(0, 1) : group.items;
            return (
              <section
                key={group.key}
                className={cn(
                  multi &&
                    "space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-2 sm:p-3",
                )}
                aria-label={
                  multi
                    ? `同题 ${group.items.length} 局`
                    : undefined
                }
              >
                {multi ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-amber-100/90">
                        同题 · {group.items.length} 局
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {group.label}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        setCollapsed((prev) => ({
                          ...prev,
                          [group.key]: !isCollapsed,
                        }))
                      }
                    >
                      {isCollapsed
                        ? `展开其余 ${group.items.length - 1} 局`
                        : "收起同题"}
                    </Button>
                  </div>
                ) : null}
                <div className="grid gap-3">
                  {visible.map((item) => (
                    <HistoryCard
                      key={item.id}
                      reading={item}
                      favorited={hydrated && favoriteIds.includes(item.id)}
                      onToggleFavorite={onToggleFavorite}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
