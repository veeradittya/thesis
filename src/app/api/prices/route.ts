import { getQuotes } from "@/lib/prices";
import { subscribe } from "@/lib/priceStream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live prices over SSE: seed a snapshot (price + prev close), then stream trade ticks
// from a shared Finnhub websocket. The Finnhub token stays server-side.
export async function GET(req: Request) {
  const symbols = (new URL(req.url).searchParams.get("symbols") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20);
  if (!symbols.length) return new Response("no symbols", { status: 400 });
  if (!process.env.FINNHUB_API_KEY) return new Response("FINNHUB_API_KEY not set", { status: 500 });

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
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* controller closed */
        }
      };

      // 1) seed snapshot so the card shows prices + change% immediately
      try {
        send("snapshot", await getQuotes(symbols));
      } catch {
        /* snapshot best-effort */
      }

      // 2) live trades
      unsub = subscribe(symbols, (sym, price, ts) => send("trade", { [sym]: { p: price, t: ts } }));

      // keep-alive comment so proxies don't drop the idle stream
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
