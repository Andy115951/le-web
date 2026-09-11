"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type HistoryCardData = {
  id: string;
  title: string;
  question: string;
  sceneLabel: string;
  spreadLabel: string;
  cardNames: string;
  updatedAt: string;
  /** P32: same-question prior exists */
  canCompare?: boolean;
};

export function HistoryCard({ reading }: { reading: HistoryCardData }) {
  const router = useRouter();
  const renameId = useId();
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [title, setTitle] = useState(reading.title || reading.question);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (renaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming]);

  useEffect(() => {
    if (confirmingDelete) {
      confirmDeleteRef.current?.focus();
    }
  }, [confirmingDelete]);

  function cancelRename() {
    setRenaming(false);
    setTitle(reading.title || reading.question);
    setError(null);
    queueMicrotask(() => renameTriggerRef.current?.focus());
  }

  function cancelDelete() {
    setConfirmingDelete(false);
    setError(null);
    queueMicrotask(() => deleteTriggerRef.current?.focus());
  }

  async function saveRename() {
    const next = title.trim();
    if (!next) {
      setError("标题还空着，写几个字再保存吧。");
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
        throw new Error(data?.error ?? "烛火晃了一下，没能改好标题。稍后再试。");
      }
      setRenaming(false);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "烛火晃了一下，没能改好标题。稍后再试。",
      );
    } finally {
      setBusy(false);
    }
  }

  async function softDelete() {
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
        throw new Error(data?.error ?? "收进烛影时出了点小状况，稍后再试。");
      }
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "收进烛影时出了点小状况，稍后再试。",
      );
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardHeader className="space-y-3">
        {renaming ? (
          <div
            className="space-y-2"
            role="group"
            aria-labelledby={renameId}
          >
            <Label id={renameId} htmlFor={`${renameId}-input`}>
              为这局起个新名字
            </Label>
            <Input
              ref={renameInputRef}
              id={`${renameId}-input`}
              value={title}
              maxLength={40}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveRename();
                if (e.key === "Escape") cancelRename();
              }}
              aria-describedby={error ? `${renameId}-error` : undefined}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => void saveRename()}>
                保存
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={cancelRename}
              >
                取消
              </Button>
            </div>
          </div>
        ) : confirmingDelete ? (
          <div
            className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
            role="alertdialog"
            aria-labelledby={`${renameId}-delete-title`}
            aria-describedby={`${renameId}-delete-desc`}
          >
            <div>
              <p
                id={`${renameId}-delete-title`}
                className="text-sm font-medium text-foreground"
              >
                把这局收进烛影里？
              </p>
              <p
                id={`${renameId}-delete-desc`}
                className="mt-1 text-xs text-muted-foreground"
              >
                之后列表里就看不到了。需要时再点亮一盏新的烛火即可。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                ref={confirmDeleteRef}
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => void softDelete()}
              >
                确认收起
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={cancelDelete}
              >
                先留着
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
                {reading.canCompare ? (
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 text-amber-100/90"
                  >
                    可对照
                  </Badge>
                ) : null}
              </div>
              <CardDescription>
                {reading.cardNames}
                <span className="mx-2" aria-hidden>
                  ·
                </span>
                {new Date(reading.updatedAt).toLocaleString("zh-CN")}
              </CardDescription>
            </Link>
            <div className="flex shrink-0 gap-1">
              <Button
                ref={renameTriggerRef}
                size="xs"
                variant="ghost"
                disabled={busy}
                aria-label={`重命名「${reading.title || reading.question}」`}
                onClick={() => {
                  setConfirmingDelete(false);
                  setRenaming(true);
                  setError(null);
                }}
              >
                重命名
              </Button>
              <Button
                ref={deleteTriggerRef}
                size="xs"
                variant="destructive"
                disabled={busy}
                aria-label={`删除「${reading.title || reading.question}」`}
                onClick={() => {
                  setRenaming(false);
                  setConfirmingDelete(true);
                  setError(null);
                }}
              >
                删除
              </Button>
            </div>
          </div>
        )}
        {error ? (
          <p
            id={`${renameId}-error`}
            className="text-xs text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </CardHeader>
    </Card>
  );
}
