"use client";

import { useEffect, useState } from "react";
import type { DetailLevel, RitualSpeed } from "@/data/scenes";
import {
  DEFAULT_USER_PREFS,
  readUserPrefs,
  writeUserPrefs,
  type UserPrefs,
} from "@/lib/user-prefs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SettingsDefaultsForm() {
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_USER_PREFS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrefs(readUserPrefs());
  }, []);

  function save() {
    writeUserPrefs(prefs);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">默认选项</CardTitle>
        <CardDescription>
          保存在本机浏览器，新占卜时自动带入；每局仍可临时覆盖。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>默认解读</Label>
          <div className="flex gap-2">
            {(["brief", "detailed"] as DetailLevel[]).map((d) => (
              <Button
                key={d}
                type="button"
                size="sm"
                variant={prefs.detailLevel === d ? "default" : "outline"}
                onClick={() => setPrefs((p) => ({ ...p, detailLevel: d }))}
              >
                {d === "brief" ? "简要" : "详细"}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>默认仪式速度</Label>
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
                variant={prefs.ritualSpeed === v ? "default" : "outline"}
                onClick={() =>
                  setPrefs((p) => ({ ...p, ritualSpeed: v as RitualSpeed }))
                }
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>静默揭晓</Label>
          <p className="text-xs text-muted-foreground">
            开启后，牌面揭晓不会立刻解读；点「请烛火开口」再请烛火开口。
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={!prefs.silentReveal ? "default" : "outline"}
              onClick={() => setPrefs((p) => ({ ...p, silentReveal: false }))}
            >
              自动解读
            </Button>
            <Button
              type="button"
              size="sm"
              variant={prefs.silentReveal ? "default" : "outline"}
              onClick={() => setPrefs((p) => ({ ...p, silentReveal: true }))}
            >
              静默模式
            </Button>
          </div>
        </div>

        <div className="space-y-2 border-t border-border/50 pt-4">
          <Label>今日一牌习惯</Label>
          <p className="text-xs text-muted-foreground">
            配合主屏幕打开更顺手。可随时关掉；不是桌面小组件，也不发系统通知。
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-sm">打开时先看今日一牌</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={!prefs.openToDailyCard ? "default" : "outline"}
                  onClick={() =>
                    setPrefs((p) => ({ ...p, openToDailyCard: false }))
                  }
                >
                  关
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={prefs.openToDailyCard ? "default" : "outline"}
                  onClick={() =>
                    setPrefs((p) => ({ ...p, openToDailyCard: true }))
                  }
                >
                  开
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/80">
                开启后，每次打开首页（含主屏）会轻轻滚到今日一牌。
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm">主屏打开时轻声提醒</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={!prefs.dailyHabitNudge ? "default" : "outline"}
                  onClick={() =>
                    setPrefs((p) => ({ ...p, dailyHabitNudge: false }))
                  }
                >
                  关
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={prefs.dailyHabitNudge ? "default" : "outline"}
                  onClick={() =>
                    setPrefs((p) => ({ ...p, dailyHabitNudge: true }))
                  }
                >
                  开
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/80">
                仅在主屏幕独立窗口打开时出现站内旁白；可点「今日不再」，设置里也可关掉。
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" onClick={save}>
            保存
          </Button>
          {saved ? (
            <span className="text-sm text-muted-foreground">已保存到本机</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
