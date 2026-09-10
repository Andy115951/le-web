/** P0 stub — full 78-card deck lands in P1 */
export type DeckCard = {
  id: string;
  nameZh: string;
  nameEn: string;
  arcana: "major" | "minor";
  suit?: "wands" | "cups" | "swords" | "pentacles";
  keywords: string[];
};

export const DECK_STUB: DeckCard[] = [
  { id: "major_00", nameZh: "愚者", nameEn: "The Fool", arcana: "major", keywords: ["开始", "跳跃"] },
  { id: "major_01", nameZh: "魔术师", nameEn: "The Magician", arcana: "major", keywords: ["意志", "显化"] },
  { id: "major_02", nameZh: "女祭司", nameEn: "The High Priestess", arcana: "major", keywords: ["直觉", "静默"] },
  { id: "cups_03", nameZh: "圣杯三", nameEn: "Three of Cups", arcana: "minor", suit: "cups", keywords: ["庆典", "联结"] },
  { id: "wands_09", nameZh: "权杖九", nameEn: "Nine of Wands", arcana: "minor", suit: "wands", keywords: ["坚持", "警惕"] },
  { id: "swords_08", nameZh: "宝剑八", nameEn: "Eight of Swords", arcana: "minor", suit: "swords", keywords: ["困住", "心障"] },
];
