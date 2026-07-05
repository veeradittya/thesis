import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

// Dartmouth Claude gateway (OpenAI-compatible) — primary, as used in the rebecca project.
const GATEWAY_BASE = process.env.DARTMOUTH_GATEWAY_BASE || "https://chat.dartmouth.edu/api";
const GATEWAY_MODEL = process.env.DARTMOUTH_MODEL || "anthropic.claude-sonnet-4-5-20250929";

// JSON Schema used only by the Anthropic-direct fallback (structured outputs).
const SCHEMA = {
  type: "object",
  properties: {
    thesis_summary: { type: "string" },
    thesis_type: { type: "string" },
    time_horizon: { type: ["string", "null"] },
    needs_user_input: { type: "boolean" },
    clarifying_questions: { type: "array", items: { type: "string" } },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          statement: { type: "string" },
          why_it_matters: { type: "string" },
          break_condition: { type: "string" },
          weight: { type: "number" },
          signals: {
            type: "array",
            items: {
              type: "object",
              properties: {
                source_id: { type: "string" },
                type: { type: "string", enum: ["leading", "confirming"] },
                what_to_watch: { type: "string" },
                direction: { type: "string" },
                threshold: { type: "string" },
              },
              required: ["source_id", "type", "what_to_watch", "direction", "threshold"],
              additionalProperties: false,
            },
          },
          observability: { type: "string", enum: ["high", "medium", "low"] },
          fallback: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          status: { type: "string", enum: ["holding", "weakening", "broken"] },
        },
        required: [
          "id",
          "statement",
          "why_it_matters",
          "break_condition",
          "weight",
          "signals",
          "observability",
          "fallback",
          "confidence",
          "status",
        ],
        additionalProperties: false,
      },
    },
    unstated_assumptions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          assumption: { type: "string" },
          risk_if_wrong: { type: "string" },
          monitorable: { type: "boolean" },
        },
        required: ["assumption", "risk_if_wrong", "monitorable"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "thesis_summary",
    "thesis_type",
    "time_horizon",
    "needs_user_input",
    "clarifying_questions",
    "claims",
    "unstated_assumptions",
  ],
  additionalProperties: false,
};

// The gateway returns plain text; tolerate code fences or prose around the JSON.
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
    return NextResponse.json(
      { error: "No model key set. Add DARTMOUTH_API_KEY (or ANTHROPIC_API_KEY) to .env.local and restart." },
      { status: 500 },
    );
  }

  let body: { thesis?: string; holdings?: string; timeHorizon?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { thesis, holdings, timeHorizon } = body;
  if (!thesis?.trim() || !holdings?.trim()) {
    return NextResponse.json({ error: "Both a thesis and at least one holding are required." }, { status: 400 });
  }

  const root = process.cwd();
  let promptMd: string;
  let registryJson: string;
  try {
    [promptMd, registryJson] = await Promise.all([
      readFile(path.join(root, "prompts/decomposition.md"), "utf8"),
      readFile(path.join(root, "registry/source-registry.json"), "utf8"),
    ]);
  } catch {
    return NextResponse.json(
      { error: "Could not read prompts/decomposition.md or registry/source-registry.json." },
      { status: 500 },
    );
  }

  const system = `${promptMd}\n\n## SOURCE REGISTRY (the ONLY valid source_ids)\n\n\`\`\`json\n${registryJson}\n\`\`\``;
  const now = new Date();
  const today = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const nextYear = now.getFullYear() + 1;
  const userMsg = `current_date: ${today}

IMPORTANT: Anchor every break_condition, threshold, signal, and timeframe to the CURRENT date above. Stay forward-looking from today — never reference a past year (e.g. an already-elapsed year) as if it were upcoming or current. Frame timeframes relative to now, e.g. "over the next N quarters" or "through ${nextYear}".

thesis: ${thesis.trim()}
holdings: ${holdings.trim()}
time_horizon: ${timeHorizon?.trim() || "(not provided)"}`;

  let rawText = "";
  let via = "";

  try {
    if (dartmouthKey) {
      // Primary: Dartmouth Claude gateway (OpenAI-compatible chat/completions), as in rebecca.
      via = `dartmouth:${GATEWAY_MODEL}`;
      const res = await fetch(`${GATEWAY_BASE}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dartmouthKey}`,
        },
        body: JSON.stringify({
          model: GATEWAY_MODEL,
          max_tokens: 8000,
          tool_choice: "none",
          tools: [],
          messages: [
            {
              role: "system",
              content:
                system +
                "\n\nDo not call any tools. Return ONLY the JSON object described above — no prose, no markdown, no code fences.",
            },
            { role: "user", content: userMsg },
          ],
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        return NextResponse.json(
          { error: `Dartmouth gateway error ${res.status}: ${t.slice(0, 300)}` },
          { status: 502 },
        );
      }
      const data = await res.json();
      rawText = data?.choices?.[0]?.message?.content ?? "";
      if (!rawText) {
        return NextResponse.json({ error: "Dartmouth gateway returned no content." }, { status: 502 });
      }
    } else {
      // Fallback: Anthropic API directly with structured outputs.
      via = "anthropic:claude-opus-4-8";
      const client = new Anthropic({ apiKey: anthropicKey });
      const response: { content?: Array<{ type: string; text?: string }> } = await (
        client as unknown as {
          messages: { create: (p: unknown) => Promise<{ content?: Array<{ type: string; text?: string }> }> };
        }
      ).messages.create({
        model: "claude-opus-4-8",
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
        system,
        messages: [{ role: "user", content: userMsg }],
      });
      const block = (response.content || []).find((b) => b.type === "text" && typeof b.text === "string");
      rawText = block?.text ?? "";
      if (!rawText) {
        return NextResponse.json({ error: "Model returned no text content." }, { status: 502 });
      }
    }

    let decomposition: unknown;
    try {
      decomposition = extractJson(rawText);
    } catch {
      return NextResponse.json(
        { error: "Model output was not valid JSON.", raw: rawText.slice(0, 400) },
        { status: 502 },
      );
    }

    return NextResponse.json({ decomposition, via });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Decomposition request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
