/**
 * P46 soft favorites — reading ids in localStorage.
 * Works for logged-in and guest on this device; no DB column.
 * Key: candle-taro:history-favorites
 */
const STORAGE_KEY = "candle-taro:history-favorites";

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // ignore quota / private mode
  }
}

export function listFavoriteIds(): string[] {
  return readIds();
}

export function isFavorite(id: string): boolean {
  return readIds().includes(id);
}

export function setFavorite(id: string, next: boolean): string[] {
  const cur = readIds();
  const ids = next
    ? cur.includes(id)
      ? cur
      : [...cur, id]
    : cur.filter((x) => x !== id);
  writeIds(ids);
  return ids;
}

export function toggleFavorite(id: string): { ids: string[]; favorited: boolean } {
  const favorited = !isFavorite(id);
  const ids = setFavorite(id, favorited);
  return { ids, favorited };
}
