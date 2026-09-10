import type { Message } from "@/lib/types";

export type StreamEvent =
  | { t: "delta"; c: string }
  | { t: "done"; messages: Message[] }
  | { t: "error"; error: string };

export function ndjsonStreamResponse(
  run: (
    write: (event: StreamEvent) => void,
  ) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await run(write);
      } catch (e) {
        write({
          t: "error",
          error: e instanceof Error ? e.message : "生成失败",
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export function wantsStream(req: Request): boolean {
  const url = new URL(req.url);
  if (url.searchParams.get("stream") === "0") return false;
  if (url.searchParams.get("stream") === "1") return true;
  const accept = req.headers.get("accept") || "";
  return accept.includes("application/x-ndjson");
}

export function streamOptionsFromReq(req: Request) {
  const url = new URL(req.url);
  const instant =
    url.searchParams.get("instant") === "1" ||
    req.headers.get("x-reduced-motion") === "1";
  return { instant };
}
