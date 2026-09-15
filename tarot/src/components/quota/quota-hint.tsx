"use client";

import { usePathname } from "next/navigation";
import type { OAuthAvailability, QuotaBucket } from "@/hooks/use-quota";
import { GuestLoginCta } from "@/components/quota/guest-login-cta";

type Props = {
  loading?: boolean;
  user: { username: string } | null;
  usage: QuotaBucket;
  quota: QuotaBucket;
  remaining: QuotaBucket;
  oauth?: OAuthAvailability;
  /** readings | messages | both */
  focus?: "readings" | "messages" | "both";
  className?: string;
};

export function QuotaHint({
  loading,
  user,
  usage,
  quota,
  remaining,
  oauth,
  focus = "both",
  className = "",
}: Props) {
  const pathname = usePathname();

  if (loading) {
    return (
      <p className={`text-xs text-muted-foreground ${className}`} aria-live="polite">
        正在查看今日烛火额度…
      </p>
    );
  }

  const readingsLow = remaining.readings <= 1;
  const messagesLow = remaining.messages <= 1;
  const readingsDone = remaining.readings <= 0;
  const messagesDone = remaining.messages <= 0;

  const parts: string[] = [];
  if (focus === "readings" || focus === "both") {
    parts.push(`新占卜 ${usage.readings}/${quota.readings}`);
  }
  if (focus === "messages" || focus === "both") {
    parts.push(`追问 ${usage.messages}/${quota.messages}`);
  }

  let tip = "";
  if (focus !== "messages" && readingsDone) {
    tip = user
      ? "今日新占卜额度已用尽，明天再来点亮一盏吧。"
      : "访客今日起卦的烛火已用尽。登录后可以继续点亮，历史也会安静合并。";
  } else if (focus !== "readings" && messagesDone) {
    tip = user
      ? "今日追问额度已用尽，可以先回看这卦，或明天再续。"
      : "访客今日追问的烛火已用尽。登录后还能轻声多问几句。";
  } else if (focus !== "messages" && readingsLow) {
    tip = user
      ? "今日新占卜只剩最后一点烛火，且行且惜。"
      : "今日起卦只剩最后一点烛火。想留更多空间，可以先轻轻登录。";
  } else if (focus !== "readings" && messagesLow) {
    tip = user
      ? "今日追问只剩最后一两次，可以把问题问得更具体一点。"
      : "今日追问只剩最后一两次。登录后额度会更宽裕。";
  }

  const showGuestCta =
    !user &&
    ((focus !== "messages" && (readingsDone || readingsLow)) ||
      (focus !== "readings" && (messagesDone || messagesLow)));

  const ctaTip = readingsDone
    ? "轻轻登录，马上可以继续起卦；历史会合并，每日额度也会更宽。"
    : messagesDone
      ? "轻轻登录，马上可以继续追问；历史会合并，额度也会更宽裕。"
      : "轻轻登录，历史会合并到账号，每日额度也会更宽裕。";

  return (
    <div className={`space-y-2 text-xs text-muted-foreground ${className}`}>
      <p aria-live="polite">今日额度：{parts.join(" · ")}</p>
      {tip && !showGuestCta ? (
        <p className="text-amber-200/80">{tip}</p>
      ) : null}
      {tip && showGuestCta ? (
        <p className="text-sm text-amber-100/90">{tip}</p>
      ) : null}
      {showGuestCta ? (
        <GuestLoginCta
          nextPath={pathname}
          githubEnabled={oauth?.github}
          tip={ctaTip}
          compact
        />
      ) : null}
    </div>
  );
}
