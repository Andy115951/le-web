import { getCard, type DeckCard, type Suit } from "@/data/deck";
import { CUSTOM_SCENE, PRODUCT_NAME, SCENES } from "@/data/scenes";
import type { Reading } from "@/lib/types";

const W = 1080;
const H = 1350;

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

function sceneLabel(scene: string): string {
  if (scene === CUSTOM_SCENE.id) return CUSTOM_SCENE.label;
  return SCENES.find((s) => s.id === scene)?.label ?? scene;
}

function spreadLabel(spread: string): string {
  if (spread === "single") return "单牌";
  if (spread === "three_card") return "三牌";
  return spread;
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function cardGlyph(card: DeckCard | undefined): string {
  if (!card) return "✧";
  if (card.arcana === "major") {
    const roman = [
      "0",
      "I",
      "II",
      "III",
      "IV",
      "V",
      "VI",
      "VII",
      "VIII",
      "IX",
      "X",
      "XI",
      "XII",
      "XIII",
      "XIV",
      "XV",
      "XVI",
      "XVII",
      "XVIII",
      "XIX",
      "XX",
      "XXI",
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
  const chars = Array.from(text);
  const lines: string[] = [];
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
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1] ?? "";
    if (chars.join("").length > last.length || line) {
      lines[maxLines - 1] = truncate(last.replace(/…$/, ""), Math.max(1, last.length - 1));
    }
  }
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i]!, x, y + i * lineHeight);
  }
  return lines.length;
}

function drawMiniCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  card: DeckCard | undefined,
  reversed: boolean,
  positionLabel: string,
) {
  const accent = accentFor(card);
  const name = card?.nameZh ?? "未知";
  const glyph = cardGlyph(card);

  // Outer glow plate
  ctx.save();
  roundRect(ctx, x, y, w, h, 18);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "rgba(224,179,90,0.18)");
  g.addColorStop(0.45, "rgba(28,22,16,0.95)");
  g.addColorStop(1, "rgba(12,10,8,0.98)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(224,179,90,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner border
  roundRect(ctx, x + 10, y + 10, w - 20, h - 20, 12);
  ctx.strokeStyle = "rgba(224,179,90,0.22)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Position
  ctx.fillStyle = "rgba(232,214,176,0.75)";
  ctx.font = "22px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(truncate(positionLabel, 10), x + w / 2, y + 22);

  // Glyph ring
  const cx = x + w / 2;
  const cy = y + h * 0.42;
  ctx.beginPath();
  ctx.arc(cx, cy, 36, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(18,14,10,0.7)";
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = "28px Georgia, 'Times New Roman', serif";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, cx, cy + 1);

  // Name + orientation
  ctx.fillStyle = "#f3e7c7";
  ctx.font = "bold 28px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(truncate(name, 8), cx, y + h * 0.62);

  ctx.fillStyle = reversed ? "rgba(232,120,100,0.95)" : "rgba(224,179,90,0.95)";
  ctx.font = "20px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText(reversed ? "逆位" : "正位", cx, y + h * 0.78);

  ctx.restore();
}

/** Build a candlelight portrait PNG of the spread (privacy-safe; no ids). */
export async function renderReadingSharePng(reading: Reading): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a140e");
  bg.addColorStop(0.55, "#100c09");
  bg.addColorStop(1, "#0a0806");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft candle glow
  const glow = ctx.createRadialGradient(W / 2, 180, 20, W / 2, 220, 520);
  glow.addColorStop(0, "rgba(224,179,90,0.28)");
  glow.addColorStop(0.55, "rgba(224,179,90,0.06)");
  glow.addColorStop(1, "rgba(224,179,90,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Frame
  ctx.strokeStyle = "rgba(224,179,90,0.35)";
  ctx.lineWidth = 3;
  roundRect(ctx, 36, 36, W - 72, H - 72, 28);
  ctx.stroke();
  ctx.strokeStyle = "rgba(224,179,90,0.14)";
  ctx.lineWidth = 1;
  roundRect(ctx, 52, 52, W - 104, H - 104, 22);
  ctx.stroke();

  // Brand
  ctx.textAlign = "center";
  ctx.fillStyle = "#e0b35a";
  ctx.font = "26px Georgia, 'Times New Roman', serif";
  ctx.fillText("✧", W / 2, 110);
  ctx.font = "bold 42px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText(PRODUCT_NAME, W / 2, 160);

  // Question
  const question =
    reading.question.trim() || reading.title.trim() || "（未命名）";
  ctx.fillStyle = "#f6edd8";
  ctx.font = "32px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  const qLines = wrapText(ctx, question, W / 2, 230, W - 180, 46, 3);

  // Meta
  const metaY = 230 + qLines * 46 + 28;
  ctx.fillStyle = "rgba(232,214,176,0.7)";
  ctx.font = "24px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText(
    `${sceneLabel(reading.scene)} · ${spreadLabel(reading.spreadType)}`,
    W / 2,
    metaY,
  );

  // Cards
  const cards = reading.spreadResult.cards;
  const count = Math.max(1, cards.length);
  const cardW = count === 1 ? 320 : count === 2 ? 280 : 250;
  const cardH = count === 1 ? 420 : 380;
  const gap = count === 1 ? 0 : 28;
  const totalW = count * cardW + (count - 1) * gap;
  const startX = (W - totalW) / 2;
  const cardY = metaY + 56;

  cards.forEach((c, i) => {
    const deckCard = getCard(c.cardId);
    drawMiniCard(
      ctx,
      startX + i * (cardW + gap),
      cardY,
      cardW,
      cardH,
      deckCard,
      c.reversed,
      c.positionLabel,
    );
  });

  // Disclaimer
  ctx.fillStyle = "rgba(232,214,176,0.55)";
  ctx.font = "22px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  const disclaimer =
    "仅供娱乐与自我反思，不构成确定预言。牌阵是当下的一面镜子，决定仍在你手里。";
  wrapText(ctx, disclaimer, W / 2, H - 170, W - 200, 34, 2);
  ctx.fillStyle = "rgba(224,179,90,0.75)";
  ctx.font = "22px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText(`— 来自 ${PRODUCT_NAME}`, W / 2, H - 90);

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

export function shareImageFilename(reading: Reading): string {
  const q = truncate(reading.question.trim() || reading.title || "reading", 18);
  const safe = q.replace(/[\\/:*?"<>|]+/g, "_");
  return `candle-taro-${safe}.png`;
}
