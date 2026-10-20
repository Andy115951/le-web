import type { SupabaseClient } from "@supabase/supabase-js";
import type { SceneId } from "@/data/scenes";

export const HISTORY_PAGE_SIZE = 20;
export type HistoryQuery = {
  search: string;
  scene: "all" | SceneId;
  time: "all" | "7d" | "30d" | "older";
  offset: number;
  favoriteIds: string[] | null;
};
export const DEFAULT_HISTORY_QUERY: HistoryQuery = {
  search: "",
  scene: "all",
  time: "all",
  offset: 0,
  favoriteIds: null,
};

export function parseHistoryQuery(input: unknown): HistoryQuery {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("无效的历史筛选");
  const value = { ...DEFAULT_HISTORY_QUERY, ...input };
  if (
    typeof value.search !== "string" ||
    value.search.length > 200 ||
    ![
      "all",
      "love",
      "career",
      "study",
      "social",
      "choice",
      "body",
      "custom",
    ].includes(value.scene) ||
    !["all", "7d", "30d", "older"].includes(value.time) ||
    !Number.isSafeInteger(value.offset) ||
    value.offset < 0 ||
    !Number.isSafeInteger(value.offset + HISTORY_PAGE_SIZE - 1) ||
    (value.favoriteIds !== null &&
      (!Array.isArray(value.favoriteIds) ||
        value.favoriteIds.length > 2000 ||
        !value.favoriteIds.every(
          (id: unknown) =>
            typeof id === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              id,
            ),
        )))
  ) {
    throw new Error("无效的历史筛选");
  }
  return {
    search: value.search.trim(),
    scene: value.scene,
    time: value.time,
    offset: value.offset,
    favoriteIds:
      value.favoriteIds === null ? null : [...new Set(value.favoriteIds)],
  };
}

// A literal, case-insensitive regex avoids PostgREST's '*' alias for LIKE '%'.
// Escape regex metacharacters first, then quote the PostgREST value so a search
// string cannot inject additional filters into the OR expression.
export function historySearchFilter(search: string) {
  const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const quoted = `"${pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return `title.imatch.${quoted},question.imatch.${quoted}`;
}

export async function queryHistoryRows(
  client: SupabaseClient,
  owner: { userId?: string | null; anonymousId?: string | null },
  query: HistoryQuery,
  now = new Date(),
) {
  if ((!owner.userId && !owner.anonymousId) || query.favoriteIds?.length === 0)
    return { rows: [], total: 0 };
  function base(head = false) {
    let q = client
      .from("tarot_readings")
      .select(
        "id,title,question,scene,spread_type,spread_result,created_at,updated_at",
        { count: "exact", head },
      )
      .is("deleted_at", null);
    q = owner.userId
      ? q.eq("user_id", owner.userId)
      : q.eq("anonymous_id", owner.anonymousId!);
    if (query.scene !== "all") q = q.eq("scene", query.scene);
    if (query.search) q = q.or(historySearchFilter(query.search));
    if (query.time !== "all") {
      const days = query.time === "7d" ? 7 : 30;
      const since = new Date(now.getTime() - days * 86400000).toISOString();
      // History's time filter describes when the reading began, not a later rename.
      q =
        query.time === "older"
          ? q.lt("created_at", since)
          : q.gte("created_at", since);
    }
    return q
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false });
  }
  if (query.favoriteIds !== null) {
    // Small batches avoid an oversized PostgREST URL. IDs are only a filter;
    // every batch still enforces the authenticated owner and soft-delete scope.
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < query.favoriteIds.length; i += 100) {
      const { data, error } = await base()
        .in("id", query.favoriteIds.slice(i, i + 100))
        .range(0, 99);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
    }
    rows.sort(
      (a, b) =>
        String(b.updated_at).localeCompare(String(a.updated_at)) ||
        String(b.id).localeCompare(String(a.id)),
    );
    return {
      rows: rows.slice(query.offset, query.offset + HISTORY_PAGE_SIZE),
      total: rows.length,
    };
  }
  const { data, count, error } = await base().range(
    query.offset,
    query.offset + HISTORY_PAGE_SIZE - 1,
  );
  if (error?.code === "PGRST103") {
    // PostgREST returns 416 instead of an empty array when the requested
    // offset is beyond the current total (e.g. another tab deleted records).
    const { count: total, error: countError } = await base(true);
    if (countError) throw new Error(countError.message);
    return { rows: [], total: total ?? 0 };
  }
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Record<string, unknown>[], total: count ?? 0 };
}
