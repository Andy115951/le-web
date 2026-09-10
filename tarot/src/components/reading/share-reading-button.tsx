"use client";

import { useState } from "react";
import type { Reading } from "@/lib/types";
import {
  formatReadingShareText,
  shareReadingTitle,
} from "@/lib/share-reading";
import { Button } from "@/components/ui/button";

type ShareState = "idle" | "copied" | "shared" | "error";

export function ShareReadingButton({
  reading,
  disabled,
}: {
  reading: Reading;
  disabled?: boolean;
}) {
  const [state, setState] = useState<ShareState>("idle");

  async function onShare() {
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
          // User cancelled share sheet — stay quiet
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          // Fall through to clipboard
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

      // Last resort: legacy execCommand
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

  const label =
    state === "copied"
      ? "已复制"
      : state === "shared"
        ? "已分享"
        : state === "error"
          ? "未能分享"
          : "分享牌阵";

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onShare}
      disabled={disabled || state === "error"}
      aria-label="分享本局牌阵摘要"
    >
      {label}
    </Button>
  );
}
