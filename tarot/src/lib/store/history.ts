import { getCard } from "@/data/deck";
import {
  CUSTOM_SCENE,
  SCENES,
  type SceneId,
  type SpreadType,
} from "@/data/scenes";
import { normalizeQuestion } from "@/lib/normalize-question";
import { spreadLabel } from "@/lib/spread-label";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { queryHistoryRows, type HistoryQuery } from "@/lib/history-query";
import type { HistoryPageData } from "@/lib/history-groups";
import type { SpreadResult } from "@/lib/types";

export async function listHistoryPage(
  owner: { userId?: string | null; anonymousId?: string | null },
  query: HistoryQuery,
): Promise<HistoryPageData> {
  const { rows, total } = await queryHistoryRows(
    getSupabaseAdmin(),
    owner,
    query,
  );
  return {
    total,
    items: rows.map((r) => ({
      id: String(r.id),
      title: String(r.title || ""),
      question: String(r.question),
      questionNormalized: normalizeQuestion(String(r.question)),
      scene: r.scene as SceneId,
      sceneLabel:
        [...SCENES, CUSTOM_SCENE].find((s) => s.id === r.scene)?.label ??
        String(r.scene),
      spreadLabel: spreadLabel(r.spread_type as SpreadType),
      cardNames:
        (r.spread_result as SpreadResult | null)?.cards
          ?.map((c) => getCard(c.cardId)?.nameZh ?? c.cardId)
          .join(" / ") ?? "",
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    })),
  };
}
