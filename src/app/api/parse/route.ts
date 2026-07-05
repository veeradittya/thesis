import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const GATEWAY_BASE = process.env.DARTMOUTH_GATEWAY_BASE || "https://chat.dartmouth.edu/api";
const GATEWAY_MODEL = process.env.DARTMOUTH_MODEL || "anthropic.claude-sonnet-4-5-20250929";

const SYSTEM = `You extract structure from a retail investor's free-text investment thesis so a UI can disambiguate it before deeper analysis. Return ONLY a JSON object (no prose, no code fences) with this exact shape:
{
  "primary_ticker": "the uppercase ticker the thesis is mainly about, or empty string if none/unsure",
  "ticker_confidence": "high | medium | low",
  "all_tickers": ["any tickers mentioned, uppercase"],
  "time_horizon": "the holding horizon if stated (e.g. 2 years), else empty string",
  "cleaned_thesis": "a clean one or two sentence restatement in the investor's voice",
  "clarifications": [ { "id": "c1", "question": "a short question" } ]
}
Rules: clarifications are ONLY for genuine ambiguity that would change the analysis (e.g. which leg of a multi-part bet, or which specific names if they named a vague basket). Do NOT ask about the ticker or the time horizon here (those are separate fields). Return 0 to 2 clarifications; if the thesis is clear, return an empty array. Do not use em dashes.`;

function extractJson(text: string): unknown {
  let t = (text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  if (!t.startsWith("{")) {
    const first = t.indexOf("{");
    const last = t.lastIndexOf("}");
    if (first >= 0 && last > first) t = t.slice(first, last + 1);
  }
  return JSON.parse(t);
}

export async function POST(req: Request) {
  const dartmouthKey = process.env.DARTMOUTH_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!dartmouthKey && !anthropicKey) {
    return NextResponse.json({ error: "No model key set." }, { status: 500 });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "text is required." }, { status: 400 });

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
            { role: "user", content: text },
          ],
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        return NextResponse.json({ error: `Parse gateway error ${res.status}: ${t.slice(0, 160)}` }, { status: 502 });
      }
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
        max_tokens: 700,
        system: SYSTEM,
        messages: [{ role: "user", content: text }],
      });
      raw = (r.content || [])
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("");
    }

    let parse: unknown;
    try {
      parse = extractJson(raw);
    } catch {
      return NextResponse.json({ error: "Parse output was not valid JSON." }, { status: 502 });
    }
    return NextResponse.json({ parse });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Parse failed." }, { status: 502 });
  }
}
