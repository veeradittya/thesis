import { NextResponse } from "next/server";
import type { Verdict, BeliefState, AnalysisDriver } from "@/lib/thesis";
import { webSearch } from "@/lib/webSearch";
import { recentFilings } from "@/lib/edgar";
import { searchMarkets } from "@/lib/oddpool";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby cap; the tool loop usually finishes well under
export const dynamic = "force-dynamic";

// Prior belief state from the last run — the model UPDATES this instead of re-deriving.
export interface AnalyzePrior {
  date: string;
  verdict: Verdict;
  rationale: string;
  beliefState?: BeliefState;
}
export interface AnalyzeInput {
  ticker: string;
  name?: string;
  thesisText?: string;
  horizon?: string | null;
  prior?: AnalyzePrior;
}
export interface AnalyzeResult {
  verdict: Verdict;
  rationale: string; // crisp plain-text prose; facts hyperlinked as markdown [text](url)
  beliefState: BeliefState | null;
  drivers: AnalysisDriver[]; // legacy field, kept empty (facts are hyperlinked inline)
  date: string; // NY calendar day, stamped server-side so every client agrees
  degraded: boolean;
}

function todayNY(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

const SYSTEM = [
  "You are a disciplined equity analyst re-underwriting an investor's thesis TODAY. Your job is to judge whether the thesis is still valid in light of the latest data — news, regulatory filings, market signals.",
  "Research it yourself with the tools. Use focused queries; search more than once if needed. Check filings when fundamentals could have moved. Call search_prediction_markets ONLY when a live market-implied probability would materially sharpen the judgment.",
  "",
  "If a PRIOR ASSESSMENT is provided: it is your own previous work. Do NOT re-derive or restate it. Research what is NEW since its date, then update the belief state — adjust pillar statuses and confidence only where new evidence warrants, and carry forward what hasn't changed. Your verdict prose must contain ONLY new developments and what they change; if nothing material happened, say so in one short sentence.",
  "If NO prior is provided: distill the thesis into 2-4 load-bearing pillars, research each briefly, and establish the first belief state.",
  "",
  "Then call emit_verdict exactly once:",
  "- status: 'holds_up' (no pillar worse than intact/shaky-but-known — the DEFAULT), 'weakening' (a load-bearing pillar newly turned shaky), 'at_risk' (a pillar broke: evidence directly contradicts something the thesis depends on).",
  "- verdict: crisp plain prose, at most ~50 words. HYPERLINK every factual claim to its source with markdown [claim text](https://url), using ONLY URLs returned by your tools. No ticker symbols or cashtags, no bullet points, no hedging filler, and never describe your research process — state conclusions only.",
  "- belief_state: confidence 0-100, the pillars with statuses, and what to watch next. Keep pillar claims short and stable across days so updates are comparable.",
  "Use only facts you retrieved. Never invent a source or a URL.",
].join("\n");

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_web",
      description:
        "Search the live web, restricted to Tier-A outlets (Reuters, AP, Bloomberg, WSJ, FT, Economist, CNBC, NYT, Guardian, Barron's, SEC). Use focused queries. recency='day' for the last ~24h (updates), 'week' to establish a new baseline.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          recency: { type: "string", enum: ["day", "week"] },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_filings",
      description: "The company's material SEC filings (8-K, 10-Q/K, 13D/G, S-1…) from the last two weeks, newest first, with links. Free primary source — use it when fundamentals, guidance, ownership, or deals could have moved.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_prediction_markets",
      description: "Live prediction-market odds (Kalshi/Polymarket). Use only when a market-implied probability would sharpen the judgment.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "emit_verdict",
      description: "Deliver today's assessment.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["holds_up", "weakening", "at_risk"] },
          verdict: { type: "string", description: "plain prose, <=50 words, only NEW information, facts hyperlinked as markdown [text](url)" },
          belief_state: {
            type: "object",
            properties: {
              confidence: { type: "number", description: "0-100" },
              pillars: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    claim: { type: "string" },
                    status: { type: "string", enum: ["intact", "shaky", "broken"] },
                  },
                  required: ["claim", "status"],
                },
              },
              watching: { type: "array", items: { type: "string" } },
            },
            required: ["confidence", "pillars"],
          },
        },
        required: ["status", "verdict", "belief_state"],
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

// Keep only markdown links whose URL actually came back from a tool (no fabricated sources);
// downgrade any other [text](url) to plain "text".
function sanitizeLinks(md: string, allow: Set<string>): string {
  const norm = (u: string) => u.split("#")[0].split("?")[0].replace(/\/$/, "");
  const allowNorm = new Set([...allow].map(norm));
  return (md || "").replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, text: string, url: string) =>
    allowNorm.has(norm(url)) ? `[${text}](${url})` : text,
  );
}

const asVerdict = (s: unknown): Verdict => (s === "weakening" || s === "at_risk" ? s : "holds_up");

