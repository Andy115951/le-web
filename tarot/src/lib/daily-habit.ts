/** P51 — 今日一牌习惯：主屏打开落点 + 可关站内轻提醒（不做桌面小组件 / 不做 push） */

const NUDGE_DISMISS_KEY = "candle-taro:daily-habit-nudge-dismissed-day";
const OPEN_SCROLL_SESSION_KEY = "candle-taro:daily-habit-open-scrolled";

/** Asia/Shanghai calendar day YYYY-MM-DD (client-safe; no Node crypto). */
export function shanghaiDayKeyClient(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** True when running as installed PWA / standalone display mode. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    // iOS Safari "Add to Home Screen"
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) return true;
    return false;
  } catch {
    return false;
  }
}

export function wasDailyHabitNudgeDismissedToday(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return (
      window.localStorage.getItem(NUDGE_DISMISS_KEY) === shanghaiDayKeyClient()
    );
  } catch {
    return true;
  }
}

export function dismissDailyHabitNudgeForToday(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NUDGE_DISMISS_KEY, shanghaiDayKeyClient());
  } catch {
    // ignore quota / private mode
  }
}

/** Once per browser tab/session — avoid re-scrolling on every home revisit. */
export function consumeOpenScrollOnce(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(OPEN_SCROLL_SESSION_KEY) === "1") {
      return false;
    }
    window.sessionStorage.setItem(OPEN_SCROLL_SESSION_KEY, "1");
    return true;
  } catch {
    return true;
  }
}

export const DAILY_CARD_SECTION_ID = "daily-card";
