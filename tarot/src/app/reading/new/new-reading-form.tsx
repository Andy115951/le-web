"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  CUSTOM_SCENE,
  SCENES,
  type DetailLevel,
  type SceneId,
} from "@/data/scenes";
import {
  spreadHint,
  spreadLabel,
  suggestedTheaterSpread,
  theaterSoftTip,
} from "@/lib/spread-label";
import { readUserPrefs } from "@/lib/user-prefs";
import {
  clearReadingDraft,
  readReadingDraft,
  writeReadingDraft,
  type ReadingDraftFields,
} from "@/lib/reading-draft";
import { useQuota } from "@/hooks/use-quota";
import { QuotaHint } from "@/components/quota/quota-hint";
import { GuestLoginCta } from "@/components/quota/guest-login-cta";
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
const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function defaultFields(initialSceneId?: string): ReadingDraftFields {
  const scene = ALL.find((s) => s.id === initialSceneId) ?? SCENES[0] ?? CUSTOM_SCENE;
  const prefs = readUserPrefs();
  return {
    sceneId: scene.id,
    question: scene.exampleQuestion,
    spread: scene.defaultSpread,
    detail: prefs.detailLevel,
    speed: prefs.ritualSpeed,
    silentReveal: prefs.silentReveal,
    advancedOpen: false,
  };
}

export function NewReadingForm({
  initialSceneId,
}: {
  initialSceneId?: string;
}) {
  const hydrated = useSyncExternalStore(subscribeHydration, clientReady, serverReady);
  if (!hydrated) {
    return <div className="min-h-80 space-y-4 animate-pulse" role="status" aria-label="正在准备起卦">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="h-24 rounded-xl bg-muted/60" />
      <div className="h-12 rounded-xl bg-muted/40" />
    </div>;
  }
  return <DraftReadingForm key={initialSceneId ?? "default"} initialSceneId={initialSceneId} />;
}

