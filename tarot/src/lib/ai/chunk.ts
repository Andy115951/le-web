import type { StreamOptions } from "@/lib/ai/types";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Yield text in small pieces so mock/deepseek fallbacks feel streamed. */
export async function* chunkText(
  text: string,
  options?: StreamOptions,
): AsyncIterable<string> {
  const full = text;
  if (!full) return;
  if (options?.instant) {
    yield full;
    return;
  }
  const size = 10;
  for (let i = 0; i < full.length; i += size) {
    yield full.slice(i, i + size);
    await sleep(14);
  }
}

export async function collectStream(
  stream: AsyncIterable<string>,
): Promise<string> {
  let out = "";
  for await (const part of stream) out += part;
  return out;
}
