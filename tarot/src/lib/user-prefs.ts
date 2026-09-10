import type { DetailLevel, RitualSpeed } from "@/data/scenes";

const STORAGE_KEY = "candle-taro:user-prefs";

export type UserPrefs = {
  ritualSpeed: RitualSpeed;
  detailLevel: DetailLevel;
};

export const DEFAULT_USER_PREFS: UserPrefs = {
  ritualSpeed: "normal",
  detailLevel: "brief",
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
    };
  } catch {
    return { ...DEFAULT_USER_PREFS };
  }
}

export function writeUserPrefs(prefs: UserPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
