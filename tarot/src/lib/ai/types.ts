import type { DetailLevel, SceneId } from "@/data/scenes";
import type { Message, SpreadResult } from "@/lib/types";

export type InterpretInput = {
  question: string;
  scene: SceneId;
  detailLevel: DetailLevel;
  spreadResult: SpreadResult;
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

export interface TarotAI {
  interpret(input: InterpretInput): Promise<string>;
  followUp(input: FollowUpInput): Promise<string>;
  interpretStream(
    input: InterpretInput,
    options?: StreamOptions,
  ): AsyncIterable<string>;
  followUpStream(
    input: FollowUpInput,
    options?: StreamOptions,
  ): AsyncIterable<string>;
}
