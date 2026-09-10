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

export interface TarotAI {
  interpret(input: InterpretInput): Promise<string>;
  followUp(input: FollowUpInput): Promise<string>;
}
