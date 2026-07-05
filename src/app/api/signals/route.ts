import { linkNewsToSignals, type NewsArticle } from "@/lib/signalLink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // two LLM calls + retrieval

// Link a news article to relevant prediction markets. Streams live pipeline logs as
// SSE (`{type:"log",line}` events) then a final `{type:"result",signals,...}` event.
// Keys stay server-side.
export async function POST(req: Request) {
  let body: Partial<NewsArticle>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ signals: [], error: "bad request" }, { status: 400 });
  }
  if (!body?.id || !body?.title) return Response.json({ signals: [], error: "missing article id/title" }, { status: 400 });
  const article: NewsArticle = {
    id: body.id,
    title: body.title,
    trailText: body.trailText ?? null,
    takeaway: body.takeaway ?? null,
    section: body.section ?? null,
    published: body.published ?? null,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (o: unknown) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`)); } catch {}
      };
      try {
        const result = await linkNewsToSignals(article, (line) => send({ type: "log", line }));
        send({ type: "result", ...result });
      } catch (e) {
        send({ type: "result", signals: [], error: e instanceof Error ? e.message : "signal link failed" });
      }
      try { controller.close(); } catch {}
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
