import { NextResponse } from "next/server";
import type { Verdict } from "@/lib/thesis";
import { searchTierANews } from "@/lib/tierANews";
import { searchMarkets } from "@/lib/oddpool";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby caps at 60s; the agentic loop usually finishes under (Pro allows raising this)
export const dynamic = "force-dynamic";

export interface AnalyzeInput {
  ticker: string;
  name?: string;
  thesisText?: string;
  horizon?: string | null;
}
export interface AnalyzeResult {
  verdict: Verdict;
  rationale: string; // crisp plain-text prose; facts inline-hyperlinked as markdown [text](url)
  drivers: []; // unused in the tool-research flow (facts are hyperlinked inline)
  date: string;
  degraded: boolean;
}

function todayNY(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

const SYSTEM = [
  "You are a disciplined equity analyst. Judge whether the investor's thesis for a stock still holds, based only on what has happened in roughly the LAST 24 HOURS.",
  "Research it yourself. Call search_news to find the most recent, relevant developments from reputable Tier-A outlets (The Guardian, The New York Times). Search more than once, with focused queries, if that helps.",
  "Call search_prediction_markets ONLY when a live market-implied probability would materially sharpen the verdict — otherwise don't.",
  "Then call emit_verdict with:",
  "- status: 'holds_up' (nothing material weighs against the thesis — the DEFAULT when the last 24h is neutral or supportive), 'weakening' (genuine new friction to a load-bearing part of the thesis), or 'at_risk' (news directly contradicts a core claim the thesis depends on).",
  "- verdict: crisp, plain-language prose, at most ~50 words. HYPERLINK every factual claim to its source with markdown [claim text](https://article-url), using ONLY URLs returned by your searches. No ticker symbols, no cashtags, no bullet points, no headings, no hedging filler. If the last 24h brought nothing relevant, say exactly that.",
  "Use only facts you retrieved. Never invent a source or a URL.",
].join("\n");

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_news",
      description: "Search reputable Tier-A news (The Guardian, The New York Times) for the last ~24-48h. Pass a focused query about the company or the thesis.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_prediction_markets",
      description: "Search live prediction markets (Kalshi/Polymarket) for odds relevant to the thesis. Use only when a market-implied probability would sharpen the verdict.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "emit_verdict",
      description: "Deliver the final verdict.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["holds_up", "weakening", "at_risk"] },
          verdict: { type: "string", description: "crisp plain-text prose, ~50 words max, facts hyperlinked as markdown [text](url), no ticker symbols" },
        },
        required: ["status", "verdict"],
      },
    },
  },
];

interface ToolCall {
  id: string;
  function?: { name?: string; arguments?: string };
}
interface ChatMsg {
  role: string;
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// Keep only markdown links whose URL actually came back from a search (no fabricated sources);
// downgrade any other [text](url) to plain "text".
function sanitizeLinks(md: string, allow: Set<string>): string {
  const norm = (u: string) => u.split("#")[0].split("?")[0].replace(/\/$/, "");
  const allowNorm = new Set([...allow].map(norm));
  return (md || "").replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, text: string, url: string) =>
    allowNorm.has(norm(url)) ? `[${text}](${url})` : text,
  );
}

const asVerdict = (s: unknown): Verdict =>
  s === "weakening" || s === "at_risk" ? s : "holds_up";

// Pure analysis of one thesis — Opus researches Tier-A news itself via tools, then emits a
// plain-text verdict with validated inline hyperlinks. Reused by the on-open route (and phase-2 cron).
export async function analyzeThesis(input: AnalyzeInput): Promise<AnalyzeResult> {
  const ticker = (input.ticker || "").trim().toUpperCase();
  const subject = (input.name || ticker).trim();
  const date = todayNY();
  const degraded = (rationale: string): AnalyzeResult => ({ verdict: "holds_up", rationale, drivers: [], date, degraded: true });
  if (!ticker) return degraded("No ticker provided.");

  const base = process.env.DARTMOUTH_GATEWAY_BASE;
  const token = process.env.DARTMOUTH_API_KEY;
  if (!base || !token) return degraded("Analysis engine is not configured.");
  const models = [
    process.env.DARTMOUTH_OPUS_MODEL || "anthropic.claude-opus-4-8",
    process.env.DARTMOUTH_MODEL || "anthropic.claude-sonnet-4-5-20250929",
  ].filter((m, i, a) => a.indexOf(m) === i);

  const user = `Stock: ${subject}${input.name && input.name !== ticker ? ` (ticker ${ticker})` : ""}\nInvestor's thesis: ${
    input.thesisText || "(none stated — assess whether the last 24h news broadly supports or undermines holding it)"
  }\nHorizon: ${input.horizon || "unspecified"}\n\nResearch the last 24 hours and deliver the verdict.`;

  const runWithModel = async (model: string): Promise<AnalyzeResult | null> => {
    const messages: ChatMsg[] = [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ];
    const urlAllow = new Set<string>();

    for (let step = 0; step < 5; step++) {
      const forceEmit = step === 4;
      let res: Response;
      try {
        res = await fetch(base + "/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({
            model,
            messages,
            tools: TOOLS,
            tool_choice: forceEmit ? { type: "function", function: { name: "emit_verdict" } } : "auto",
            max_tokens: 1200,
          }),
        });
      } catch (e) {
        console.error(`[analyze] gateway error ${model}:`, e);
        return null;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[analyze] gateway ${res.status} for ${model}: ${body.slice(0, 200)}`);
        return null; // caller falls back to the next model
      }
      const msg = (await res.json())?.choices?.[0]?.message as ChatMsg | undefined;
      if (!msg) return null;
      messages.push(msg);

      const calls = msg.tool_calls || [];
      // Model answered in prose without emit_verdict → accept the content as the verdict.
      if (!calls.length) {
        if (msg.content && msg.content.trim()) return { verdict: "holds_up", rationale: sanitizeLinks(msg.content.trim(), urlAllow), drivers: [], date, degraded: false };
        continue;
      }

      let emitted: AnalyzeResult | null = null;
      for (const c of calls) {
        const name = c.function?.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(c.function?.arguments || "{}");
        } catch {}

        if (name === "emit_verdict") {
          emitted = {
            verdict: asVerdict(args.status),
            rationale: sanitizeLinks(String(args.verdict || "").trim(), urlAllow),
            drivers: [],
            date,
            degraded: false,
          };
          messages.push({ role: "tool", tool_call_id: c.id, content: "ok" });
        } else if (name === "search_news") {
          const arts = await searchTierANews(String(args.query || subject));
          arts.forEach((a) => urlAllow.add(a.url));
          messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify({ results: arts }) });
        } else if (name === "search_prediction_markets") {
          let markets: Array<{ question: string; yes: number | null; volume: number | null }> = [];
          try {
            markets = (await searchMarkets(String(args.query || subject), 6)).map((m) => ({ question: m.question, yes: m.yes, volume: m.volume }));
          } catch {}
          messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify({ markets }) });
        } else {
          messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify({ error: "unknown tool" }) });
        }
      }
      if (emitted) return emitted;
    }
    return null;
  };

  for (const model of models) {
    const out = await runWithModel(model);
    if (out) return out;
  }
  return degraded("Couldn't complete today's research — no verdict available right now.");
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as AnalyzeInput;
  return NextResponse.json(await analyzeThesis(body));
}
