"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { RitualSpeed } from "@/data/scenes";
import type { Message, Reading } from "@/lib/types";
import { RitualStage } from "@/components/reading/ritual-stage";
import { ShareReadingButton } from "@/components/reading/share-reading-button";
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
    // Soften a few developer-ish API phrases if they leak through
    if (/stream|ndjson|json|status|fetch|network/i.test(raw)) {
      return fallback;
    }
    return raw;
  }
  return fallback;
}

async function readNdjsonStream(
  res: Response,
  onDelta: (chunk: string) => void,
): Promise<Message[]> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      warmError(
        "烛火晃了一下，这次没能完成。稍后再试一次吧。",
        typeof data.error === "string" ? data.error : undefined,
      ),
    );
  }
  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("ndjson") || !res.body) {
    const data = await res.json();
    if (data.error) {
      throw new Error(
        warmError("烛火晃了一下，这次没能完成。稍后再试一次吧。", data.error),
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
        throw new Error(
          warmError("烛火晃了一下，这次没能完成。稍后再试一次吧。", event.error),
        );
      }
    }
  }

  if (!messages) {
    throw new Error("字句还没落定，烛火就灭了。请再试一次。");
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
  const [streamingText, setStreamingText] = useState("");

  const streamQuery = useMemo(() => {
    const instant = prefersReducedMotion() ? "&instant=1" : "";
    return `?stream=1${instant}`;
  }, []);

  const runInterpret = useCallback(async () => {
    setInterpreting(true);
    setError("");
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

  async function sendFollowUp() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setError("");
    setStreamingText("");
    const optimistic: Message = {
      id: `local-${Date.now()}`,
      readingId: reading.id,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    try {
      const res = await fetch(
        `/api/readings/${reading.id}/messages${streamQuery}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/x-ndjson",
          },
          body: JSON.stringify({ content: text }),
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
            <div className="space-y-4" aria-live="polite" aria-relevant="additions">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.role === "user"
                      ? "rounded-lg bg-secondary/60 px-3 py-2 text-sm"
                      : "whitespace-pre-wrap rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm leading-relaxed"
                  }
                >
                  {m.role === "user" ? `你：${m.content}` : m.content}
                </div>
              ))}
              {streamingText && (
                <div
                  className="whitespace-pre-wrap rounded-lg border border-amber-500/30 bg-card/40 px-3 py-2 text-sm leading-relaxed"
                  aria-label="正在浮现的解读"
                >
                  {streamingText}
                  <span
                    className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-amber-400/80 align-middle"
                    aria-hidden
                  />
                </div>
              )}
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {messages.some((m) => m.role === "assistant") ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="继续追问…"
                  rows={2}
                  className="resize-none"
                  disabled={sending || interpreting}
                  aria-label="追问内容"
                />
                <Button
                  onClick={sendFollowUp}
                  disabled={sending || interpreting}
                  aria-label="发送追问"
                >
                  发送
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
