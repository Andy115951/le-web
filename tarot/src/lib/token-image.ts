import { getCardArtSrc } from "@/data/card-art";
import { getCard, type DeckCard, type Suit } from "@/data/deck";
import { PRODUCT_NAME } from "@/data/scenes";
import { spreadLabel } from "@/lib/spread-label";
import type { Reading } from "@/lib/types";

/** Portrait wallpaper-ish 9:16 */
const W = 1080;
const H = 1920;

const SUIT_GLYPH: Record<Suit, string> = {
  wands: "✦",
  cups: "☾",
  swords: "†",
  pentacles: "◈",
};

const SUIT_ACCENT: Record<Suit, string> = {
  wands: "#d4a017",
  cups: "#6ba3c9",
  swords: "#9aa4b2",
  pentacles: "#5fad7e",
};

const MAJOR_ACCENT = "#e0b35a";

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function cardGlyph(card: DeckCard | undefined): string {
  if (!card) return "✧";
  if (card.arcana === "major") {
    const roman = [
      "0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
      "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI",
    ];
    return card.number !== undefined ? (roman[card.number] ?? "✧") : "✧";
  }
  if (card.suit) return SUIT_GLYPH[card.suit];
  return "✧";
}

function accentFor(card: DeckCard | undefined): string {
  if (!card) return MAJOR_ACCENT;
  if (card.arcana === "major") return MAJOR_ACCENT;
  if (card.suit) return SUIT_ACCENT[card.suit];
  return MAJOR_ACCENT;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    const chars = Array.from(para);
    let line = "";
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
        if (lines.length >= maxLines) break;
      } else {
        line = test;
      }
    }
    if (lines.length >= maxLines) break;
    if (line) lines.push(line);
    if (lines.length >= maxLines) break;
  }
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1] ?? "";
    lines[maxLines - 1] = truncate(last.replace(/…$/, ""), Math.max(1, last.length));
  }
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i]!, x, y + i * lineHeight);
  }
  return lines.length;
}

export type TokenRenderInput = {
  reading: Reading;
  verse: string;
  cardId: string;
  reversed: boolean;
  positionLabel?: string;
};

