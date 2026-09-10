import { generateText, streamText } from "ai";
import { chunkText } from "@/lib/ai/chunk";
import type {
  FollowUpInput,
  InterpretInput,
  StreamOptions,
  TarotAI,
} from "@/lib/ai/types";
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
  async *interpretStream(input: InterpretInput, options?: StreamOptions) {
    if (options?.instant) {
      const text = await this.interpret(input);
      yield* chunkText(text, options);
      return;
    }
    const result = streamText({
      model: modelId(),
      system: interpretSystemPrompt(input),
      prompt: interpretUserPrompt(input),
    });
    for await (const delta of result.textStream) {
      if (delta) yield delta;
    }
  },
  async *followUpStream(input: FollowUpInput, options?: StreamOptions) {
    if (options?.instant) {
      const text = await this.followUp(input);
      yield* chunkText(text, options);
      return;
    }
    const result = streamText({
      model: modelId(),
      system: followUpSystemPrompt(input),
      messages: followUpMessages(input),
    });
    for await (const delta of result.textStream) {
      if (delta) yield delta;
    }
  },
};
