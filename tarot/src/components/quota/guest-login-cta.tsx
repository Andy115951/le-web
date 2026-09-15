"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { loginHref, oauthHref } from "@/lib/auth/safe-next";

type Props = {
  /** Where to return after login */
  nextPath?: string | null;
  githubEnabled?: boolean;
  /** Soft candle tip above the buttons */
  tip?: string;
  className?: string;
  /** denser layout for inline error areas */
  compact?: boolean;
};

/**
 * P45 — warm, short-path guest → login CTA.
 * Primary: login page (with next). Optional one-tap GitHub when configured.
 * Google remains optional and is not required here.
 */
export function GuestLoginCta({
  nextPath,
  githubEnabled = false,
  tip = "轻轻登录，历史会合并到账号，每日额度也会更宽裕。",
  className = "",
  compact = false,
}: Props) {
  return (
    <div
      className={`rounded-lg border border-amber-500/30 bg-amber-500/5 ${
        compact ? "space-y-2 px-3 py-2.5" : "space-y-2.5 px-3.5 py-3"
      } ${className}`}
      role="region"
      aria-label="登录引导"
    >
      <p className={`${compact ? "text-xs" : "text-sm"} text-amber-100/90`}>
        {tip}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size={compact ? "sm" : "default"}>
          <Link href={loginHref(nextPath)} prefetch>
            轻轻登录
          </Link>
        </Button>
        {githubEnabled ? (
          <Button asChild size={compact ? "sm" : "default"} variant="outline">
            <a href={oauthHref("github", nextPath)}>使用 GitHub 继续</a>
          </Button>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground">
        访客记录会安静并入账号 · 不改今日已用额度数字
      </p>
    </div>
  );
}
