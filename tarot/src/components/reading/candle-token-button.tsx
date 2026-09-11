"use client";

import { useState } from "react";
import { getCard } from "@/data/deck";
import type { Reading } from "@/lib/types";
import {
  renderCandleTokenPng,
  tokenImageFilename,
} from "@/lib/token-image";
import { PRODUCT_NAME } from "@/data/scenes";
import { Button } from "@/components/ui/button";

type TokenState =
  | "idle"
  | "working"
  | "saved"
  | "shared"
  | "error";

export function CandleTokenButton({
  reading,
  disabled,
}: {
  reading: Reading;
  disabled?: boolean;
}) {
  const [state, setState] = useState<TokenState>("idle");

  async function onGenerate() {
    if (state === "working") return;
    setState("working");
    try {
      const res = await fetch(`/api/readings/${reading.id}/token`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        verse?: string;
        cardId?: string;
        reversed?: boolean;
        positionLabel?: string;
        error?: string;
      };
      if (!res.ok || !data.verse || !data.cardId) {
        throw new Error(data.error || "信物没能点亮");
      }

      const blob = await renderCandleTokenPng({
        reading,
        verse: data.verse,
        cardId: data.cardId,
        reversed: Boolean(data.reversed),
        positionLabel: data.positionLabel,
      });
      const card = getCard(data.cardId);
      const file = new File(
        [blob],
        tokenImageFilename(reading, card?.nameZh),
        { type: "image/png" },
      );
      const title = `${PRODUCT_NAME} · 烛火信物`;

      const canShareFiles =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFiles) {
        try {
          await navigator.share({
            title,
            text: data.verse,
            files: [file],
          });
          setState("shared");
          window.setTimeout(() => setState("idle"), 2000);
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            setState("idle");
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
      setState("saved");
      window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2500);
    }
  }

  const label =
    state === "working"
      ? "点亮中…"
      : state === "saved"
        ? "已保存"
        : state === "shared"
          ? "已分享"
          : state === "error"
            ? "未能点亮"
            : "烛火信物";

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => void onGenerate()}
      disabled={disabled || state === "working" || state === "error"}
      aria-label="生成烛火信物壁纸"
      className="border-primary/40 text-primary"
    >
      {label}
    </Button>
  );
}
