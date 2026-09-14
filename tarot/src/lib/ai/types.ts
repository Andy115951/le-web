import type { DetailLevel, SceneId } from "@/data/scenes";
import type { Message, SpreadResult } from "@/lib/types";

export type InterpretInput = {
  question: string;
  scene: SceneId;
  detailLevel: DetailLevel;
  spreadResult: SpreadResult;
  /** P41: same-question prior reading summary for a light opening mention. */
  priorHint?: {
    createdAt: string; // ISO
    spread: string; // spread type id
    cards: { positionLabel: string; cardId: string; reversed: boolean }[];
  } | null;
};

export type FollowUpInput = {
  question: string;
  scene: SceneId;
  spreadResult: SpreadResult;
  history: Pick<Message, "role" | "content">[];
  userMessage: string;
};

export type StreamOptions = {
  /** Skip artificial pacing (e.g. prefers-reduced-motion). */
  instant?: boolean;
};

/** P30 烛火信物：短签 verse for focal card wallpaper. */
export type TokenVerseInput = {
  question: string;
  scene: SceneId;
  spreadResult: SpreadResult;
  cardId: string;
  reversed: boolean;
  positionLabel: string;
};

export interface TarotAI {
  interpret(input: InterpretInput): Promise<string>;
  followUp(input: FollowUpInput): Promise<string>;
  tokenVerse(input: TokenVerseInput): Promise<string>;
  interpretStream(
    input: InterpretInput,
    options?: StreamOptions,
  ): AsyncIterable<string>;
  followUpStream(
    input: FollowUpInput,
    options?: StreamOptions,
  ): AsyncIterable<string>;
}
