"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { RitualSpeed } from "@/data/scenes";
import type { Message, Reading } from "@/lib/types";
import { useQuota } from "@/hooks/use-quota";
import { QuotaHint } from "@/components/quota/quota-hint";
import { RitualStage } from "@/components/reading/ritual-stage";
import { ShareReadingButton } from "@/components/reading/share-reading-button";
import { TarotCardFace } from "@/components/reading/tarot-card-face";
import { getCard } from "@/data/deck";
import {
  displayTextForUser,
  parseSubCardMessage,
} from "@/lib/sub-card-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type StreamEvent =
  | { t: "delta"; c: string }
  | { t: "done"; messages: Message[] }
  | { t: "error"; error: string };

class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

const SPEED_LABEL: Record<RitualSpeed, string> = {
  slow: "慢",
  normal: "常",
  fast: "快",
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function warmError(fallback: string, raw?: unknown): string {
  if (typeof raw === "string" && raw.trim()) {
    if (/stream|ndjson|json|status|fetch|network/i.test(raw)) {
      return fallback;
    }
    return raw;
  }
  return fallback;
}

function suggestsRedraw(text: string): boolean {
  return /新占卜|重新起卦|再起一卦|另起一卦/.test(text);
}

async function readNdjsonStream(
  res: Response,
  onDelta: (chunk: string) => void,
): Promise<Message[]> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      warmError(
        "烛火晃了一下，这次没能完成。稍后再试一次吧。",
        typeof data.error === "string" ? data.error : undefined,
      ),
      typeof data.code === "string" ? data.code : undefined,
    );
  }
  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("ndjson") || !res.body) {
    const data = await res.json();
    if (data.error) {
      throw new ApiError(
        warmError("烛火晃了一下，这次没能完成。稍后再试一次吧。", data.error),
        typeof data.code === "string" ? data.code : undefined,
      );
    }
    return data.messages as Message[];
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let messages: Message[] | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const event = JSON.parse(line) as StreamEvent;
      if (event.t === "delta") onDelta(event.c);
      else if (event.t === "done") messages = event.messages;
      else if (event.t === "error") {
        throw new ApiError(
          warmError("烛火晃了一下，这次没能完成。稍后再试一次吧。", event.error),
        );
      }
    }
  }

  if (!messages) {
    throw new ApiError("字句还没落定，烛火就灭了。请再试一次。");
  }
  return messages;
}

