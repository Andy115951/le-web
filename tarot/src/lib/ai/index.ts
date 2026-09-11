import { deepseekAI } from "@/lib/ai/deepseek";
import { mockAI } from "@/lib/ai/mock";
import type {
  FollowUpInput,
  InterpretInput,
  StreamOptions,
  TarotAI,
  TokenVerseInput,
} from "@/lib/ai/types";

function withMockFallback(primary: TarotAI, label: string): TarotAI {
  return {
    async interpret(input: InterpretInput) {
      try {
        return await primary.interpret(input);
      } catch (err) {
        console.error(`[ai] ${label} interpret failed; falling back to mock`, err);
        return mockAI.interpret(input);
      }
    },
    async followUp(input: FollowUpInput) {
      try {
        return await primary.followUp(input);
      } catch (err) {
        console.error(`[ai] ${label} followUp failed; falling back to mock`, err);
        return mockAI.followUp(input);
      }
    },
    async tokenVerse(input: TokenVerseInput) {
      try {
        return await primary.tokenVerse(input);
      } catch (err) {
        console.error(`[ai] ${label} tokenVerse failed; falling back to mock`, err);
        return mockAI.tokenVerse(input);
      }
    },
    async *interpretStream(input: InterpretInput, options?: StreamOptions) {
      let yielded = false;
      try {
        for await (const part of primary.interpretStream(input, options)) {
          yielded = true;
          yield part;
        }
        if (!yielded) yield* mockAI.interpretStream(input, options);
      } catch (err) {
        console.error(`[ai] ${label} interpretStream failed; falling back to mock`, err);
        if (!yielded) yield* mockAI.interpretStream(input, options);
        else throw err;
      }
    },
    async *followUpStream(input: FollowUpInput, options?: StreamOptions) {
      let yielded = false;
      try {
        for await (const part of primary.followUpStream(input, options)) {
          yielded = true;
          yield part;
        }
        if (!yielded) yield* mockAI.followUpStream(input, options);
      } catch (err) {
        console.error(`[ai] ${label} followUpStream failed; falling back to mock`, err);
        if (!yielded) yield* mockAI.followUpStream(input, options);
        else throw err;
      }
    },
  };
}

/**
 * mock (default) | deepseek — OpenAI-compatible DeepSeek (same pattern as stock-dashboard).
 * Legacy alias: gateway → deepseek (no longer uses Vercel AI Gateway).
 */
export function getTarotAI(): TarotAI {
  const provider = (process.env.AI_PROVIDER || "mock").toLowerCase();
  if (provider === "deepseek" || provider === "gateway") {
    return withMockFallback(deepseekAI, "deepseek");
  }
  return mockAI;
}

export function getAiProviderLabel(): string {
  const provider = (process.env.AI_PROVIDER || "mock").toLowerCase();
  if (provider === "gateway") return "deepseek";
  return provider;
}

export type {
  TarotAI,
  InterpretInput,
  FollowUpInput,
  TokenVerseInput,
  StreamOptions,
} from "@/lib/ai/types";
