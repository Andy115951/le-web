"use client";

import Link from "next/link";
import type { QuotaBucket } from "@/hooks/use-quota";

type Props = {
  loading?: boolean;
  user: { username: string } | null;
  usage: QuotaBucket;
  quota: QuotaBucket;
  remaining: QuotaBucket;
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
  focus = "both",
  className = "",
}: Props) {
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
      : "访客今日起卦额度已用尽，登录后额度会更多。";
  } else if (focus !== "readings" && messagesDone) {
    tip = user
      ? "今日追问额度已用尽，可以先回看这卦，或明天再续。"
      : "访客追问额度已用尽，登录后可继续轻声追问。";
  } else if (focus !== "messages" && readingsLow) {
    tip = "今日新占卜只剩最后一点烛火，且行且惜。";
  } else if (focus !== "readings" && messagesLow) {
    tip = "今日追问只剩最后一两次，可以把问题问得更具体一点。";
  }

  return (
    <div className={`space-y-1 text-xs text-muted-foreground ${className}`}>
      <p aria-live="polite">今日额度：{parts.join(" · ")}</p>
      {tip ? <p className="text-amber-200/80">{tip}</p> : null}
      {!user && (readingsDone || messagesDone || readingsLow) ? (
        <p>
          <Link href="/login" className="text-primary underline-offset-2 hover:underline">
            去登录
          </Link>
          ，历史会自动合并，额度也会更宽裕。
        </p>
      ) : null}
    </div>
  );
}
