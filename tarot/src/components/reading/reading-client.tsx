"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Message, Reading } from "@/lib/types";
import { RitualStage } from "@/components/reading/ritual-stage";
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

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function readNdjsonStream(
  res: Response,
  onDelta: (chunk: string) => void,
): Promise<Message[]> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.error === "string" ? data.error : `请求失败 (${res.status})`,
    );
  }
  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("ndjson") || !res.body) {
    const data = await res.json();
    if (data.error) throw new Error(data.error);
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
      else if (event.t === "error") throw new Error(event.error);
    }
  }

  if (!messages) throw new Error("流式响应未完成");
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
      setError(e instanceof Error ? e.message : "解读失败");
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
      setError(e instanceof Error ? e.message : "发送失败");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(text);
      setStreamingText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {reading.title || "占卜"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{reading.question}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">
            {reading.detailLevel === "brief" ? "简要" : "详细"}
          </Badge>
          <Badge variant="secondary">{reading.ritualSpeed}</Badge>
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
                : "可继续追问"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <div className="whitespace-pre-wrap rounded-lg border border-amber-500/30 bg-card/40 px-3 py-2 text-sm leading-relaxed">
                {streamingText}
                <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-amber-400/80 align-middle" />
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="继续追问…"
                rows={2}
                className="resize-none"
                disabled={sending || interpreting}
              />
              <Button onClick={sendFollowUp} disabled={sending || interpreting}>
                发送
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