interface RawBelief {
  confidence?: number;
  pillars?: Array<{ claim?: string; status?: string }>;
  watching?: string[];
}
function cleanBelief(b: RawBelief | undefined): BeliefState | null {
  if (!b || !Array.isArray(b.pillars)) return null;
  const pillars = b.pillars
    .filter((p) => p?.claim)
    .slice(0, 6)
    .map((p) => ({
      claim: String(p.claim).slice(0, 160),
      status: (p.status === "shaky" || p.status === "broken" ? p.status : "intact") as "intact" | "shaky" | "broken",
    }));
  if (!pillars.length) return null;
  return {
    confidence: Math.max(0, Math.min(100, Math.round(Number(b.confidence ?? 50)))),
    pillars,
    watching: (Array.isArray(b.watching) ? b.watching : []).filter(Boolean).slice(0, 5).map((w) => String(w).slice(0, 120)),
  };
}

function priorBlock(p: AnalyzePrior): string {
  const bs = p.beliefState;
  const pillars = bs?.pillars.map((x, i) => `  ${i + 1}. [${x.status}] ${x.claim}`).join("\n") || "  (none recorded)";
  return [
    `PRIOR ASSESSMENT (${p.date}) — your own previous work; update it, do not repeat it:`,
    `Status: ${p.verdict}${bs ? ` · confidence ${bs.confidence}/100` : ""}`,
    `Pillars:\n${pillars}`,
    bs?.watching?.length ? `Watching: ${bs.watching.join("; ")}` : "",
    `Previous verdict text: "${p.rationale}"`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Pure analysis of one thesis — the model researches the live web + filings itself and updates
// its prior belief state. Reused by the on-open route (and, phase 2, a cron worker).
export async function analyzeThesis(input: AnalyzeInput): Promise<AnalyzeResult> {
  const ticker = (input.ticker || "").trim().toUpperCase();
  const subject = (input.name || ticker).trim();
  const date = todayNY();
  const degraded = (rationale: string): AnalyzeResult => ({
    verdict: input.prior?.verdict ?? "holds_up", // a failed run never flips a prior verdict
    rationale,
    beliefState: input.prior?.beliefState ?? null,
    drivers: [],
    date,
    degraded: true,
  });
  if (!ticker) return degraded("No ticker provided.");

  const base = process.env.DARTMOUTH_GATEWAY_BASE;
  const token = process.env.DARTMOUTH_API_KEY;
  if (!base || !token) return degraded("Analysis engine is not configured.");
  const models = [
    process.env.DARTMOUTH_OPUS_MODEL || "anthropic.claude-opus-4-8",
    process.env.DARTMOUTH_MODEL || "anthropic.claude-sonnet-4-5-20250929",
  ].filter((m, i, a) => a.indexOf(m) === i);

  const user = [
    `Stock: ${subject}${input.name && input.name !== ticker ? ` (ticker ${ticker})` : ""}`,
    `Investor's thesis: ${input.thesisText || "(none stated — the user is simply tracking this stock; make the verdict prose a plain, current status update on what is most notable today, not a thesis judgment)"}`,
    `Horizon: ${input.horizon || "unspecified"}`,
    `Today: ${date}`,
    input.prior ? `\n${priorBlock(input.prior)}` : "",
    input.prior ? `\nResearch what is NEW since ${input.prior.date} and update the assessment.` : "\nEstablish the assessment.",
  ]
    .filter(Boolean)
    .join("\n");

  const runWithModel = async (model: string): Promise<AnalyzeResult | null> => {
    const messages: ChatMsg[] = [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ];
    const urlAllow = new Set<string>();

    for (let step = 0; step < 6; step++) {
      const forceEmit = step === 5;
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
            max_tokens: 1400,
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
      // Prose without emit_verdict → accept it as the verdict, keeping the prior belief state.
      if (!calls.length) {
        if (msg.content?.trim())
          return {
            verdict: input.prior?.verdict ?? "holds_up",
            rationale: sanitizeLinks(msg.content.trim(), urlAllow),
            beliefState: input.prior?.beliefState ?? null,
            drivers: [],
            date,
            degraded: false,
          };
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
            beliefState: cleanBelief(args.belief_state as RawBelief) ?? input.prior?.beliefState ?? null,
            drivers: [],
            date,
            degraded: false,
          };
          messages.push({ role: "tool", tool_call_id: c.id, content: "ok" });
        } else if (name === "search_web") {
          const days = args.recency === "week" ? 7 : 1;
          const { results } = await webSearch(String(args.query || subject), days).catch(() => ({ results: [] }));
          results.forEach((r) => urlAllow.add(r.url));
          messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify({ results }) });
        } else if (name === "get_recent_filings") {
          const filings = await recentFilings(ticker).catch(() => []);
          filings.forEach((f) => urlAllow.add(f.url));
          messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify({ filings }) });
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
  return degraded("Today's update couldn't be completed — we'll try again next time.");
}

// POST { ticker, name?, thesisText?, horizon?, prior? } → AnalyzeResult (always HTTP 200; a
// degraded card beats a broken dashboard). Client fans out one request per thesis, concurrency 3.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as AnalyzeInput;
  return NextResponse.json(await analyzeThesis(body));
}
