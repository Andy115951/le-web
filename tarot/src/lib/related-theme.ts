import type { SceneId } from "@/data/scenes";
import { normalizeQuestion } from "@/lib/normalize-question";

/** Look back window for P49 related-theme hints (restrained). */
export const RELATED_THEME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Common filler words / particles to ignore in soft overlap. */
const STOP = new Set([
  "的",
  "了",
  "吗",
  "呢",
  "啊",
  "吧",
  "么",
  "呀",
  "嘛",
  "哦",
  "嗯",
  "是",
  "不",
  "在",
  "有",
  "和",
  "与",
  "或",
  "及",
  "被",
  "把",
  "对",
  "就",
  "都",
  "也",
  "很",
  "更",
  "最",
  "还",
  "又",
  "再",
  "会",
  "能",
  "可",
  "要",
  "想",
  "请",
  "这",
  "那",
  "哪",
  "什么",
  "怎么",
  "怎样",
  "如何",
  "为何",
  "为什么",
  "是否",
  "一个",
  "一些",
  "一下",
  "我们",
  "你们",
  "他们",
  "自己",
  "目前",
  "现在",
  "最近",
  "接下来",
  "当下",
  "眼下",
  "关于",
  "对于",
  "如果",
  "因为",
  "所以",
  "但是",
  "而且",
  "以及",
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "to",
  "of",
  "in",
  "on",
  "for",
  "and",
  "or",
  "my",
  "me",
  "i",
  "you",
  "we",
  "what",
  "how",
  "why",
  "should",
  "will",
  "can",
  "do",
  "does",
  "did",
]);

/**
 * Soft tokens for related-theme matching (P49).
 * Latin: word tokens; CJK: overlapping bigrams (+ unigram if short).
 */
export function questionTokens(q: string): string[] {
  const n = normalizeQuestion(q).toLowerCase();
  if (!n) return [];
  const out = new Set<string>();

  for (const m of n.match(/[a-z0-9]{2,}/g) ?? []) {
    if (!STOP.has(m)) out.add(m);
  }

  const cjk = n.replace(/[^\u4e00-\u9fff]/g, "");
  if (cjk.length >= 2) {
    for (let i = 0; i < cjk.length - 1; i++) {
      const bi = cjk.slice(i, i + 2);
      if (!STOP.has(bi)) out.add(bi);
    }
  } else if (cjk.length === 1 && !STOP.has(cjk)) {
    out.add(cjk);
  }

  return [...out];
}

/** True when questions soft-overlap (not exact same normalized string). */
export function questionsRelated(a: string, b: string): boolean {
  if (normalizeQuestion(a) === normalizeQuestion(b)) return false;
  const ta = questionTokens(a);
  const tb = questionTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const setB = new Set(tb);
  let overlap = 0;
  for (const t of ta) if (setB.has(t)) overlap++;
  if (overlap >= 2) return true;
  const union = new Set([...ta, ...tb]).size;
  return overlap >= 1 && union > 0 && overlap / union >= 0.4;
}

/**
 * Related theme (P49): not exact same question; same non-custom scene
 * OR soft question token overlap. Caller enforces time window.
 */
export function isRelatedTheme(
  current: { question: string; scene: SceneId },
  prior: { question: string; scene: SceneId },
): boolean {
  if (normalizeQuestion(current.question) === normalizeQuestion(prior.question)) {
    return false;
  }
  if (
    current.scene === prior.scene &&
    current.scene !== "custom"
  ) {
    return true;
  }
  return questionsRelated(current.question, prior.question);
}

/** Truncate for compact prompt injection (not full AI text). */
export function questionPreview(q: string, max = 28): string {
  const n = normalizeQuestion(q);
  if (n.length <= max) return n;
  return `${n.slice(0, max)}…`;
}
