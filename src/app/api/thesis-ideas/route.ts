import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const GATEWAY_BASE = process.env.DARTMOUTH_GATEWAY_BASE || "https://chat.dartmouth.edu/api";
const GATEWAY_MODEL = process.env.DARTMOUTH_MODEL || "anthropic.claude-sonnet-4-5-20250929";

const SYSTEM = `You write investment theses in the voice of a sharp, conviction-driven retail investor thinking out loud. Give exactly 5 DISTINCT theses for the asset below. Each is 2 to 3 short sentences MAX: natural and human, the way someone with real conviction actually talks, not a corporate or academic summary. Lead with the core reason to own it, then one logical follow-on (why it holds, or what it sets up). Keep it concrete and qualitative: name the real driver (a moat, a structural edge, a behavior shift), but do NOT lean on statistics, percentages, dollar figures, growth rates, or price targets. No hedging, no ticker prefix, no buzzword soup. Voice to aim for (do not reuse the words): "This is the thing everyone has to build on, and ripping it out costs more than it saves. Until that changes, they keep pricing like they have no real competition." Return ONLY a JSON object: {"ideas": ["...", "...", "...", "...", "..."]}. Do not use em dashes.`;

function extractJson(text: string): unknown {
  let t = (text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  if (!t.startsWith("{")) {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) t = t.slice(a, b + 1);
  }
  return JSON.parse(t);
}

export async function GET(req: Request) {
  const dartmouthKey = process.env.DARTMOUTH_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!dartmouthKey && !anthropicKey) return NextResponse.json({ ideas: [] });

  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "").trim();
  const name = (url.searchParams.get("name") || "").trim();
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  const userMsg = `Asset: ${symbol}${name ? ` (${name})` : ""}`;

  try {
    let raw = "";
    if (dartmouthKey) {
      const res = await fetch(`${GATEWAY_BASE}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${dartmouthKey}` },
        body: JSON.stringify({
          model: GATEWAY_MODEL,
          max_tokens: 700,
          tool_choice: "none",
          tools: [],
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userMsg },
          ],
        }),
      });
      if (!res.ok) return NextResponse.json({ ideas: [] });
      const data = await res.json();
      raw = data?.choices?.[0]?.message?.content ?? "";
    } else {
      const client = new Anthropic({ apiKey: anthropicKey });
      const r: { content?: Array<{ type: string; text?: string }> } = await (
        client as unknown as {
          messages: { create: (p: unknown) => Promise<{ content?: Array<{ type: string; text?: string }> }> };
        }
      ).messages.create({
        model: "claude-opus-4-8",
        max_tokens: 450,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      });
      raw = (r.content || []).filter((b) => b.type === "text" && b.text).map((b) => b.text).join("");
    }

    const parsed = extractJson(raw) as { ideas?: string[] };
    const ideas = Array.isArray(parsed.ideas) ? parsed.ideas.filter((x) => typeof x === "string").slice(0, 5) : [];
    return NextResponse.json({ ideas });
  } catch {
    return NextResponse.json({ ideas: [] });
  }
}
