"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CUSTOM_SCENE,
  SCENES,
  type DetailLevel,
  type RitualSpeed,
  type SceneId,
  type SpreadType,
} from "@/data/scenes";
import { DEFAULT_USER_PREFS, readUserPrefs } from "@/lib/user-prefs";
import { useQuota } from "@/hooks/use-quota";
import { QuotaHint } from "@/components/quota/quota-hint";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ALL = [...SCENES, CUSTOM_SCENE];

export function NewReadingForm({
  initialSceneId,
}: {
  initialSceneId?: string;
}) {
  const router = useRouter();
  const quotaState = useQuota();
  const start =
    ALL.find((s) => s.id === initialSceneId) ?? SCENES[0] ?? CUSTOM_SCENE;
  const [sceneId, setSceneId] = useState<SceneId>(start.id);
  const scene = useMemo(
    () => ALL.find((s) => s.id === sceneId) ?? CUSTOM_SCENE,
    [sceneId],
  );
  const [question, setQuestion] = useState(scene.exampleQuestion);
  const [spread, setSpread] = useState<SpreadType>(scene.defaultSpread);
  const [detail, setDetail] = useState<DetailLevel>(
    DEFAULT_USER_PREFS.detailLevel,
  );
  const [speed, setSpeed] = useState<RitualSpeed>(
    DEFAULT_USER_PREFS.ritualSpeed,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quotaBlocked, setQuotaBlocked] = useState(false);

  useEffect(() => {
    const prefs = readUserPrefs();
    setDetail(prefs.detailLevel);
    setSpeed(prefs.ritualSpeed);
  }, []);

  function onPickScene(id: SceneId) {
    const next = ALL.find((s) => s.id === id) ?? CUSTOM_SCENE;
    setSceneId(id);
    setQuestion(next.exampleQuestion);
    setSpread(next.defaultSpread);
  }

  const readingsExhausted =
    !quotaState.loading && quotaState.remaining.readings <= 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 4) return;
    if (readingsExhausted) {
      setQuotaBlocked(true);
      setError(
        quotaState.user
          ? "今日新占卜额度已用尽，明天再来点亮一盏吧。"
          : "访客今日起卦额度已用尽，请登录后继续。",
      );
      return;
    }
    setLoading(true);
    setError("");
    setQuotaBlocked(false);
    try {
      const res = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          scene: sceneId,
          spreadType: spread,
          detailLevel: detail,
          ritualSpeed: speed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "quota") {
          setQuotaBlocked(true);
          await quotaState.refresh();
        }
        throw new Error(data.error || "起卦没能完成，请稍后再试。");
      }
      router.push(`/reading/${data.reading.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "起卦没能完成，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <QuotaHint
        loading={quotaState.loading}
        user={quotaState.user}
        usage={quotaState.usage}
        quota={quotaState.quota}
        remaining={quotaState.remaining}
        focus="readings"
      />

      <div className="flex flex-wrap gap-2">
        {ALL.map((s) => (
          <Button
            key={s.id}
            type="button"
            size="sm"
            variant={sceneId === s.id ? "default" : "outline"}
            onClick={() => onPickScene(s.id)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="question">你的问题</Label>
        <Textarea
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          placeholder="写下你想问的…"
          className="resize-none"
          disabled={readingsExhausted}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">本次选项</CardTitle>
          <CardDescription>可临时覆盖默认</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>牌阵</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={spread === "three_card" ? "default" : "outline"} onClick={() => setSpread("three_card")}>三牌</Button>
              <Button type="button" size="sm" variant={spread === "five_cross" ? "default" : "outline"} onClick={() => setSpread("five_cross")}>情境五牌</Button>
              <Button type="button" size="sm" variant={spread === "single" ? "default" : "outline"} onClick={() => setSpread("single")}>单牌</Button>
            </div>
            {spread === "five_cross" ? (
              <p className="text-xs text-muted-foreground">
                现状 · 挑战 · 过去影响 · 近期走向 · 建议
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>解读</Label>
            <div className="flex gap-2">
              {(["brief", "detailed"] as DetailLevel[]).map((d) => (
                <Button key={d} type="button" size="sm" variant={detail === d ? "default" : "outline"} onClick={() => setDetail(d)}>
                  {d === "brief" ? "简要" : "详细"}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>仪式速度</Label>
            <div className="flex gap-2">
              {([["slow", "慢"], ["normal", "常"], ["fast", "快"]] as const).map(([v, label]) => (
                <Button key={v} type="button" size="sm" variant={speed === v ? "default" : "outline"} onClick={() => setSpeed(v)}>
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <Badge variant="secondary">场景：{scene.label}</Badge>
        </CardContent>
      </Card>

      {error && (
        <div className="space-y-1" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          {quotaBlocked && !quotaState.user ? (
            <p className="text-sm text-muted-foreground">
              <Link href="/login" className="text-primary underline-offset-2 hover:underline">
                去登录
              </Link>
              ，历史会自动合并，每日可起更多卦。
            </p>
          ) : null}
        </div>
      )}
      <Button
        type="submit"
        size="lg"
        disabled={loading || readingsExhausted}
        className="w-full sm:w-auto"
      >
        {loading ? "起卦中…" : readingsExhausted ? "今日额度已用尽" : "确认起卦"}
      </Button>
    </form>
  );
}