export function ReadingClient({
  initialReading,
  initialMessages,
}: {
  initialReading: Reading;
  initialMessages: Message[];
}) {
  const [reading] = useState(initialReading);
  const [messages, setMessages] = useState(initialMessages);
  const [ritualDone, setRitualDone] = useState(initialMessages.length > 0);
  const [interpreting, setInterpreting] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [redrawDismissed, setRedrawDismissed] = useState(false);
  const quotaState = useQuota();

  const streamQuery = useMemo(() => {
    const instant = prefersReducedMotion() ? "&instant=1" : "";
    return `?stream=1${instant}`;
  }, []);

  const userFollowUps = useMemo(
    () => messages.filter((m) => m.role === "user").length,
    [messages],
  );

  const assistantHintedRedraw = useMemo(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    return lastAssistant ? suggestsRedraw(lastAssistant.content) : false;
  }, [messages]);

  const showRedrawChip =
    !redrawDismissed &&
    ritualDone &&
    messages.some((m) => m.role === "assistant") &&
    (assistantHintedRedraw || userFollowUps >= 2);

  const runInterpret = useCallback(async () => {
    setInterpreting(true);
    setError("");
    setQuotaBlocked(false);
    setStreamingText("");
    try {
      const res = await fetch(
        `/api/readings/${reading.id}/interpret${streamQuery}`,
        {
          method: "POST",
          headers: { Accept: "application/x-ndjson" },
        },
      );
      const next = await readNdjsonStream(res, (chunk) => {
        setStreamingText((prev) => prev + chunk);
      });
      setMessages(next);
      setStreamingText("");
    } catch (e) {
      setError(
        warmError(
          "解读还没到来。稍后再试，或轻轻追问一次。",
          e instanceof Error ? e.message : undefined,
        ),
      );
      setStreamingText("");
    } finally {
      setInterpreting(false);
    }
  }, [reading.id, streamQuery]);

  useEffect(() => {
    if (ritualDone && messages.length === 0 && !interpreting) {
      void runInterpret();
    }
  }, [ritualDone, messages.length, interpreting, runInterpret]);

  async function sendFollowUp(opts?: { withSubSpread?: boolean }) {
    const withSubSpread = opts?.withSubSpread === true;
    const text = draft.trim();
    if (!withSubSpread && !text) return;
    if (!quotaState.loading && quotaState.remaining.messages <= 0) {
      setQuotaBlocked(true);
      setError(
        quotaState.user
          ? "今日追问额度已用尽，可以先回看这卦，或明天再续。"
          : "访客追问额度已用尽，请登录后继续。",
      );
      return;
    }
    setSending(true);
    setError("");
    setQuotaBlocked(false);
    setStreamingText("");
    const optimisticContent = withSubSpread
      ? `【子牌阵】${text || "象征牌抽取中…"}`
      : text;
    const optimistic: Message = {
      id: `local-${Date.now()}`,
      readingId: reading.id,
      role: "user",
      content: optimisticContent,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    try {
      const body: { content: string; subSpread?: "single" } = {
        content: text,
      };
      if (withSubSpread) body.subSpread = "single";
      const res = await fetch(
        `/api/readings/${reading.id}/messages${streamQuery}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/x-ndjson",
          },
          body: JSON.stringify(body),
        },
      );
      const next = await readNdjsonStream(res, (chunk) => {
        setStreamingText((prev) => prev + chunk);
      });
      setMessages(next);
      setStreamingText("");
      await quotaState.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === "quota") {
        setQuotaBlocked(true);
        await quotaState.refresh();
      }
      setError(
        warmError(
          "追问没能送出。稍后再试一次吧。",
          e instanceof Error ? e.message : undefined,
        ),
      );
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(text);
      setStreamingText("");
    } finally {
      setSending(false);
    }
  }

  const speedLabel = SPEED_LABEL[reading.ritualSpeed] ?? reading.ritualSpeed;
  const messagesExhausted =
    !quotaState.loading && quotaState.remaining.messages <= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {reading.title || "占卜"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{reading.question}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {reading.detailLevel === "brief" ? "简要" : "详细"}
          </Badge>
          <Badge variant="secondary" aria-label={`仪式速度：${speedLabel}`}>
            {speedLabel}
          </Badge>
          {ritualDone && messages.some((m) => m.role === "assistant") ? (
            <ShareReadingButton reading={reading} />
          ) : null}
          <Button asChild size="sm">
            <Link href="/reading/new">新占卜</Link>
          </Button>
        </div>
      </div>

      <RitualStage
        speed={reading.ritualSpeed}
        spread={reading.spreadResult}
        alreadyDone={initialMessages.length > 0}
        onDone={() => setRitualDone(true)}
      />

      {ritualDone && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">解读</CardTitle>
            <CardDescription>
              {interpreting || sending
                ? streamingText
                  ? "烛火摇曳，字句正浮现…"
                  : "烛火摇曳，正在生成…"
                : messages.length === 0
                  ? "牌已揭晓，解读即将到来…"
                  : "可继续追问"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {messages.length === 0 && !interpreting && !streamingText && !error ? (
              <p className="text-sm text-muted-foreground">
                烛火还在酝酿。若迟迟没有字句，可以稍后再试。
              </p>
            ) : null}
            <div className="space-y-3" aria-live="polite" aria-relevant="additions">
              {messages.map((m) => {
                const isUser = m.role === "user";
                const sub =
                  isUser && !m.content.startsWith("【子牌阵】")
                    ? parseSubCardMessage(m.content)
                    : { meta: null as null, text: m.content };
                const optimisticSub = isUser && m.content.startsWith("【子牌阵】");
                const bubbleText = sub.meta
                  ? displayTextForUser(m.content)
                  : optimisticSub
                    ? m.content.replace(/^【子牌阵】/, "").trim() || "象征牌抽取中…"
                    : m.content;
                const subCard = sub.meta ? getCard(sub.meta.cardId) : undefined;
                return (
                  <div
                    key={m.id}
                    className={
                      isUser
                        ? "ml-6 flex flex-col items-end gap-1 sm:ml-12"
                        : "mr-6 flex flex-col items-start gap-1 sm:mr-12"
                    }
                  >
                    <span
                      className={
                        isUser
                          ? "px-1 text-[10px] tracking-wider text-primary/80"
                          : "px-1 text-[10px] tracking-wider text-amber-200/70"
                      }
                    >
                      {isUser
                        ? sub.meta || optimisticSub
                          ? "子牌阵 · 追问"
                          : "你的追问"
                        : "烛火解读"}
                    </span>
                    <div
                      className={
                        isUser
                          ? "max-w-[95%] rounded-2xl rounded-br-md border border-primary/35 bg-primary/15 px-3.5 py-2.5 text-sm text-foreground shadow-[inset_0_0_18px_oklch(0.78_0.12_75/8%)]"
                          : "max-w-[95%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-amber-500/25 bg-card/55 px-3.5 py-2.5 text-sm leading-relaxed text-foreground/95 shadow-[inset_0_0_22px_oklch(0.78_0.12_75/10%)]"
                      }
                    >
                      {sub.meta ? (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-end gap-2">
                            <div className="text-right text-[11px] leading-snug text-muted-foreground">
                              <div className="font-medium text-foreground/90">
                                {sub.meta.positionLabel || "象征"}
                              </div>
                              <div>
                                {subCard?.nameZh ?? sub.meta.cardId} ·{" "}
                                {sub.meta.reversed ? "逆位" : "正位"}
                              </div>
                            </div>
                            <TarotCardFace
                              card={subCard}
                              reversed={sub.meta.reversed}
                              compact
                              className="w-16 shrink-0 sm:w-20"
                            />
                          </div>
                          <p className="w-full whitespace-pre-wrap text-left">
                            {bubbleText}
                          </p>
                        </div>
                      ) : optimisticSub ? (
                        <div className="space-y-1">
                          <p className="text-[11px] text-primary/80">子牌阵 · 象征牌抽取中…</p>
                          {bubbleText ? (
                            <p className="whitespace-pre-wrap">{bubbleText}</p>
                          ) : null}
                        </div>
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                );
              })}
              {streamingText && (
                <div className="mr-6 flex flex-col items-start gap-1 sm:mr-12">
                  <span className="px-1 text-[10px] tracking-wider text-amber-200/70">
                    烛火解读
                  </span>
                  <div
                    className="max-w-[95%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-amber-500/35 bg-card/55 px-3.5 py-2.5 text-sm leading-relaxed shadow-[inset_0_0_22px_oklch(0.78_0.12_75/10%)]"
                    aria-label="正在浮现的解读"
                  >
                    {streamingText}
                    <span
                      className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-amber-400/80 align-middle"
                      aria-hidden
                    />
                  </div>
                </div>
              )}
            </div>
            {error && (
              <div className="space-y-1" role="alert">
                <p className="text-sm text-destructive">{error}</p>
                {quotaBlocked && !quotaState.user ? (
                  <p className="text-sm text-muted-foreground">
                    <Link
                      href="/login"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      去登录
                    </Link>
                    ，历史会自动合并，追问额度也会更宽裕。
                  </p>
                ) : null}
              </div>
            )}
            {showRedrawChip ? (
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2"
                role="status"
              >
                <p className="text-sm text-amber-100/90">
                  {assistantHintedRedraw
                    ? "话题似乎换了。若想另起一卦，可以轻轻点亮新烛火。"
                    : "追问已经走了一段。若主题变了，建议重新起卦，牌面会更贴切。"}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setRedrawDismissed(true)}
                  >
                    先留下
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/reading/new">新占卜</Link>
                  </Button>
                </div>
              </div>
            ) : null}
            {messages.some((m) => m.role === "assistant") ? (
              <div className="space-y-2">
                <QuotaHint
                  loading={quotaState.loading}
                  user={quotaState.user}
                  usage={quotaState.usage}
                  quota={quotaState.quota}
                  remaining={quotaState.remaining}
                  focus="messages"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        // IME composing (e.g. Pinyin) — let Enter confirm candidates
                        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                        // Desktop only: Enter sends; Shift/Ctrl/Meta+Enter inserts newline
                        if (e.shiftKey || e.ctrlKey || e.metaKey) return;
                        const desktop =
                          typeof window !== "undefined" &&
                          window.matchMedia("(pointer: fine) and (hover: hover)")
                            .matches;
                        if (!desktop) return;
                        e.preventDefault();
                        if (sending || interpreting || messagesExhausted) return;
                        void sendFollowUp();
                      }}
                      placeholder={
                        messagesExhausted
                          ? "今日追问额度已用尽…"
                          : "继续追问…（子牌阵可留空）"
                      }
                      rows={2}
                      className="resize-none"
                      disabled={sending || interpreting || messagesExhausted}
                      aria-label="追问内容"
                    />
                    <p className="hidden text-xs text-muted-foreground sm:block">
                      Enter 发送 · Shift / Ctrl + Enter 换行 · 子牌阵消耗 1 次追问
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:w-auto">
                    <Button
                      onClick={() => void sendFollowUp()}
                      disabled={
                        sending ||
                        interpreting ||
                        messagesExhausted ||
                        !draft.trim()
                      }
                      aria-label="发送追问"
                    >
                      发送
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void sendFollowUp({ withSubSpread: true })}
                      disabled={sending || interpreting || messagesExhausted}
                      aria-label="抽一张象征牌，子牌阵，消耗一次追问额度，文字可选"
                      title="抽一张象征牌（消耗 1 次追问，文字可选）"
                    >
                      抽一张象征牌
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
