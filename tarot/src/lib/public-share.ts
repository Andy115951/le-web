import { getCard } from "@/data/deck";
import { CUSTOM_SCENE, PRODUCT_NAME, SCENES } from "@/data/scenes";
import { spreadLabel } from "@/lib/spread-label";
import type { Reading } from "@/lib/types";

/** Public path for an opaque share token (no reading UUID). */
export function publicSharePath(token: string): string {
  return `/s/${encodeURIComponent(token)}`;
}

export function publicShareAbsoluteUrl(token: string, origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${publicSharePath(token)}`;
}

function sceneLabel(scene: string): string {
  if (scene === CUSTOM_SCENE.id) return CUSTOM_SCENE.label;
  return SCENES.find((s) => s.id === scene)?.label ?? scene;
}

/** Safe DTO for the public share page — no ids, account, or AI text. */
export type PublicShareView = {
  question: string;
  sceneLabel: string;
  spreadLabel: string;
  cards: Array<{
    positionLabel: string;
    nameZh: string;
    reversed: boolean;
    cardId: string;
  }>;
  /** Optional short tasteful line (not AI reading). */
  verse: string;
  disclaimer: string;
  productName: string;
};

export function toPublicShareView(reading: Reading): PublicShareView {
  const question = reading.question.trim() || reading.title || "（未命名）";
  const cards = reading.spreadResult.cards.map((c) => {
    const card = getCard(c.cardId);
    return {
      positionLabel: c.positionLabel,
      nameZh: card?.nameZh ?? c.cardId,
      reversed: c.reversed,
      cardId: c.cardId,
    };
  });

  return {
    question,
    sceneLabel: sceneLabel(reading.scene),
    spreadLabel: spreadLabel(reading.spreadType),
    cards,
    verse: "牌阵是当下的一面镜子，不是定论。决定仍在你手里。",
    disclaimer: "仅供娱乐与自我反思，不构成确定预言。",
    productName: PRODUCT_NAME,
  };
}
