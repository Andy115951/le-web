import { createOpenAI } from "@ai-sdk/openai";
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

/** Same defaults as stock-dashboard DeepSeek OpenAI-compatible gateway. */
const DEFAULT_CHAT_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-v4-flash";

function normalizeChatUrl(value: string | undefined): string | null {
  const candidate = String(value || DEFAULT_CHAT_URL).trim();
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Derive OpenAI SDK baseURL from a full chat-completions URL (stock style). */
export function baseUrlFromChatCompletions(chatUrl: string): string {
  const u = new URL(chatUrl);
  let path = u.pathname.replace(/\/+$/, "");
  if (path.endsWith("/chat/completions")) {
    path = path.slice(0, -"/chat/completions".length) || "";
  }
  u.pathname = path;
  u.search = "";
  u.hash = "";
  return u.toString().replace(/\/+$/, "");
}

export function getDeepSeekConfig(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = String(env.DEEPSEEK_API_KEY || "").trim();
  const model = String(env.DEEPSEEK_MODEL || DEFAULT_MODEL).trim();
  const chatUrl = normalizeChatUrl(env.DEEPSEEK_API_URL);
  if (apiKey.length < 16) return { configured: false as const, reason: "missing_api_key" };
  if (!model) return { configured: false as const, reason: "missing_model" };
  if (!chatUrl) return { configured: false as const, reason: "invalid_api_url" };
  return {
    configured: true as const,
    apiKey,
    model: model.slice(0, 100),
    chatUrl,
    baseURL: baseUrlFromChatCompletions(chatUrl),
  };
}

function getClient() {
  const cfg = getDeepSeekConfig();
  if (!cfg.configured) {
    throw new Error(`DeepSeek not configured: ${cfg.reason}`);
  }
  const openai = createOpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    name: "deepseek",
  });
  return { model: openai.chat(cfg.model), cfg };
}

export const deepseekAI: TarotAI = {
  async interpret(input: InterpretInput) {
    const { model } = getClient();
    const { text } = await generateText({
      model,
      system: interpretSystemPrompt(input),
      prompt: interpretUserPrompt(input),
    });
    return text.trim();
  },
  async followUp(input: FollowUpInput) {
    const { model } = getClient();
    const { text } = await generateText({
      model,
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
    const { model } = getClient();
    const result = streamText({
      model,
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
    const { model } = getClient();
    const result = streamText({
      model,
      system: followUpSystemPrompt(input),
      messages: followUpMessages(input),
    });
    for await (const delta of result.textStream) {
      if (delta) yield delta;
    }
  },
};
