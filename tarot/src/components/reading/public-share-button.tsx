"use client";

import { useCallback, useEffect, useState } from "react";
import type { Reading } from "@/lib/types";
import { Button } from "@/components/ui/button";

type ShareInfo = {
  enabled: boolean;
  path: string | null;
  url: string | null;
};

type UiState = "idle" | "working" | "copied" | "error";

export function PublicShareButton({
  reading,
  disabled,
}: {
  reading: Reading;
  disabled?: boolean;
}) {
  const [info, setInfo] = useState<ShareInfo>({
    enabled: Boolean(reading.publicShareToken),
    path: reading.publicShareToken ? `/s/${reading.publicShareToken}` : null,
    url: null,
  });
  const [state, setState] = useState<UiState>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/readings/${reading.id}/share`);
      if (!res.ok) return;
      const data = (await res.json()) as ShareInfo;
      setInfo({
        enabled: Boolean(data.enabled),
        path: data.path ?? null,
        url: data.url ?? null,
      });
    } catch {
      /* ignore */
    }
  }, [reading.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function copyText(text: string) {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (!ok) throw new Error("copy failed");
  }

  async function onEnableOrCopy() {
    if (state === "working") return;
    setState("working");
    setErrMsg(null);
    try {
      let url = info.url;
      let path = info.path;
      if (!info.enabled || !url) {
        const res = await fetch(`/api/readings/${reading.id}/share`, {
          method: "POST",
        });
        const data = (await res.json()) as ShareInfo & { error?: string };
        if (!res.ok) throw new Error(data.error || "未能开启短链");
        url = data.url;
        path = data.path;
        setInfo({
          enabled: true,
          path: path ?? null,
          url: url ?? null,
        });
      }
      const toCopy =
        url ||
        (path && typeof window !== "undefined"
          ? `${window.location.origin}${path}`
          : path);
      if (!toCopy) throw new Error("短链尚未就绪");
      await copyText(toCopy);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2000);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "未能开启短链");
      setState("error");
      window.setTimeout(() => {
        setState("idle");
        setErrMsg(null);
      }, 2500);
    }
  }

  async function onDisable() {
    if (state === "working") return;
    setState("working");
    setErrMsg(null);
    try {
      const res = await fetch(`/api/readings/${reading.id}/share`, {
        method: "DELETE",
      });
      const data = (await res.json()) as ShareInfo & { error?: string };
      if (!res.ok) throw new Error(data.error || "未能关闭短链");
      setInfo({ enabled: false, path: null, url: null });
      setState("idle");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "未能关闭短链");
      setState("error");
      window.setTimeout(() => {
        setState("idle");
        setErrMsg(null);
      }, 2500);
    }
  }

  const primaryLabel =
    state === "working"
      ? "处理中…"
      : state === "copied"
        ? "已复制短链"
        : state === "error"
          ? errMsg || "未能分享"
          : info.enabled
            ? "复制短链"
            : "公开短链";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void onEnableOrCopy()}
        disabled={disabled || state === "working"}
        aria-label={
          info.enabled
            ? "复制公开分享短链"
            : "开启公开分享短链并复制"
        }
      >
        {primaryLabel}
      </Button>
      {info.enabled ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void onDisable()}
          disabled={disabled || state === "working"}
          aria-label="关闭并失效公开分享短链"
          className="text-muted-foreground"
        >
          关闭短链
        </Button>
      ) : null}
    </div>
  );
}
