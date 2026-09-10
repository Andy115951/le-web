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
