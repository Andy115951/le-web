import type { SceneId } from "@/data/scenes";
import type { HistoryCardData } from "@/components/history/history-card";

export type HistoryListItem = HistoryCardData & {
  scene: SceneId;
  createdAt: string;
  questionNormalized: string;
};
export type HistoryPageData = { items: HistoryListItem[]; total: number };

export function groupHistory(items: HistoryListItem[], favoriteIds: string[]) {
  const map = new Map<string, HistoryListItem[]>();
  for (const item of items) {
    const key = item.questionNormalized || item.id;
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }
  return [...map]
    .map(([key, readings]) => {
      // The visible representative is always the most recently created reading,
      // even when an older reading is starred or renamed more recently.
      readings.sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      );
      return {
        key,
        items: readings,
        label: readings[0].title || readings[0].question,
        hasFavorite: readings.some((r) => favoriteIds.includes(r.id)),
        latestAt: readings.reduce(
          (latest, r) => (r.updatedAt > latest ? r.updatedAt : latest),
          "",
        ),
      };
    })
    .sort(
      (a, b) =>
        Number(b.hasFavorite) - Number(a.hasFavorite) ||
        b.latestAt.localeCompare(a.latestAt),
    );
}
