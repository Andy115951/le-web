import type { Message } from "@/lib/types";

export type TimelineStepId = "reveal" | "interpret" | "followup" | "token";

export type TimelineStepStatus = "pending" | "current" | "done";

export type TimelineStep = {
  id: TimelineStepId;
  label: string;
  hint: string;
  anchor: string;
  status: TimelineStepStatus;
  /** Section exists in DOM / is safe to scroll to */
  reachable: boolean;
};

export const TIMELINE_ANCHORS = {
  reveal: "reading-reveal",
  interpret: "reading-interpret",
  followup: "reading-followup",
  token: "reading-token",
} as const;

/**
 * Derive in-reading timeline from ritual / messages / local token flag.
 * No DB — rewind nav only.
 */
export function deriveReadingTimeline(opts: {
  ritualDone: boolean;
  messages: Message[];
  interpreting: boolean;
  tokenLit: boolean;
}): TimelineStep[] {
  const { ritualDone, messages, interpreting, tokenLit } = opts;
  const hasAssistant = messages.some((m) => m.role === "assistant");
  const hasFollowUp = messages.some((m) => m.role === "user");

  const allDone = ritualDone && hasAssistant && hasFollowUp && tokenLit;

  let phase: TimelineStepId;
  if (!ritualDone) phase = "reveal";
  else if (!hasAssistant) phase = "interpret";
  else if (!hasFollowUp) phase = "followup";
  else if (!tokenLit) phase = "token";
  else phase = "token";

  function statusFor(id: TimelineStepId): TimelineStepStatus {
    if (allDone) return "done";
    if (id === "reveal") return ritualDone ? "done" : "current";
    if (id === "interpret") {
      if (!ritualDone) return "pending";
      if (hasAssistant) return "done";
      return "current";
    }
    if (id === "followup") {
      if (!hasAssistant) return "pending";
      if (hasFollowUp) return "done";
      return "current";
    }
    if (!hasAssistant) return "pending";
    if (tokenLit) return "done";
    return phase === "token" ? "current" : "pending";
  }

  return [
    {
      id: "reveal",
      label: "揭晓",
      hint: ritualDone ? "牌面已落定" : "仪式进行中",
      anchor: TIMELINE_ANCHORS.reveal,
      status: statusFor("reveal"),
      reachable: ritualDone,
    },
    {
      id: "interpret",
      label: "解读",
      hint: interpreting
        ? "字句浮现中"
        : hasAssistant
          ? "可回看"
          : "烛火开口",
      anchor: TIMELINE_ANCHORS.interpret,
      status: statusFor("interpret"),
      reachable: ritualDone,
    },
    {
      id: "followup",
      label: "追问",
      hint: hasFollowUp ? "已追问" : "象征牌也可",
      anchor: TIMELINE_ANCHORS.followup,
      status: statusFor("followup"),
      reachable: hasAssistant,
    },
    {
      id: "token",
      label: "信物",
      hint: tokenLit ? "已点亮" : "留住这局",
      anchor: TIMELINE_ANCHORS.token,
      status: statusFor("token"),
      reachable: hasAssistant,
    },
  ];
}

const TOKEN_LIT_PREFIX = "candle-taro:token-lit:";

export function hasTokenLitLocal(readingId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TOKEN_LIT_PREFIX + readingId) === "1";
  } catch {
    return false;
  }
}

export function markTokenLitLocal(readingId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_LIT_PREFIX + readingId, "1");
  } catch {
    /* ignore */
  }
}
