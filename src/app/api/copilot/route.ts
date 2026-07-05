import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

const GATEWAY_BASE = process.env.DARTMOUTH_GATEWAY_BASE || "https://chat.dartmouth.edu/api";
const GATEWAY_MODEL = process.env.DARTMOUTH_MODEL || "anthropic.claude-sonnet-4-5-20250929";

const COPILOT_SYSTEM = `You are Thesis Copilot — an AI grounded in the user's actual portfolio and their written investment theses. Each thesis has been decomposed into falsifiable claims, each with a weight, a current status (HOLDING / WEAKENING / BROKEN), and an explicit break condition.

Your job:
- Answer questions about the user's specific holdings and theses, using the context provided below.
- When asked whether a thesis is intact, reason claim by claim: which claims hold, which are weakening, and what observable event would trip each break condition.
- Surface what to watch (the leading signals behind each claim) and what would confirm a break.
- Be concise, analytical, and finance-native — terse like a Bloomberg terminal, not chatty.

Rules:
- You provide analysis, not personalized financial advice. Never tell the user to buy or sell. Frame as "your assumption X is challenged by Y," not "you should sell."
- You cannot execute trades or move money.
- Ground every claim-level statement in the user's actual claims and break conditions. If the portfolio context is empty, say so and offer to help them write a thesis.
- If you don't have live market data, say what would need to be true and which signal to check — don't fabricate prices or figures.`;

type Msg = { role: "user" | "assistant"; content: string };

// Transform the gateway's OpenAI-style SSE into a plain-text stream for the client.
function sseToText(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (data === "[DONE]") {
          controller.close();
          return;
        }
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        } catch {
          /* ignore keep-alives / partial frames */
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

export async function POST(req: Request) {
  const dartmouthKey = process.env.DARTMOUTH_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!dartmouthKey && !anthropicKey) {
    return new Response("No model key set. Add DARTMOUTH_API_KEY (or ANTHROPIC_API_KEY) to .env.local.", {
      status: 500,
    });
  }

  let body: { messages?: Msg[]; context?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }

  const messages = (body.messages || []).filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content);
  if (messages.length === 0) {
    return new Response("No messages provided.", { status: 400 });
  }

  const context = body.context?.trim();
  const system =
    COPILOT_SYSTEM +
    (context
      ? `\n\n# THE USER'S PORTFOLIO & THESES\n${context}`
      : "\n\n# THE USER'S PORTFOLIO & THESES\n(empty — the user hasn't added any theses yet)");

  try {
    if (dartmouthKey) {
      const upstream = await fetch(`${GATEWAY_BASE}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${dartmouthKey}` },
        body: JSON.stringify({
          model: GATEWAY_MODEL,
          max_tokens: 1500,
          stream: true,
          tool_choice: "none",
          tools: [],
          messages: [{ role: "system", content: system }, ...messages],
        }),
      });
      if (!upstream.ok || !upstream.body) {
        const t = await upstream.text().catch(() => "");
        return new Response(`Copilot gateway error ${upstream.status}: ${t.slice(0, 200)}`, { status: 502 });
      }
      return new Response(sseToText(upstream.body), {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
      });
    }

    // Fallback: Anthropic API (non-streamed; returned as a single text chunk).
    const client = new Anthropic({ apiKey: anthropicKey });
    const resp: { content?: Array<{ type: string; text?: string }> } = await (
      client as unknown as {
        messages: { create: (p: unknown) => Promise<{ content?: Array<{ type: string; text?: string }> }> };
      }
    ).messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      system,
      messages,
    });
    const text = (resp.content || [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("");
    return new Response(text || "(no response)", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Copilot request failed.";
    return new Response(message, { status: 502 });
  }
}
