/** Display label for a spread type (UI / share / history). */
export function spreadLabel(spread: string): string {
  if (spread === "single") return "单牌";
  if (spread === "three_card") return "三牌";
  if (spread === "five_cross") return "情境五牌";
  return spread;
}
