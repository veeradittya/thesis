import { runChat, type ChatMsg } from "@/lib/chatAgent";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const raw: unknown[] = Array.isArray(body?.messages) ? body.messages : [];
    if (!raw.length) return Response.json({ error: "No messages." }, { status: 400 });

    // Keep only the last few turns to bound cost/latency.
    const messages: ChatMsg[] = raw
      .slice(-12)
      .map((m) => {
        const mm = m as { role?: string; content?: unknown };
        return { role: mm.role === "assistant" ? ("assistant" as const) : ("user" as const), content: String(mm.content ?? "") };
      })
      .filter((m) => m.content.trim());

    if (!messages.length) return Response.json({ error: "Empty message." }, { status: 400 });

    const portfolio = typeof body?.portfolio === "string" ? body.portfolio : undefined;
    const { reply } = await runChat(messages, portfolio);
    return Response.json({ reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chat failed.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
