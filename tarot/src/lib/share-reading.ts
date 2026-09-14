import { getCard } from "@/data/deck";
import { CUSTOM_SCENE, PRODUCT_NAME, SCENES } from "@/data/scenes";
import { spreadLabel } from "@/lib/spread-label";
import type { Reading } from "@/lib/types";

function sceneLabel(scene: string): string {
  if (scene === CUSTOM_SCENE.id) return CUSTOM_SCENE.label;
  return SCENES.find((s) => s.id === scene)?.label ?? scene;
}

/** Plain-text summary safe to copy / share (no ids, cookies, or AI internals). Moments-friendly. */
export function formatReadingShareText(reading: Reading): string {
  const question = reading.question.trim() || reading.title || "（未命名）";
  const lines: string[] = [
    `🕯️ ${PRODUCT_NAME}`,
    `今晚这一问：${question}`,
    `场景 · ${sceneLabel(reading.scene)}　牌阵 · ${spreadLabel(reading.spreadType)}`,
    "",
    "烛下牌面：",
  ];

  for (const c of reading.spreadResult.cards) {
    const card = getCard(c.cardId);
    const name = card?.nameZh ?? c.cardId;
    const orient = c.reversed ? "逆位" : "正位";
    lines.push(`· ${c.positionLabel}：${name}（${orient}）`);
  }

  lines.push(
    "",
    "牌阵是当下的一面镜子，不是定论。决定仍在你手里。",
    "仅供娱乐与自我反思，不构成确定预言。",
    `— 来自 ${PRODUCT_NAME}，愿烛火陪你轻轻看清一步`,
  );

  return lines.join("\n");
}

export function shareReadingTitle(reading: Reading): string {
  const q = reading.question.trim() || reading.title || "占卜";
  const short = q.length > 24 ? `${q.slice(0, 24)}…` : q;
  return `${PRODUCT_NAME} · ${short}`;
}
