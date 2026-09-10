import { mockAI } from "@/lib/ai/mock";
import type { TarotAI } from "@/lib/ai/types";

/** Swap to real provider when AI_PROVIDER !== "mock" */
export function getTarotAI(): TarotAI {
  const provider = process.env.AI_PROVIDER || "mock";
  if (provider === "mock") return mockAI;
  // TODO: return gatewayAI when wired
  return mockAI;
}

export type { TarotAI, InterpretInput, FollowUpInput } from "@/lib/ai/types";
