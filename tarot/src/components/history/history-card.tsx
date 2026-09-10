"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type HistoryCardData = {
  id: string;
  title: string;
  question: string;
  sceneLabel: string;
  spreadLabel: string;
  cardNames: string;
  updatedAt: string;
};

export function HistoryCard({ reading }: { reading: HistoryCardData }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(reading.title || reading.question);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveRename() {
    const next = title.trim();
    if (!next) {
      setError("标题不能为空");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/readings/${reading.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "重命名失败");
      }
      setRenaming(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "重命名失败");
    } finally {
      setBusy(false);
    }
  }

  async function softDelete() {
    if (!window.confirm("把这局收进烛影里？之后列表里就看不到了。")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/readings/${reading.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "删除失败");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
      setBusy(false);
    }
  }

  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardHeader className="space-y-3">
        {renaming ? (
          <div className="space-y-2">
            <Input
              value={title}
              maxLength={40}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveRename();
                if (e.key === "Escape") {
                  setRenaming(false);
                  setTitle(reading.title || reading.question);
                  setError(null);
                }
              }}
              aria-label="重命名"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => void saveRename()}>
                保存
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setRenaming(false);
                  setTitle(reading.title || reading.question);
                  setError(null);
                }}
              >
                取消
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Link href={`/reading/${reading.id}`} className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">
                  {reading.title || reading.question}
                </CardTitle>
                <Badge variant="outline">{reading.spreadLabel}</Badge>
                <Badge variant="secondary">{reading.sceneLabel}</Badge>
              </div>
              <CardDescription>
                {reading.cardNames}
                <span className="mx-2">·</span>
                {new Date(reading.updatedAt).toLocaleString("zh-CN")}
              </CardDescription>
            </Link>
            <div className="flex shrink-0 gap-1">
              <Button
                size="xs"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setRenaming(true);
                  setError(null);
                }}
              >
                重命名
              </Button>
              <Button
                size="xs"
                variant="destructive"
                disabled={busy}
                onClick={() => void softDelete()}
              >
                删除
              </Button>
            </div>
          </div>
        )}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardHeader>
    </Card>
  );
}
