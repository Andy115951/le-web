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
import { ShareImagePreview } from "@/components/reading/share-image-preview";

type TokenState = "idle" | "working" | "error";

export function CandleTokenButton({
  reading,
  disabled,
  onLit,
}: {
  reading: Reading;
  disabled?: boolean;
  /** P48: parent timeline marks 信物 when preview opens */
  onLit?: () => void;
}) {
  const [state, setState] = useState<TokenState>("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{
    filename: string;
    verse: string;
  } | null>(null);

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
      const filename = tokenImageFilename(reading, card?.nameZh);

      setPreviewBlob(blob);
      setPreviewMeta({ filename, verse: data.verse });
      setPreviewOpen(true);
      setState("idle");
      onLit?.();
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2500);
    }
  }

  const label =
    state === "working"
      ? "点亮中…"
      : state === "error"
        ? "未能点亮"
        : "烛火信物";

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void onGenerate()}
        disabled={disabled || state === "working" || state === "error"}
        aria-label="生成烛火信物壁纸，预览后保存或系统分享"
        className="border-primary/40 text-primary"
      >
        {label}
      </Button>
      <ShareImagePreview
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) {
            setPreviewBlob(null);
            setPreviewMeta(null);
          }
        }}
        blob={previewBlob}
        filename={previewMeta?.filename ?? "candle-taro-token.png"}
        title="烛火信物"
        shareTitle={`${PRODUCT_NAME} · 烛火信物`}
        shareText={previewMeta?.verse}
        previewAlt="烛火信物壁纸预览"
      />
    </>
  );
}
