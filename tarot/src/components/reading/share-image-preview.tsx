"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type ShareImagePreviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blob: Blob | null;
  filename: string;
  /** Sheet title, e.g. 保存分享图 / 烛火信物 */
  title: string;
  /** Optional text bundled with system share */
  shareText?: string;
  shareTitle?: string;
  previewAlt: string;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function ShareImagePreview({
  open,
  onOpenChange,
  blob,
  filename,
  title,
  shareText,
  shareTitle,
  previewAlt,
}: ShareImagePreviewProps) {
  const [busy, setBusy] = useState<"idle" | "saving" | "sharing">("idle");
  const [hint, setHint] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }, [blob]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!open) {
      setBusy("idle");
      setHint(null);
    }
  }, [open]);

  const canShareFiles = useMemo(() => {
    if (!blob || typeof navigator === "undefined") return false;
    if (typeof navigator.share !== "function") return false;
    if (typeof navigator.canShare !== "function") return false;
    try {
      const file = new File([blob], filename, { type: blob.type || "image/png" });
      return navigator.canShare({ files: [file] });
    } catch {
      return false;
    }
  }, [blob, filename]);

  async function onSave() {
    if (!blob || busy !== "idle") return;
    setBusy("saving");
    try {
      downloadBlob(blob, filename);
      setHint("已保存到相册/下载");
      window.setTimeout(() => setHint(null), 2000);
    } finally {
      setBusy("idle");
    }
  }

  async function onSystemShare() {
    if (!blob || busy !== "idle") return;
    setBusy("sharing");
    try {
      const file = new File([blob], filename, { type: blob.type || "image/png" });
      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: shareTitle || title,
          text: shareText,
          files: [file],
        });
        setHint("已唤起系统分享");
        window.setTimeout(() => setHint(null), 2000);
      } else if (typeof navigator.share === "function") {
        await navigator.share({
          title: shareTitle || title,
          text: shareText,
        });
        setHint("已唤起系统分享");
        window.setTimeout(() => setHint(null), 2000);
      } else {
        setHint("此设备暂不支持系统分享，请先保存图片");
        window.setTimeout(() => setHint(null), 2500);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Quiet cancel — user dismissed the share sheet
        return;
      }
      setHint("分享未完成，可先保存图片");
      window.setTimeout(() => setHint(null), 2500);
    } finally {
      setBusy("idle");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92vh] w-full max-w-lg gap-0 rounded-t-2xl border-border/60 bg-background/95 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="border-b border-border/40 pb-3">
          <SheetTitle className="text-primary">{title}</SheetTitle>
          <SheetDescription>
            先预览，再选择保存或系统分享。适合发朋友圈时先存图再发。
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto px-4 py-3">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={previewAlt}
              className="max-h-[52vh] w-auto max-w-full rounded-lg border border-primary/25 object-contain shadow-[0_0_24px_rgba(224,179,90,0.12)]"
            />
          ) : (
            <p className="py-8 text-sm text-muted-foreground">预览加载中…</p>
          )}
          {hint ? (
            <p className="text-center text-xs text-primary/90" role="status">
              {hint}
            </p>
          ) : null}
        </div>

        <SheetFooter className="gap-2 border-t border-border/40 pt-3 sm:flex-col">
          <Button
            type="button"
            variant="default"
            className="w-full"
            onClick={() => void onSave()}
            disabled={!blob || busy !== "idle"}
            aria-label="保存图片到本地"
          >
            {busy === "saving" ? "保存中…" : "保存图片"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => void onSystemShare()}
            disabled={!blob || busy !== "idle" || !canShareFiles}
            aria-label="通过系统分享图片"
            title={
              canShareFiles
                ? "唤起系统分享（可发朋友圈等）"
                : "此设备暂不支持带图系统分享"
            }
          >
            {busy === "sharing"
              ? "分享中…"
              : canShareFiles
                ? "系统分享"
                : "系统分享（不可用）"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            关闭
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
