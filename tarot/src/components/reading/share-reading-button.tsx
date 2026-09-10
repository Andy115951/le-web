"use client";

import { useState } from "react";
import type { Reading } from "@/lib/types";
import {
  formatReadingShareText,
  shareReadingTitle,
} from "@/lib/share-reading";
import {
  renderReadingSharePng,
  shareImageFilename,
} from "@/lib/share-reading-image";
import { Button } from "@/components/ui/button";

type ShareState = "idle" | "copied" | "shared" | "error";
type ImageState = "idle" | "working" | "saved" | "shared" | "error";

export function ShareReadingButton({
  reading,
  disabled,
}: {
  reading: Reading;
  disabled?: boolean;
}) {
  const [state, setState] = useState<ShareState>("idle");
  const [imageState, setImageState] = useState<ImageState>("idle");

  async function onShareText() {
    const text = formatReadingShareText(reading);
    const title = shareReadingTitle(reading);

    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        try {
          await navigator.share({ title, text });
          setState("shared");
          window.setTimeout(() => setState("idle"), 2000);
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
        }
      }

      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(text);
        setState("copied");
        window.setTimeout(() => setState("idle"), 2000);
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
      setState("copied");
      window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2500);
    }
  }

  async function onShareImage() {
    if (imageState === "working") return;
    setImageState("working");
    try {
      const blob = await renderReadingSharePng(reading);
      const file = new File([blob], shareImageFilename(reading), {
        type: "image/png",
      });
      const title = shareReadingTitle(reading);

      const canShareFiles =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFiles) {
        try {
          await navigator.share({
            title,
            text: formatReadingShareText(reading),
            files: [file],
          });
          setImageState("shared");
          window.setTimeout(() => setImageState("idle"), 2000);
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            setImageState("idle");
            return;
          }
          // Fall through to download
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setImageState("saved");
      window.setTimeout(() => setImageState("idle"), 2000);
    } catch {
      setImageState("error");
      window.setTimeout(() => setImageState("idle"), 2500);
    }
  }

  const textLabel =
    state === "copied"
      ? "已复制"
      : state === "shared"
        ? "已分享"
        : state === "error"
          ? "未能分享"
          : "分享牌阵";

  const imageLabel =
    imageState === "working"
      ? "生成中…"
      : imageState === "saved"
        ? "已保存"
        : imageState === "shared"
          ? "已分享图"
          : imageState === "error"
            ? "未能出图"
            : "保存分享图";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onShareText}
        disabled={disabled || state === "error"}
        aria-label="分享本局牌阵文字摘要"
      >
        {textLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onShareImage}
        disabled={disabled || imageState === "working" || imageState === "error"}
        aria-label="生成并保存本局牌阵分享图"
      >
        {imageLabel}
      </Button>
    </div>
  );
}
