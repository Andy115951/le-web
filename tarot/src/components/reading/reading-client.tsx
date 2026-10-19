"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { RitualSpeed } from "@/data/scenes";
import type { Message, Reading } from "@/lib/types";
import { useQuota } from "@/hooks/use-quota";
import { QuotaHint } from "@/components/quota/quota-hint";
import { GuestLoginCta } from "@/components/quota/guest-login-cta";
import { RitualStage } from "@/components/reading/ritual-stage";
import { ShareReadingButton } from "@/components/reading/share-reading-button";
import { PublicShareButton } from "@/components/reading/public-share-button";
import { CandleTokenButton } from "@/components/reading/candle-token-button";
import { ReadingTimeline } from "@/components/reading/reading-timeline";
import { ComparePriorSection } from "@/components/reading/compare-prior-section";
import {
  TIMELINE_ANCHORS,
  hasTokenLitLocal,
  markTokenLitLocal,
} from "@/lib/reading-timeline";
import { TarotCardFace } from "@/components/reading/tarot-card-face";
import { AdvisorMarkdown } from "@/components/reading/advisor-markdown";
import { getCard } from "@/data/deck";
import {
  displayTextForUser,
  parseSubSpreadMessage,
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
  priorReading = null,
}: {
  initialReading: Reading;
  initialMessages: Message[];
  priorReading?: Reading | null;
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
  const [tokenLit, setTokenLit] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const interpretationRequested = useRef(false);
  const quotaState = useQuota();

  function focusFollowUp() {
    composerRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "center",
    });
    composerRef.current?.focus({ preventScroll: true });
  }

  function showLatestReply() {
    document.getElementById("reading-latest-reply")?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }

  useEffect(() => {
    setTokenLit(hasTokenLitLocal(reading.id));
  }, [reading.id]);

  const markTokenLit = useCallback(() => {
    markTokenLitLocal(reading.id);
    setTokenLit(true);
  }, [reading.id]);

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
    // One automatic attempt per mounted reading; failed attempts wait for the retry CTA.
    interpretationRequested.current = true;
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
    if (
      ritualDone &&
      messages.length === 0 &&
      !interpreting &&
      !reading.silentReveal &&
      !interpretationRequested.current
    ) {
      void runInterpret();
    }
  }, [
    ritualDone,
    messages.length,
    interpreting,
    reading.silentReveal,
    runInterpret,
  ]);

  async function sendFollowUp(opts?: {
    withSubSpread?: false | "single" | "chain";
  }) {
    if (sending || interpreting) return;
    const subKind = opts?.withSubSpread ?? false;
    const text = draft.trim();
    if (!subKind && !text) return;
    const cost = subKind === "chain" ? 3 : 1;
    if (!quotaState.loading && quotaState.remaining.messages < cost) {
      setQuotaBlocked(true);
      setError(
        subKind === "chain" && quotaState.remaining.messages > 0
          ? "抽象征牌链需要至少 3 次追问额度，今日剩余不足。"
          : quotaState.user
            ? "今日追问额度已用尽，可以先回看这卦，或明天再续。"
            : "访客今日追问的烛火已用尽。登录后还能轻声多问几句。",
      );
      return;
    }
    setSending(true);
    setError("");
    setQuotaBlocked(false);
    setStreamingText("");
    const optimisticContent =
      subKind === "chain"
        ? `【象征牌链】${text || "象征牌链抽取中…"}`
        : subKind === "single"
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
      const body: { content: string; subSpread?: "single" | "chain" } = {
        content: text,
      };
      if (subKind === "single" || subKind === "chain") body.subSpread = subKind;
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
  const chainExhausted =
    !quotaState.loading && quotaState.remaining.messages < 3;

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
          {reading.silentReveal ? (
            <Badge variant="outline" aria-label="静默模式">
              静默
            </Badge>
          ) : null}
          <Button asChild size="sm">
            <Link href="/reading/new">新占卜</Link>
          </Button>
        </div>
      </div>

      <ReadingTimeline
        ritualDone={ritualDone}
        messages={messages}
        interpreting={interpreting || sending}
        tokenLit={tokenLit}
      />

      <div id={TIMELINE_ANCHORS.reveal} className="scroll-mt-44">
        <RitualStage
          speed={reading.ritualSpeed}
          spread={reading.spreadResult}
          scene={reading.scene}
          alreadyDone={initialMessages.length > 0}
          onDone={() => setRitualDone(true)}
        />
      </div>

      {ritualDone && priorReading ? (
        <ComparePriorSection prior={priorReading} current={reading} />
      ) : null}

      {ritualDone && (
        <Card id={TIMELINE_ANCHORS.interpret} className="scroll-mt-44">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">解读</CardTitle>
              {messages.some((m) => m.role === "assistant") ? (
                <Button type="button" size="sm" variant="secondary" onClick={focusFollowUp}>
                  继续追问
                </Button>
              ) : null}
            </div>
            <CardDescription role="status" aria-live="polite">
              {interpreting || sending
                ? streamingText
                  ? "烛火摇曳，字句正浮现…"
                  : "烛火摇曳，正在生成…"
                : messages.length === 0
                  ? reading.silentReveal
                    ? "先静静看牌，准备好再请烛火开口"
                    : "牌已揭晓，解读即将到来…"
                  : "可继续追问"}
            </CardDescription>
            {userFollowUps > 0 || interpreting || sending ? (
              <Button type="button" size="sm" variant="link" className="justify-start px-0" onClick={showLatestReply}>
                {interpreting || sending ? "查看正在生成的回复 ↓" : "查看最新回复 ↓"}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {messages.length === 0 &&
            !interpreting &&
            !streamingText &&
            reading.silentReveal &&
            !error ? (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-4">
                <p className="text-sm text-muted-foreground">
                  先静静看牌，准备好再请烛火开口。
                </p>
                <Button
                  type="button"
                  onClick={() => void runInterpret()}
                  aria-label="请烛火开口，开始解读"
                >
                  请烛火开口
                </Button>
              </div>
            ) : null}
            {messages.length === 0 &&
            !interpreting &&
            !streamingText &&
            !reading.silentReveal &&
            !error ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">
                  烛火还在酝酿。若迟迟没有字句，可以再请一次。
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void runInterpret()}
                  aria-label="再请一次解读"
                >
                  再请一次
                </Button>
              </div>
            ) : null}
            {messages.length === 0 &&
            !interpreting &&
            !streamingText &&
            error ? (
              <div className="flex flex-col items-start gap-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setError("");
                    setQuotaBlocked(false);
                    void runInterpret();
                  }}
                  aria-label="再试一次解读"
                >
                  再试一次
                </Button>
              </div>
            ) : null}
            <div className="space-y-5" aria-label="本局对话">
              {messages.map((m, index) => {
                const isUser = m.role === "user";
                const optimisticSingle =
                  isUser && m.content.startsWith("【子牌阵】");
                const optimisticChain =
                  isUser && m.content.startsWith("【象征牌链】");
                const optimisticSub = optimisticSingle || optimisticChain;
                const sub =
                  isUser && !optimisticSub
                    ? parseSubSpreadMessage(m.content)
                    : {
                        kind: null as null,
                        cards: [] as {
                          cardId: string;
                          reversed: boolean;
                          positionLabel: string;
                        }[],
                        text: m.content,
                      };
                const bubbleText = sub.kind
                  ? displayTextForUser(m.content)
                  : optimisticChain
                    ? m.content.replace(/^【象征牌链】/, "").trim() ||
                      "象征牌链抽取中…"
                    : optimisticSingle
                      ? m.content.replace(/^【子牌阵】/, "").trim() ||
                        "象征牌抽取中…"
                      : m.content;
                const tagLabel = (() => {
                  if (!isUser) return "烛火解读";
                  if (sub.kind === "chain" || optimisticChain)
                    return "象征牌链 · 追问";
                  if (sub.kind === "single" || optimisticSingle)
                    return "象征牌 · 追问";
                  return "你的追问";
                })();
                return (
                  <div
                    key={m.id}
                    id={!streamingText && !interpreting && !sending && index === messages.length - 1 ? "reading-latest-reply" : undefined}
                    className={
                      isUser
                        ? "ml-6 flex scroll-mt-44 flex-col items-end gap-1 sm:ml-12"
                        : "flex min-w-0 scroll-mt-44 flex-col items-start gap-1"
                    }
                  >
                    <span
                      className={
                        isUser
                          ? "px-1 text-[10px] tracking-wider text-primary/80"
                          : "px-1 text-[10px] tracking-wider text-amber-200/70"
                      }
                    >
                      {tagLabel}
                    </span>
                    <div
                      className={
                        isUser
                          ? "min-w-0 max-w-[95%] break-words rounded-2xl rounded-br-md border border-primary/35 bg-primary/15 px-3.5 py-2.5 text-sm text-foreground [overflow-wrap:anywhere] shadow-[inset_0_0_18px_oklch(0.78_0.12_75/8%)]"
                          : "w-full min-w-0 rounded-2xl rounded-bl-md border border-amber-500/25 bg-card/55 px-4 py-4 text-sm leading-relaxed text-foreground/95 shadow-[inset_0_0_22px_oklch(0.78_0.12_75/10%)] sm:px-5"
                      }
                    >
                      {sub.kind === "chain" ? (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex flex-wrap items-end justify-end gap-2">
                            {sub.cards.map((c) => {
                              const face = getCard(c.cardId);
                              return (
                                <div
                                  key={`${c.cardId}-${c.positionLabel}`}
                                  className="flex flex-col items-center gap-1"
                                >
                                  <div className="text-center text-[10px] leading-snug text-muted-foreground">
                                    <div className="font-medium text-foreground/90">
                                      {c.positionLabel || "象征"}
                                    </div>
                                    <div>
                                      {face?.nameZh ?? c.cardId} ·{" "}
                                      {c.reversed ? "逆位" : "正位"}
                                    </div>
                                  </div>
                                  <TarotCardFace
                                    card={face}
                                    reversed={c.reversed}
                                    compact
                                    className="w-14 shrink-0 sm:w-16"
                                  />
                                </div>
                              );
                            })}
                          </div>
                          <p className="w-full whitespace-pre-wrap text-left">
                            {bubbleText}
                          </p>
                        </div>
                      ) : sub.kind === "single" && sub.cards[0] ? (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-end gap-2">
                            <div className="text-right text-[11px] leading-snug text-muted-foreground">
                              <div className="font-medium text-foreground/90">
                                {sub.cards[0].positionLabel || "象征"}
                              </div>
                              <div>
                                {getCard(sub.cards[0].cardId)?.nameZh ??
                                  sub.cards[0].cardId}{" "}
                                · {sub.cards[0].reversed ? "逆位" : "正位"}
                              </div>
                            </div>
                            <TarotCardFace
                              card={getCard(sub.cards[0].cardId)}
                              reversed={sub.cards[0].reversed}
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
                          <p className="text-[11px] text-primary/80">
                            {optimisticChain
                              ? "象征牌链 · 抽取中…"
                              : "象征牌抽取中…"}
                          </p>
                          {bubbleText ? (
                            <p className="whitespace-pre-wrap">{bubbleText}</p>
                          ) : null}
                        </div>
                      ) : isUser ? (
                        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{m.content}</p>
                      ) : (
                        <AdvisorMarkdown>{m.content}</AdvisorMarkdown>
                      )}
                    </div>
                  </div>
                );
              })}
              {interpreting || sending ? (
                <div id="reading-latest-reply" className="flex min-w-0 scroll-mt-44 flex-col items-start gap-1">
                  <span className="px-1 text-[10px] tracking-wider text-amber-200/70">
                    烛火解读
                  </span>
                  <div
                    className="w-full min-w-0 rounded-2xl rounded-bl-md border border-amber-500/35 bg-card/55 px-4 py-4 text-sm leading-relaxed shadow-[inset_0_0_22px_oklch(0.78_0.12_75/10%)] sm:px-5"
                    aria-label="正在浮现的解读"
                  >
                    {streamingText ? <AdvisorMarkdown>{streamingText}</AdvisorMarkdown> : (
                      <p className="text-sm text-muted-foreground" role="status">烛火正在整理字句…</p>
                    )}
                    <span
                      className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-amber-400/80 align-middle"
                      aria-hidden
                    />
                  </div>
                </div>
              ) : null}
            </div>
            {error && (
              <div className="space-y-2" role="alert">
                <p className="text-sm text-destructive">{error}</p>
                {quotaBlocked && !quotaState.user ? (
                  <GuestLoginCta
                    nextPath={`/reading/${reading.id}`}
                    githubEnabled={quotaState.oauth.github}
                    tip="轻轻登录，马上可以继续追问；历史会合并，额度也会更宽裕。"
                    compact
                  />
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
              <form
                id={TIMELINE_ANCHORS.followup}
                className="space-y-3 scroll-mt-44 border-t border-border/60 pt-5"
                onSubmit={(e) => { e.preventDefault(); void sendFollowUp(); }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="reading-followup-draft" className="block text-base font-medium">继续追问</label>
                  {userFollowUps > 0 ? (
                    <Button type="button" size="sm" variant="link" className="px-0" onClick={showLatestReply}>
                      {sending ? "查看正在生成的回复 ↑" : "查看最新回复 ↑"}
                    </Button>
                  ) : null}
                </div>
                <QuotaHint
                  loading={quotaState.loading}
                  user={quotaState.user}
                  usage={quotaState.usage}
                  quota={quotaState.quota}
                  remaining={quotaState.remaining}
                  oauth={quotaState.oauth}
                  focus="messages"
                />
                <div className="flex flex-col gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Textarea
                      ref={composerRef}
                      id="reading-followup-draft"
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
                          ? (!quotaState.user
                              ? "访客追问烛火已用尽，可轻轻登录继续…"
                              : "今日追问额度已用尽…")
                          : "这段解读里，你还想看清什么？"
                      }
                      rows={2}
                      maxLength={500}
                      className="min-h-24 max-h-60 resize-y scroll-mt-44 overflow-y-auto text-base md:text-sm"
                      disabled={sending || interpreting || messagesExhausted}
                      aria-label="追问内容"
                    />
                    <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                      <p className="hidden sm:block">Enter 发送 · Shift / Ctrl + Enter 换行</p>
                      <span className="ml-auto tabular-nums">{draft.length}/500</span>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      className="min-h-11 w-full sm:w-auto sm:min-w-28"
                      disabled={
                        sending ||
                        interpreting ||
                        messagesExhausted ||
                        !draft.trim()
                      }
                      aria-label="发送追问"
                    >
                      {sending ? "回复生成中…" : "发送追问"}
                    </Button>
                  </div>
                  <details className="rounded-lg border border-border/60 bg-background/30">
                    <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm text-muted-foreground focus-visible:outline-ring">
                      想借一张牌继续看？
                    </summary>
                    <div className="space-y-3 px-3 pb-3">
                      <p className="text-xs leading-relaxed text-muted-foreground">可以带上上方的问题，也可以留空。象征牌消耗 1 次追问，牌链消耗 3 次。</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            void sendFollowUp({ withSubSpread: "single" })
                          }
                          disabled={sending || interpreting || messagesExhausted}
                          aria-label="抽一张象征牌，消耗一次追问额度，文字可选"
                          title="抽一张象征牌（消耗 1 次追问，文字可选）"
                        >
                          抽一张象征牌
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            void sendFollowUp({ withSubSpread: "chain" })
                          }
                          disabled={sending || interpreting || chainExhausted}
                          aria-label="抽象征牌链，连抽三张象征牌，消耗三次追问额度，文字可选"
                          title="抽象征牌链（消耗 3 次追问，文字可选）"
                        >
                          抽象征牌链
                        </Button>
                      </div>
                    </div>
                  </details>
                </div>
              </form>
            ) : null}
          </CardContent>
        </Card>
      )}

      {ritualDone && messages.some((m) => m.role === "assistant") ? (
        <details id={TIMELINE_ANCHORS.token} className="group scroll-mt-44 rounded-xl border border-border/60 bg-card/40">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <span className="space-y-1">
              <span className="block text-sm font-medium">留住这局</span>
              <span className="block text-xs text-muted-foreground">分享牌阵、公开链接与烛火信物</span>
            </span>
            <span className="text-xs text-primary group-open:hidden">展开</span>
            <span className="hidden text-xs text-primary group-open:block">收起</span>
          </summary>
          <div className="space-y-3 border-t border-border/60 px-4 py-4">
            <p className="text-xs leading-relaxed text-muted-foreground">分享内容包含你的问题与牌阵，不含完整解读和追问。公开链接可随时关闭。</p>
            <div className="flex flex-wrap items-center gap-2">
              <ShareReadingButton reading={reading} />
              <PublicShareButton reading={reading} />
              <CandleTokenButton reading={reading} onLit={markTokenLit} />
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