/** Build a 9:16 candlelight token wallpaper (focal card + short verse). */
export async function renderCandleTokenPng(input: TokenRenderInput): Promise<Blob> {
  const { reading, verse, cardId, reversed, positionLabel } = input;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");

  const card = getCard(cardId);
  const accent = accentFor(card);
  const name = card?.nameZh ?? "未知";
  const orient = reversed ? "逆位" : "正位";
  const pos = positionLabel ?? "启示";

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a140e");
  bg.addColorStop(0.45, "#100c09");
  bg.addColorStop(1, "#070604");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft candle glow (upper)
  const glow = ctx.createRadialGradient(W / 2, 280, 30, W / 2, 360, 640);
  glow.addColorStop(0, "rgba(224,179,90,0.32)");
  glow.addColorStop(0.5, "rgba(224,179,90,0.08)");
  glow.addColorStop(1, "rgba(224,179,90,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Lower ember
  const ember = ctx.createRadialGradient(W / 2, H - 120, 10, W / 2, H - 80, 420);
  ember.addColorStop(0, "rgba(224,140,60,0.12)");
  ember.addColorStop(1, "rgba(224,140,60,0)");
  ctx.fillStyle = ember;
  ctx.fillRect(0, 0, W, H);

  // Frame
  ctx.strokeStyle = "rgba(224,179,90,0.38)";
  ctx.lineWidth = 3;
  roundRect(ctx, 40, 40, W - 80, H - 80, 32);
  ctx.stroke();
  ctx.strokeStyle = "rgba(224,179,90,0.14)";
  ctx.lineWidth = 1;
  roundRect(ctx, 56, 56, W - 112, H - 112, 26);
  ctx.stroke();

  // Brand
  ctx.textAlign = "center";
  ctx.fillStyle = "#e0b35a";
  ctx.font = "28px Georgia, 'Times New Roman', serif";
  ctx.fillText("✧", W / 2, 130);
  ctx.font = "bold 44px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText(PRODUCT_NAME, W / 2, 186);
  ctx.fillStyle = "rgba(232,214,176,0.65)";
  ctx.font = "24px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText("烛火信物", W / 2, 236);

  // Meta
  ctx.fillStyle = "rgba(232,214,176,0.55)";
  ctx.font = "22px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText(spreadLabel(reading.spreadType), W / 2, 280);

  // Focal card plate
  const cardW = 520;
  const cardH = 780;
  const cardX = (W - cardW) / 2;
  const cardY = 320;

  roundRect(ctx, cardX, cardY, cardW, cardH, 24);
  const plate = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  plate.addColorStop(0, "rgba(224,179,90,0.2)");
  plate.addColorStop(0.4, "rgba(28,22,16,0.96)");
  plate.addColorStop(1, "rgba(12,10,8,0.98)");
  ctx.fillStyle = plate;
  ctx.fill();
  ctx.strokeStyle = "rgba(224,179,90,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  roundRect(ctx, cardX + 14, cardY + 14, cardW - 28, cardH - 28, 16);
  ctx.strokeStyle = "rgba(224,179,90,0.22)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Position
  ctx.fillStyle = "rgba(232,214,176,0.75)";
  ctx.font = "26px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText(truncate(pos, 12), W / 2, cardY + 48);

  const artSrc = getCardArtSrc(cardId);
  const art = artSrc ? await loadImage(artSrc) : null;
  const artX = cardX + 48;
  const artY = cardY + 90;
  const artW = cardW - 96;
  const artH = 480;

  if (art) {
    ctx.save();
    roundRect(ctx, artX, artY, artW, artH, 14);
    ctx.clip();
    if (reversed) {
      ctx.translate(artX + artW / 2, artY + artH / 2);
      ctx.rotate(Math.PI);
      ctx.drawImage(art, -artW / 2, -artH / 2, artW, artH);
    } else {
      ctx.drawImage(art, artX, artY, artW, artH);
    }
    ctx.restore();
  } else {
    const cx = W / 2;
    const cy = artY + artH / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 72, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(18,14,10,0.75)";
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = "56px Georgia, 'Times New Roman', serif";
    ctx.textBaseline = "middle";
    ctx.fillText(cardGlyph(card), cx, cy + 2);
    ctx.textBaseline = "alphabetic";
  }

  ctx.fillStyle = "#f3e7c7";
  ctx.font = "bold 44px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText(truncate(name, 10), W / 2, cardY + cardH - 110);
  ctx.fillStyle = reversed ? "rgba(232,120,100,0.95)" : "rgba(224,179,90,0.95)";
  ctx.font = "26px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText(orient, W / 2, cardY + cardH - 58);

  // Verse plate
  const verseY = cardY + cardH + 56;
  roundRect(ctx, 100, verseY, W - 200, 220, 18);
  ctx.fillStyle = "rgba(20,16,12,0.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(224,179,90,0.28)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#f6edd8";
  ctx.font = "34px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  wrapText(ctx, verse.trim(), W / 2, verseY + 70, W - 280, 52, 3);

  // Footer
  ctx.fillStyle = "rgba(232,214,176,0.5)";
  ctx.font = "22px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  wrapText(
    ctx,
    "仅供娱乐与自我反思，不构成确定预言。",
    W / 2,
    H - 160,
    W - 200,
    34,
    1,
  );
  ctx.fillStyle = "rgba(224,179,90,0.8)";
  ctx.font = "24px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText(`— 来自 ${PRODUCT_NAME}`, W / 2, H - 100);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("png failed"));
        else resolve(blob);
      },
      "image/png",
      0.95,
    );
  });
}

export function tokenImageFilename(reading: Reading, cardName?: string): string {
  const base = truncate(cardName || reading.title || "token", 16).replace(
    /[\\/:*?"<>|]+/g,
    "_",
  );
  return `candle-taro-token-${base}.png`;
}
