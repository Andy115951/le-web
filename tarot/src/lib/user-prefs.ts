import type { DetailLevel, RitualSpeed } from "@/data/scenes";

const STORAGE_KEY = "candle-taro:user-prefs";

export type UserPrefs = {
  ritualSpeed: RitualSpeed;
  detailLevel: DetailLevel;
  silentReveal: boolean;
  /** P51: on home open, scroll once to 今日一牌 (esp. PWA start). */
  openToDailyCard: boolean;
  /** P51: soft in-app reminder when opening as standalone PWA (dismissable / off). */
  dailyHabitNudge: boolean;
};

export const DEFAULT_USER_PREFS: UserPrefs = {
  ritualSpeed: "normal",
  detailLevel: "brief",
  silentReveal: false,
  openToDailyCard: false,
  dailyHabitNudge: false,
};

function isRitualSpeed(v: unknown): v is RitualSpeed {
  return v === "slow" || v === "normal" || v === "fast";
}

function isDetailLevel(v: unknown): v is DetailLevel {
  return v === "brief" || v === "detailed";
}

export function readUserPrefs(): UserPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_USER_PREFS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_USER_PREFS };
    const parsed = JSON.parse(raw) as Partial<UserPrefs>;
    return {
      ritualSpeed: isRitualSpeed(parsed.ritualSpeed)
        ? parsed.ritualSpeed
        : DEFAULT_USER_PREFS.ritualSpeed,
      detailLevel: isDetailLevel(parsed.detailLevel)
        ? parsed.detailLevel
        : DEFAULT_USER_PREFS.detailLevel,
      silentReveal:
        typeof parsed.silentReveal === "boolean"
          ? parsed.silentReveal
          : DEFAULT_USER_PREFS.silentReveal,
      openToDailyCard:
        typeof parsed.openToDailyCard === "boolean"
          ? parsed.openToDailyCard
          : DEFAULT_USER_PREFS.openToDailyCard,
      dailyHabitNudge:
        typeof parsed.dailyHabitNudge === "boolean"
          ? parsed.dailyHabitNudge
          : DEFAULT_USER_PREFS.dailyHabitNudge,
    };
  } catch {
    return { ...DEFAULT_USER_PREFS };
  }
}

export function writeUserPrefs(prefs: UserPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
