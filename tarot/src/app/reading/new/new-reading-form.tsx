"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CUSTOM_SCENE,
  SCENES,
  type DetailLevel,
  type RitualSpeed,
  type SceneId,
  type SpreadType,
} from "@/data/scenes";
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
  const start =
    ALL.find((s) => s.id === initialSceneId) ?? SCENES[0] ?? CUSTOM_SCENE;
  const [sceneId, setSceneId] = useState<SceneId>(start.id);
  const scene = useMemo(
    () => ALL.find((s) => s.id === sceneId) ?? CUSTOM_SCENE,
    [sceneId],
  );
  const [question, setQuestion] = useState(scene.exampleQuestion);
  const [spread, setSpread] = useState<SpreadType>(scene.defaultSpread);
  const [detail, setDetail] = useState<DetailLevel>("brief");
  const [speed, setSpeed] = useState<RitualSpeed>("normal");

  function onPickScene(id: SceneId) {
    const next = ALL.find((s) => s.id === id) ?? CUSTOM_SCENE;
    setSceneId(id);
    setQuestion(next.exampleQuestion);
    setSpread(next.defaultSpread);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 4) return;
    // P0: stub reading id; real create API in P1
    const id = `draft-${Date.now()}`;
    const params = new URLSearchParams({
      scene: sceneId,
      q,
      spread,
      detail,
      speed,
    });
    router.push(`/reading/${id}?${params.toString()}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
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
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">本次选项</CardTitle>
          <CardDescription>可临时覆盖设置里的默认值</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>牌阵</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={spread === "three_card" ? "default" : "outline"}
                onClick={() => setSpread("three_card")}
              >
                三牌
              </Button>
              <Button
                type="button"
                size="sm"
                variant={spread === "single" ? "default" : "outline"}
                onClick={() => setSpread("single")}
              >
                单牌
              </Button>
            </div>
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
                  onClick={() => setDetail(d)}
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
                  onClick={() => setSpeed(v)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <Badge variant="secondary">默认牌阵来自场景：{scene.label}</Badge>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full sm:w-auto">
        确认起卦
      </Button>
    </form>
  );
}