function DraftReadingForm({ initialSceneId }: { initialSceneId?: string }) {
  const router = useRouter();
  const quotaState = useQuota();
  const [initial] = useState(() => {
    const saved = readReadingDraft();
    const explicitScene = ALL.find((s) => s.id === initialSceneId);
    const conflict = saved.draft && explicitScene && saved.draft.fields.sceneId !== explicitScene.id;
    return {
      fields: saved.draft && !conflict ? saved.draft.fields : defaultFields(initialSceneId),
      restored: saved.draft && !conflict ? saved.draft : null,
      pending: conflict ? saved.draft : null,
      available: saved.available,
    };
  });
  const [fields, setFields] = useState(initial.fields);
  const { sceneId, question, spread, detail, speed, silentReveal, advancedOpen } = fields;
  const scene = ALL.find((s) => s.id === sceneId) ?? CUSTOM_SCENE;
  const [pendingDraft, setPendingDraft] = useState(initial.pending);
  const draftId = useRef(initial.restored?.id ?? null);
  const [draftStatus, setDraftStatus] = useState(
    !initial.available ? "unavailable" : initial.restored ? "restored" : "empty",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quotaBlocked, setQuotaBlocked] = useState(false);

  function updateFields(patch: Partial<ReadingDraftFields>) {
    const next = { ...fields, ...patch };
    setFields(next);
    setPendingDraft(null);
    const saved = writeReadingDraft(next);
    draftId.current = saved?.id ?? null;
    setDraftStatus(saved ? "saved" : "unavailable");
    return Boolean(saved);
  }

  function discardDraft(clearQuestion: boolean) {
    const cleared = clearReadingDraft();
    draftId.current = null;
    setPendingDraft(null);
    if (clearQuestion) setFields({ ...defaultFields(sceneId), question: "" });
    setDraftStatus(cleared ? "cleared" : "unavailable");
    setError("");
    setQuotaBlocked(false);
  }

  function onPickScene(id: SceneId) {
    const next = ALL.find((s) => s.id === id) ?? CUSTOM_SCENE;
    updateFields({ sceneId: id, question: next.exampleQuestion, spread: next.defaultSpread });
  }

  const readingsExhausted =
    !quotaState.loading && quotaState.remaining.readings <= 0;
  const submitLabel = loading
    ? "起卦中…"
    : readingsExhausted
      ? "今日额度已用尽"
      : `开始${spreadLabel(spread)}占卜`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const q = question.trim();
    if (q.length < 4) {
      setError("请写下至少 4 个字，再把问题交给烛火。");
      return;
    }
    if (readingsExhausted) {
      setQuotaBlocked(true);
      setError(
        quotaState.user
          ? "今日新占卜额度已用尽，明天再来点亮一盏吧。"
          : "访客今日起卦的烛火已用尽。登录后可以继续点亮。",
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
          silentReveal,
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
      if (draftId.current) clearReadingDraft(draftId.current);
      router.prefetch(dest);
      router.push(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "起卦没能完成，请稍后再试。");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <fieldset
        disabled={loading}
        className={`space-y-6 ${advancedOpen ? "pb-20 sm:pb-0" : ""}`}
      >
      <QuotaHint
        loading={quotaState.loading}
        user={quotaState.user}
        usage={quotaState.usage}
        quota={quotaState.quota}
        remaining={quotaState.remaining}
        oauth={quotaState.oauth}
        focus="readings"
      />

      {pendingDraft ? (
        <aside className="space-y-2 rounded-lg border border-primary/25 bg-primary/5 p-3" aria-label="未完成的草稿">
          <p className="text-sm">还有一份「{ALL.find((s) => s.id === pendingDraft.fields.sceneId)?.label}」草稿。</p>
          <p className="text-xs text-muted-foreground">可恢复继续；编辑当前场景会替换旧草稿。</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => {
              if (updateFields(pendingDraft.fields)) setDraftStatus("restored");
            }}>恢复草稿</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => discardDraft(false)}>从当前场景开始</Button>
          </div>
        </aside>
      ) : (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <p role="status" aria-live="polite">
            {draftStatus === "unavailable" ? "此浏览器暂时无法保存草稿，离开前请留意。"
              : draftStatus === "restored" ? "已恢复草稿 · 仅保存在此浏览器"
              : draftStatus === "saved" ? "草稿已保存 · 仅保存在此浏览器"
              : draftStatus === "cleared" ? "草稿已清空"
              : "编辑后自动保存草稿 · 仅在此浏览器"}
          </p>
          <Button type="button" size="sm" variant="ghost" onClick={() => discardDraft(true)}>清空草稿</Button>
        </div>
      )}

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
          onChange={(e) => updateFields({ question: e.target.value })}
          rows={3}
          placeholder="写下你想问的…"
          className="resize-none"
          maxLength={200}
        />
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-foreground hover:bg-accent/20"
          aria-expanded={advancedOpen}
          onClick={() => updateFields({ advancedOpen: !advancedOpen })}
        >
          <span className="font-medium">牌阵与仪式（可选）</span>
          <span className="text-xs text-muted-foreground">
            {advancedOpen ? "收起" : "展开"} · {spreadLabel(spread)}
          </span>
        </button>
        {advancedOpen ? (
          <Card className="border-0 border-t border-border/60 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">本次选项</CardTitle>
              <CardDescription>可临时覆盖默认；收起时仍沿用偏好与场景默认</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>牌阵</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["three_card", "三牌"],
                      ["single", "单牌"],
                      ["five_cross", "情境五牌"],
                      ["relation_dual", "关系双人"],
                      ["choice_fork", "抉择分叉"],
                      ["moon_triad", "月相三问"],
                      ["celtic_cross", "凯尔特十字"],
                    ] as const
                  ).map(([v, label]) => (
                    <Button
                      key={v}
                      type="button"
                      size="sm"
                      variant={spread === v ? "default" : "outline"}
                      onClick={() => updateFields({ spread: v })}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {spreadHint(spread) ? (
                  <p className="text-xs text-muted-foreground">{spreadHint(spread)}</p>
                ) : null}
                {(() => {
                  const theaterSuggest = suggestedTheaterSpread(sceneId);
                  const tip = theaterSoftTip(sceneId);
                  if (!theaterSuggest || !tip || spread === theaterSuggest) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-muted-foreground">{tip}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-primary"
                        onClick={() => updateFields({ spread: theaterSuggest })}
                      >
                        改用{spreadLabel(theaterSuggest)}
                      </Button>
                    </div>
                  );
                })()}
              </div>
              <div className="space-y-2">
                <Label>解读</Label>
                <div className="flex gap-2">
                  {(["brief", "detailed"] as DetailLevel[]).map((d) => (
                    <Button
                      key={d}
                      type="button"
                      size="sm"
                      variant={detail === d ? "default" : "outline"}
                      onClick={() => updateFields({ detail: d })}
                    >
                      {d === "brief" ? "简要" : "详细"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>仪式速度</Label>
                <div className="flex gap-2">
                  {(
                    [
                      ["slow", "慢"],
                      ["normal", "常"],
                      ["fast", "快"],
                    ] as const
                  ).map(([v, label]) => (
                    <Button
                      key={v}
                      type="button"
                      size="sm"
                      variant={speed === v ? "default" : "outline"}
                      onClick={() => updateFields({ speed: v })}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>静默揭晓</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={!silentReveal ? "default" : "outline"}
                    onClick={() => updateFields({ silentReveal: false })}
                  >
                    自动解读
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={silentReveal ? "default" : "outline"}
                    onClick={() => updateFields({ silentReveal: true })}
                  >
                    静默模式
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  静默时先静静看牌，准备好再请烛火开口。
                </p>
              </div>
              <Badge variant="secondary">场景：{scene.label}</Badge>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {error && (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          {quotaBlocked && !quotaState.user ? (
            <GuestLoginCta
              nextPath="/reading/new"
              githubEnabled={quotaState.oauth.github}
              tip="轻轻登录，马上可以继续起卦；历史会合并，每日额度也会更宽。"
              compact
            />
          ) : null}
        </div>
      )}
      {readingsExhausted && !quotaState.user && !quotaBlocked ? (
        <GuestLoginCta
          nextPath="/reading/new"
          githubEnabled={quotaState.oauth.github}
          tip="今日访客烛火已燃尽。轻轻登录，即可继续点亮。"
        />
      ) : null}
      <div className={advancedOpen ? "hidden sm:block" : ""}>
        <Button
          type="submit"
          size="lg"
          disabled={loading || readingsExhausted}
          className="w-full sm:w-auto"
        >
          {submitLabel}
        </Button>
      </div>

      {advancedOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-4 py-3 shadow-[0_-12px_30px_oklch(0.1_0.02_55_/_35%)] backdrop-blur-md sm:hidden">
          <Button
            type="submit"
            size="lg"
            disabled={loading || readingsExhausted}
            className="mx-auto flex w-full max-w-3xl"
          >
            {submitLabel}
          </Button>
        </div>
      ) : null}
      </fieldset>
    </form>
  );
}
