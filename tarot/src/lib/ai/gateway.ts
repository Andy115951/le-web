import { generateText } from "ai";
import type { FollowUpInput, InterpretInput, TarotAI } from "@/lib/ai/types";
import {
  followUpMessages,
  followUpSystemPrompt,
  interpretSystemPrompt,
  interpretUserPrompt,
} from "@/lib/ai/prompts";

function modelId(): string {
  return process.env.AI_GATEWAY_MODEL || "openai/gpt-5.4-mini";
}

export const gatewayAI: TarotAI = {
  async interpret(input: InterpretInput) {
    const { text } = await generateText({
      model: modelId(),
      system: interpretSystemPrompt(input),
      prompt: interpretUserPrompt(input),
    });
    return text.trim();
  },
  async followUp(input: FollowUpInput) {
    const { text } = await generateText({
      model: modelId(),
      system: followUpSystemPrompt(input),
      messages: followUpMessages(input),
    });
    return text.trim();
  },
};
