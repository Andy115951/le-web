import type { DetailLevel, RitualSpeed, SceneId, SpreadType } from "@/data/scenes";

const STORAGE_KEY = "candle-taro:reading-draft";
const SCENES = ["love", "career", "study", "social", "choice", "body", "custom"];
const SPREADS = ["three_card", "single", "five_cross", "relation_dual", "choice_fork", "moon_triad", "celtic_cross"];

export type ReadingDraftFields = {
  sceneId: SceneId;
  question: string;
  spread: SpreadType;
  detail: DetailLevel;
  speed: RitualSpeed;
  silentReveal: boolean;
  advancedOpen: boolean;
};

export type ReadingDraft = {
  version: 1;
  id: string;
  fields: ReadingDraftFields;
};

/** Ignore corrupt/obsolete drafts instead of letting them break the form. */
export function parseReadingDraft(raw: string | null): ReadingDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    const f = value?.fields;
    if (
      value?.version !== 1 || typeof value.id !== "string" || !value.id ||
      !f || !SCENES.includes(f.sceneId) || !SPREADS.includes(f.spread) ||
      typeof f.question !== "string" || f.question.length > 200 ||
      !["brief", "detailed"].includes(f.detail) ||
      !["slow", "normal", "fast"].includes(f.speed) ||
      typeof f.silentReveal !== "boolean" || typeof f.advancedOpen !== "boolean"
    ) return null;
    return {
      version: 1,
      id: value.id,
      fields: {
        sceneId: f.sceneId, question: f.question, spread: f.spread,
        detail: f.detail, speed: f.speed, silentReveal: f.silentReveal,
        advancedOpen: f.advancedOpen,
      },
    };
  } catch {
    return null;
  }
}

export function readReadingDraft(): { draft: ReadingDraft | null; available: boolean } {
  if (typeof window === "undefined") return { draft: null, available: false };
  try {
    return { draft: parseReadingDraft(window.localStorage.getItem(STORAGE_KEY)), available: true };
  } catch {
    return { draft: null, available: false };
  }
}

/** Save synchronously on edits, so immediate navigation cannot outrun a debounce. */
export function writeReadingDraft(fields: ReadingDraftFields): ReadingDraft | null {
  try {
    const draft: ReadingDraft = { version: 1, id: crypto.randomUUID(), fields };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    return draft;
  } catch {
    return null;
  }
}

/** A successful submission must not erase a newer draft edited in another tab. */
export function clearReadingDraft(expectedId?: string): boolean {
  try {
    if (expectedId) {
      const current = readReadingDraft();
      if (!current.available) return false;
      if (current.draft?.id !== expectedId) return true;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
