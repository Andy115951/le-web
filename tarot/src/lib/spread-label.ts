/** Display label for a spread type (UI / share / history). */
export function spreadLabel(spread: string): string {
  if (spread === "single") return "单牌";
  if (spread === "three_card") return "三牌";
  if (spread === "five_cross") return "情境五牌";
  if (spread === "relation_dual") return "关系双人";
  if (spread === "choice_fork") return "抉择分叉";
  if (spread === "moon_triad") return "月相三问";
  return spread;
}

/** One-line theatrical hint under spread options. */
export function spreadHint(spread: string): string | null {
  if (spread === "five_cross") {
    return "现状 · 挑战 · 过去影响 · 近期走向 · 建议";
  }
  if (spread === "relation_dual") {
    return "我方 / 对方 / 关系纽带 — 把双人戏拆开看";
  }
  if (spread === "choice_fork") {
    return "路径甲 / 路径乙 / 关键建议 — 分叉口的烛光对照";
  }
  if (spread === "moon_triad") {
    return "隐流 / 显象 / 应时之举 — 月下三问";
  }
  if (spread === "three_card") {
    return "过去 · 现在 · 未来";
  }
  if (spread === "single") {
    return "一盏启示，点到为止";
  }
  return null;
}
