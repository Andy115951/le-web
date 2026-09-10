import { getCard } from "@/data/deck";
import { CUSTOM_SCENE, PRODUCT_NAME, SCENES } from "@/data/scenes";
import type { Reading } from "@/lib/types";

function sceneLabel(scene: string): string {
  if (scene === CUSTOM_SCENE.id) return CUSTOM_SCENE.label;
  return SCENES.find((s) => s.id === scene)?.label ?? scene;
}

function spreadLabel(spread: string): string {
  if (spread === "single") return "单牌";
  if (spread === "three_card") return "三牌";
  return spread;
}

/** Plain-text summary safe to copy / share (no ids, cookies, or AI internals). */
export function formatReadingShareText(reading: Reading): string {
  const lines: string[] = [
    `🕯️ ${PRODUCT_NAME}`,
    `问题：${reading.question.trim() || reading.title || "（未命名）"}`,
    `场景：${sceneLabel(reading.scene)} · 牌阵：${spreadLabel(reading.spreadType)}`,
    "",
    "牌面：",
  ];

  for (const c of reading.spreadResult.cards) {
    const card = getCard(c.cardId);
    const name = card?.nameZh ?? c.cardId;
    const orient = c.reversed ? "逆位" : "正位";
    lines.push(`· ${c.positionLabel}：${name}（${orient}）`);
  }

  lines.push(
    "",
    "仅供娱乐与自我反思，不构成确定预言。牌阵是当下的一面镜子，决定仍在你手里。",
    `— 来自 ${PRODUCT_NAME}`,
  );

  return lines.join("\n");
}

export function shareReadingTitle(reading: Reading): string {
  const q = reading.question.trim() || reading.title || "占卜";
  const short = q.length > 28 ? `${q.slice(0, 28)}…` : q;
  return `${PRODUCT_NAME} · ${short}`;
}
