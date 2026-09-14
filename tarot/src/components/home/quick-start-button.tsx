"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CUSTOM_SCENE, SCENES, type SceneId } from "@/data/scenes";
import { readUserPrefs } from "@/lib/user-prefs";
import { useQuota } from "@/hooks/use-quota";
import { Button } from "@/components/ui/button";

const ALL = [...SCENES, CUSTOM_SCENE];

export function QuickStartButton({
  sceneId,
  className,
}: {
  sceneId: SceneId;
  className?: string;
}) {
  const router = useRouter();
  const quotaState = useQuota();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quotaBlocked, setQuotaBlocked] = useState(false);

  const scene = ALL.find((s) => s.id === sceneId) ?? CUSTOM_SCENE;
  const question = scene.exampleQuestion.trim();
  if (question.length < 4) return null;

  const readingsExhausted =
    !quotaState.loading && quotaState.remaining.readings <= 0;

  async function onQuickStart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
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
      const prefs = readUserPrefs();
      const res = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          scene: sceneId,
          spreadType: scene.defaultSpread,
          detailLevel: prefs.detailLevel,
          ritualSpeed: prefs.ritualSpeed,
          silentReveal: prefs.silentReveal,
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
      const dest = `/reading/${data.reading.id}`;
      router.prefetch(dest);
      router.push(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "起卦没能完成，请稍后再试。");
      setLoading(false);
    }
  }

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={loading || readingsExhausted}
        onClick={onQuickStart}
        className="w-full sm:w-auto"
      >
        {loading ? "起卦中…" : readingsExhausted ? "今日额度已用尽" : "快速起卦"}
      </Button>
      {error ? (
        <div className="mt-2 space-y-1" role="alert">
          <p className="text-xs text-destructive">{error}</p>
          {quotaBlocked && !quotaState.user ? (
            <p className="text-xs text-muted-foreground">
              <Link
                href="/login"
                className="text-primary underline-offset-2 hover:underline"
              >
                去登录
              </Link>
              ，历史会自动合并，每日可起更多卦。
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
