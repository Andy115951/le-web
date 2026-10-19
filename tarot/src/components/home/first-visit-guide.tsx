"use client";

import { useEffect, useState } from "react";
import {
  hasSeenFirstVisitGuide,
  markFirstVisitGuideSeen,
} from "@/lib/first-visit";

/**
 * P44 — tiny first-visit candlelight aside near the home CTA.
 * Not a modal/wizard; dismiss once via localStorage.
 */
export function FirstVisitGuide() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasSeenFirstVisitGuide()) setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    markFirstVisitGuideSeen();
    setVisible(false);
  }

  return (
    <aside
      className="mx-auto max-w-md rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-left"
      aria-label="怎么起一卦"
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
          第一次来？选一个场景，按自己的话改写示例问题，再点亮这一卦。
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-primary/80 transition-colors hover:bg-primary/10 hover:text-primary"
          aria-label="知道了，不再显示"
        >
          知道了
        </button>
      </div>
    </aside>
  );
}
