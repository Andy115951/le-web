"use client";

import {
  useMemo,
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { Search, Star } from "lucide-react";
import { CUSTOM_SCENE, SCENES } from "@/data/scenes";
import { listFavoriteIds, toggleFavorite } from "@/lib/history-favorites";
import { DEFAULT_HISTORY_QUERY, type HistoryQuery } from "@/lib/history-query";
import { groupHistory, type HistoryPageData } from "@/lib/history-groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HistoryCard } from "@/components/history/history-card";
import { cn } from "cn";

const SCENE_OPTIONS = [
  { id: "all", label: "全部场景" },
  ...SCENES,
  CUSTOM_SCENE,
];
const TIME_OPTIONS = [
  { id: "all", label: "全部时间" },
  { id: "7d", label: "近 7 天" },
  { id: "30d", label: "近 30 天" },
  { id: "older", label: "更早" },
] as const;
const FAVORITES_EVENT = "candle-taro:favorites-changed";
function subscribeFavorites(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(FAVORITES_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(FAVORITES_EVENT, listener);
  };
}
const favoritesSnapshot = () => JSON.stringify(listFavoriteIds());
const serverFavoritesSnapshot = () => "[]";
const EMPTY_ITEMS: HistoryPageData["items"] = [];

export function HistoryList({ initialData }: { initialData: HistoryPageData }) {
  const [filters, setFilters] = useState(DEFAULT_HISTORY_QUERY);
  const [searchInput, setSearchInput] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const favoritesJson = useSyncExternalStore(
    subscribeFavorites,
    favoritesSnapshot,
    serverFavoritesSnapshot,
  );
  const favoriteIds: string[] = useMemo(
    () => JSON.parse(favoritesJson),
    [favoritesJson],
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [revision, setRevision] = useState(0);
  const query = { ...filters, favoriteIds: favoritesOnly ? favoriteIds : null };
  const baseKey = JSON.stringify({ ...query, offset: 0 });
  const requestKey = JSON.stringify({ ...query, revision });
  const lastFinished = useRef(requestKey);
  const [result, setResult] = useState({
    ...initialData,
    baseKey,
    key: requestKey,
    error: "",
  });
  const searching = searchInput.trim() !== filters.search;
  const busy = searching || result.key !== requestKey;
  const sameFilter = result.baseKey === baseKey;
  const items = sameFilter ? result.items : EMPTY_ITEMS;
  const total = sameFilter ? result.total : 0;
  const error = result.key === requestKey ? result.error : "";
  const groups = useMemo(
    () => groupHistory(items, favoriteIds),
    [items, favoriteIds],
  );
  const hasActiveFilter =
    !!searchInput ||
    filters.scene !== "all" ||
    filters.time !== "all" ||
    favoritesOnly;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((previous) =>
        previous.search === searchInput.trim()
          ? previous
          : { ...previous, search: searchInput.trim(), offset: 0 },
      );
      setExpanded({});
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (lastFinished.current === requestKey) return;
    const controller = new AbortController();
    // requestKey is the complete immutable snapshot, including the retry revision.
    const { revision: ignoredRevision, ...body } = JSON.parse(
      requestKey,
    ) as HistoryQuery & { revision: number };
    void ignoredRevision;
    const requestedBase = JSON.stringify({ ...body, offset: 0 });
    async function load() {
      try {
        const response = await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
          cache: "no-store",
        });
        const data = (await response.json()) as HistoryPageData & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error || "没能取回历史，请稍后重试。");
        if (controller.signal.aborted) return;
        if (body.offset > 0 && data.items.length === 0) {
          // A concurrent deletion can shrink the list past this page.
          // Reload the first page rather than retain stale cards/counts.
          setFilters((previous) => ({ ...previous, offset: 0 }));
          setRevision((n) => n + 1);
          return;
        }
        lastFinished.current = requestKey;
        setResult((previous) => {
          const combined =
            body.offset > 0 && previous.baseKey === requestedBase
              ? [...previous.items, ...data.items]
              : data.items;
          return {
            items: [
              ...new Map(combined.map((item) => [item.id, item])).values(),
            ],
            total: data.total,
            baseKey: requestedBase,
            key: requestKey,
            error: "",
          };
        });
      } catch (e) {
        if (controller.signal.aborted) return;
        lastFinished.current = requestKey;
        setResult((previous) => ({
          items: previous.baseKey === requestedBase ? previous.items : [],
          total: previous.baseKey === requestedBase ? previous.total : 0,
          baseKey: requestedBase,
          key: requestKey,
          error: e instanceof Error ? e.message : "没能取回历史，请稍后重试。",
        }));
      }
    }
    void load();
    return () => controller.abort();
  }, [requestKey]);

  function changeFilter(patch: Partial<HistoryQuery>) {
    setFilters((previous) => ({ ...previous, ...patch, offset: 0 }));
    setExpanded({});
  }
  function clearFilters() {
    setSearchInput("");
    setFilters(DEFAULT_HISTORY_QUERY);
    setFavoritesOnly(false);
    setExpanded({});
  }
  function refreshHistory() {
    setFilters((previous) => ({ ...previous, offset: 0 }));
    setRevision((n) => n + 1);
  }

  return (
    <div className="space-y-4">
      <div
        className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-3"
        role="search"
        aria-label="历史搜索与筛选"
      >
        <div className="space-y-2">
          <Label htmlFor="history-search">找回一局</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="history-search"
              type="search"
              value={searchInput}
              maxLength={200}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索问题或标题，覆盖全部历史"
              className="h-10 pl-9 text-base sm:text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={favoritesOnly ? "default" : "outline"}
            aria-pressed={favoritesOnly}
            onClick={() => {
              setFavoritesOnly((v) => !v);
              changeFilter({});
            }}
            className="gap-1"
          >
            <Star
              className={cn("size-3", favoritesOnly && "fill-current")}
              aria-hidden
            />
            只看收藏
          </Button>
          {hasActiveFilter && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={clearFilters}
            >
              清除筛选
            </Button>
          )}
        </div>
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">
            场景与时间筛选
            {filters.scene !== "all" || filters.time !== "all"
              ? " · 已筛选"
              : ""}
          </summary>
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">场景</p>
              <div className="flex flex-wrap gap-1.5">
                {SCENE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.id}
                    type="button"
                    size="sm"
                    variant={filters.scene === opt.id ? "default" : "outline"}
                    aria-pressed={filters.scene === opt.id}
                    onClick={() =>
                      changeFilter({ scene: opt.id as HistoryQuery["scene"] })
                    }
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">起卦时间</p>
              <div className="flex flex-wrap gap-1.5">
                {TIME_OPTIONS.map((opt) => (
                  <Button
                    key={opt.id}
                    type="button"
                    size="sm"
                    variant={filters.time === opt.id ? "default" : "outline"}
                    aria-pressed={filters.time === opt.id}
                    onClick={() => changeFilter({ time: opt.id })}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </details>
        <p className="text-[11px] text-muted-foreground">
          收藏仅存在此设备；同题默认只展示已加载记录中最新的一局。
        </p>
      </div>

      <p
        className="text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {busy
          ? "正在找回记录…"
          : error
            ? "记录暂未更新，可重试。"
            : `已加载 ${items.length} / ${total} 局 · ${groups.length} 组问题`}
      </p>
      {error && (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-destructive/30 p-4"
        >
          <p className="text-sm text-destructive">{error}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setRevision((n) => n + 1)}
          >
            重试
          </Button>
        </div>
      )}

      <div aria-busy={busy} className="space-y-4">
        {!busy && !error && groups.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center">
            <p className="text-sm font-medium">烛火里暂时没有符合的记录</p>
            <p className="mt-1 text-xs text-muted-foreground">
              换个关键词、场景或时间再看看，也可以清除筛选。
            </p>
          </div>
        )}
        {groups.map((group) => {
          const multi = group.items.length > 1;
          const isExpanded = expanded[group.key] === true;
          const visible = isExpanded ? group.items : group.items.slice(0, 1);
          return (
            <section
              key={group.key}
              className={cn(
                multi &&
                  "space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-2 sm:p-3",
              )}
              aria-label={
                multi ? `同题已加载 ${group.items.length} 局` : undefined
              }
            >
              {multi && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-amber-100/90">
                      同题 · 已加载 {group.items.length} 局
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {group.label}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setExpanded((previous) => ({
                        ...previous,
                        [group.key]: !isExpanded,
                      }))
                    }
                  >
                    {isExpanded
                      ? "收起同题"
                      : `展开其余 ${group.items.length - 1} 局`}
                  </Button>
                </div>
              )}
              <div className="grid gap-3">
                {visible.map((item) => (
                  <HistoryCard
                    key={item.id}
                    reading={{
                      ...item,
                      canCompare: group.items.some(
                        (other) => other.createdAt < item.createdAt,
                      ),
                    }}
                    favorited={favoriteIds.includes(item.id)}
                    onToggleFavorite={(id) => {
                      toggleFavorite(id);
                      window.dispatchEvent(new Event(FAVORITES_EVENT));
                    }}
                    onChanged={refreshHistory}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {items.length < total && !error && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              setFilters((previous) => ({ ...previous, offset: items.length }))
            }
          >
            {busy ? "正在加载…" : `加载更多 · 还有 ${total - items.length} 局`}
          </Button>
        </div>
      )}
      {!busy && !error && items.length > 0 && items.length >= total && (
        <p className="text-center text-xs text-muted-foreground">
          符合条件的记录已全部加载
        </p>
      )}
    </div>
  );
}
