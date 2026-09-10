/**
 * Hybrid card art: optional center illustration under the CSS frame.
 * Files live at `public/cards/{cardId}.webp`. Only list ids that exist.
 * Majors first; minors stay on glyph UI until assets land.
 */
export const CARD_ART: Readonly<Record<string, string>> = {
  major_00: "/cards/major_00.webp",
  major_09: "/cards/major_09.webp",
  major_17: "/cards/major_17.webp",
};

export function getCardArtSrc(cardId: string | undefined | null): string | null {
  if (!cardId) return null;
  return CARD_ART[cardId] ?? null;
}

export function hasCardArt(cardId: string | undefined | null): boolean {
  return getCardArtSrc(cardId) != null;
}
