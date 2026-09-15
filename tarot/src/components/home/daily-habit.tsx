"use client";

import { useEffect, useState } from "react";
import {
  DAILY_CARD_SECTION_ID,
  consumeOpenScrollOnce,
  dismissDailyHabitNudgeForToday,
  isStandaloneDisplay,
  wasDailyHabitNudgeDismissedToday,
} from "@/lib/daily-habit";
import { readUserPrefs } from "@/lib/user-prefs";

function scrollToDailyCard(smooth: boolean) {
  const el = document.getElementById(DAILY_CARD_SECTION_ID);
  if (!el) return;
  el.scrollIntoView({
    behavior: smooth ? "smooth" : "auto",
    block: "start",
  });
  try {
    el.focus({ preventScroll: true });
  } catch {
    /* ignore */
  }
}

/**
 * P51 — when prefs.openToDailyCard, scroll once per session to 今日一牌
 * (PWA start_url is `/`; works in browser too if pref on).
 */
export function DailyHabitOpenScroll() {
  useEffect(() => {
    const prefs = readUserPrefs();
    if (!prefs.openToDailyCard) return;
    if (!consumeOpenScrollOnce()) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const t = window.setTimeout(() => scrollToDailyCard(!reduce), 80);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}

/**
 * P51 — soft in-app reminder when opening as standalone PWA.
 * Pref-gated, once per Shanghai day, dismissable; no Notification API.
 */
export function DailyHabitNudge() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const prefs = readUserPrefs();
    if (!prefs.dailyHabitNudge) return;
    if (!isStandaloneDisplay()) return;
    if (wasDailyHabitNudgeDismissedToday()) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    dismissDailyHabitNudgeForToday();
    setVisible(false);
  }

  function look() {
    dismissDailyHabitNudgeForToday();
    setVisible(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollToDailyCard(!reduce);
  }

  return (
    <aside
      className="mx-auto max-w-md rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-left"
      aria-label="今日一牌轻提醒"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1 text-xs leading-relaxed text-muted-foreground">
          <p>主屏烛火已亮。今日一牌在下面，轻轻看一眼即可——不计额度。</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            onClick={look}
            className="rounded-md px-1.5 py-0.5 text-[11px] text-primary transition-colors hover:bg-primary/10"
          >
            去看
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground/80 transition-colors hover:bg-muted/40"
            aria-label="今日不再提醒"
          >
            今日不再
          </button>
        </div>
      </div>
    </aside>
  );
}
