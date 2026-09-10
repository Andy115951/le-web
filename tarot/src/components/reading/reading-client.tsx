"use client";

import { useCallback, useEffect, useState } from "react";
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

  const runInterpret = useCallback(async () => {
    setInterpreting(true);
    setError("");
    try {
      const res = await fetch(`/api/readings/${reading.id}/interpret`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "解读失败");
      setMessages(data.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解读失败");
    } finally {
      setInterpreting(false);
    }
  }, [reading.id]);

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
    try {
      const res = await fetch(`/api/readings/${reading.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发送失败");
      setMessages(data.messages);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
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
          <Badge variant="outline">{reading.detailLevel === "brief" ? "简要" : "详细"}</Badge>
          <Badge variant="secondary">{reading.ritualSpeed}</Badge>
          <Button asChild size="sm">
            <Link href="/reading/new">新占卜</Link>
          </Button>
        </div>
      </div>

      <RitualStage
        speed={reading.ritualSpeed}
        spread={reading.spreadResult}
        onDone={() => setRitualDone(true)}
      />

      {ritualDone && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">解读</CardTitle>
            <CardDescription>
              {interpreting ? "烛火摇曳，正在生成…" : "可继续追问"}
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
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="继续追问…"
                rows={2}
                className="resize-none"
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
