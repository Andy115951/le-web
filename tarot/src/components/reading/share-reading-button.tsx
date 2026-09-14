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
import { ShareImagePreview } from "@/components/reading/share-image-preview";

type ShareState = "idle" | "copied" | "shared" | "error";
type ImageState = "idle" | "working" | "error";

export function ShareReadingButton({
  reading,
  disabled,
}: {
  reading: Reading;
  disabled?: boolean;
}) {
  const [state, setState] = useState<ShareState>("idle");
  const [imageState, setImageState] = useState<ImageState>("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

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
      setPreviewBlob(blob);
      setPreviewOpen(true);
      setImageState("idle");
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
      : imageState === "error"
        ? "未能出图"
        : "保存分享图";

  const filename = shareImageFilename(reading);
  const shareTitle = shareReadingTitle(reading);
  const shareText = formatReadingShareText(reading);

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
        onClick={() => void onShareImage()}
        disabled={disabled || imageState === "working" || imageState === "error"}
        aria-label="生成牌阵分享图，预览后保存或系统分享"
      >
        {imageLabel}
      </Button>
      <ShareImagePreview
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreviewBlob(null);
        }}
        blob={previewBlob}
        filename={filename}
        title="保存分享图"
        shareTitle={shareTitle}
        shareText={shareText}
        previewAlt="本局牌阵分享图预览"
      />
    </div>
  );
}
