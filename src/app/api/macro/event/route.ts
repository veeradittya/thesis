import { subscribeDist, getLatest } from "@/lib/macroFeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live detail for ONE macro event over SSE: streams the cross-venue distribution (all outcomes)
// for the given event_key. Reuses the shared Oddpool websocket — if the list card already
// streams this event, the subscription is warm and seeds instantly. Key stays server-side.
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return new Response("missing key", { status: 400 });
  if (!process.env.ODDPOOL_API_KEY) return new Response("ODDPOOL_API_KEY not set", { status: 500 });

  const enc = new TextEncoder();
  let unsub: (() => void) | null = null;
  let hb: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (hb) clearInterval(hb);
    unsub?.();
  };

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* controller closed */
        }
      };

      unsub = subscribeDist([key], (dist) => {
        if (dist.eventKey === key) send("dist", dist);
      });
      for (const d of getLatest([key])) send("dist", d); // warm-seed the current distribution

      hb = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
