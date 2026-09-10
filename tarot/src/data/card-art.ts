/**
 * Hybrid card art: optional center illustration under the CSS frame.
 * Files live at `public/cards/{cardId}.webp`. Only list ids that exist.
 * Majors complete; Cups ace–seven in progress; other minors stay glyph.
 */
export const CARD_ART: Readonly<Record<string, string>> = {
  major_00: "/cards/major_00.webp",
  major_01: "/cards/major_01.webp",
  major_02: "/cards/major_02.webp",
  major_03: "/cards/major_03.webp",
  major_04: "/cards/major_04.webp",
  major_05: "/cards/major_05.webp",
  major_06: "/cards/major_06.webp",
  major_07: "/cards/major_07.webp",
  major_08: "/cards/major_08.webp",
  major_09: "/cards/major_09.webp",
  major_10: "/cards/major_10.webp",
  major_11: "/cards/major_11.webp",
  major_12: "/cards/major_12.webp",
  major_13: "/cards/major_13.webp",
  major_14: "/cards/major_14.webp",
  major_15: "/cards/major_15.webp",
  major_16: "/cards/major_16.webp",
  major_17: "/cards/major_17.webp",
  major_18: "/cards/major_18.webp",
  major_19: "/cards/major_19.webp",
  major_20: "/cards/major_20.webp",
  major_21: "/cards/major_21.webp",
  cups_ace: "/cards/cups_ace.webp",
  cups_two: "/cards/cups_two.webp",
  cups_three: "/cards/cups_three.webp",
  cups_four: "/cards/cups_four.webp",
  cups_five: "/cards/cups_five.webp",
  cups_six: "/cards/cups_six.webp",
  cups_seven: "/cards/cups_seven.webp",
};

export function getCardArtSrc(cardId: string | undefined | null): string | null {
  if (!cardId) return null;
  return CARD_ART[cardId] ?? null;
}

export function hasCardArt(cardId: string | undefined | null): boolean {
  return getCardArtSrc(cardId) != null;
}
