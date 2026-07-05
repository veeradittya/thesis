import { getMacroEvents, subscribeDist, getLatest } from "@/lib/macroFeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live macro signals over SSE: send the upcoming-releases catalog, then stream cross-venue
// probability distributions from a shared Oddpool websocket. The Oddpool key stays server-side.
export async function GET(req: Request) {
  if (!process.env.ODDPOOL_API_KEY) return new Response("ODDPOOL_API_KEY not set", { status: 500 });

  let events;
  try {
    events = await getMacroEvents();
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "macro catalog failed", { status: 502 });
  }
  const keys = events.map((e) => e.eventKey);

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

      // 1) catalog so the card renders rows immediately
      send("catalog", events);

      // 2) live distributions (dist pushes current state on subscribe, then streams)
      unsub = subscribeDist(keys, (dist) => send("dist", dist));
      for (const d of getLatest(keys)) send("dist", d); // warm-seed if another client already populated

      // keep-alive so proxies don't drop the idle stream
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
