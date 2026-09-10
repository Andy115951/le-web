import { gatewayAI } from "@/lib/ai/gateway";
import { mockAI } from "@/lib/ai/mock";
import type {
  FollowUpInput,
  InterpretInput,
  StreamOptions,
  TarotAI,
} from "@/lib/ai/types";

function withMockFallback(primary: TarotAI): TarotAI {
  return {
    async interpret(input: InterpretInput) {
      try {
        return await primary.interpret(input);
      } catch (err) {
        console.error("[ai] gateway interpret failed; falling back to mock", err);
        return mockAI.interpret(input);
      }
    },
    async followUp(input: FollowUpInput) {
      try {
        return await primary.followUp(input);
      } catch (err) {
        console.error("[ai] gateway followUp failed; falling back to mock", err);
        return mockAI.followUp(input);
      }
    },
    async *interpretStream(input: InterpretInput, options?: StreamOptions) {
      let yielded = false;
      try {
        for await (const part of primary.interpretStream(input, options)) {
          yielded = true;
          yield part;
        }
        if (!yielded) {
          yield* mockAI.interpretStream(input, options);
        }
      } catch (err) {
        console.error(
          "[ai] gateway interpretStream failed; falling back to mock",
          err,
        );
        if (!yielded) {
          yield* mockAI.interpretStream(input, options);
        } else {
          throw err;
        }
      }
    },
    async *followUpStream(input: FollowUpInput, options?: StreamOptions) {
      let yielded = false;
      try {
        for await (const part of primary.followUpStream(input, options)) {
          yielded = true;
          yield part;
        }
        if (!yielded) {
          yield* mockAI.followUpStream(input, options);
        }
      } catch (err) {
        console.error(
          "[ai] gateway followUpStream failed; falling back to mock",
          err,
        );
        if (!yielded) {
          yield* mockAI.followUpStream(input, options);
        } else {
          throw err;
        }
      }
    },
  };
}

/** mock (default) | gateway — gateway failures fall back to mock */
export function getTarotAI(): TarotAI {
  const provider = (process.env.AI_PROVIDER || "mock").toLowerCase();
  if (provider === "gateway") return withMockFallback(gatewayAI);
  return mockAI;
}

export function getAiProviderLabel(): string {
  return (process.env.AI_PROVIDER || "mock").toLowerCase();
}

export type {
  TarotAI,
  InterpretInput,
  FollowUpInput,
  StreamOptions,
} from "@/lib/ai/types";
