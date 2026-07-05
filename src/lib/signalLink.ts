import { getArticle } from "@/lib/guardian";
import { searchEventsFull, searchMarketsFull, type EventResult, type MarketResult } from "@/lib/oddpool";

// Link a news article to relevant prediction markets — a staged, precision-first,
// propose-then-verify pipeline (see the deep-research synthesis):
//   1. LLM extracts the article's linkable core + diverse keyword queries.
//   2. Deterministic retrieval across queries (events + markets) → RRF fuse + dedup.
//   3. LLM judges each candidate ("would this news move this market?") with a strict
//      rubric; keeps only genuine links (relevance 3) with a grounded one-line reason.
// Returns nothing when no candidate is a real match — the correct curation-first outcome.

const GATEWAY_BASE = process.env.DARTMOUTH_GATEWAY_BASE || "https://chat.dartmouth.edu/api";
const GATEWAY_MODEL = process.env.DARTMOUTH_MODEL || "anthropic.claude-sonnet-4-5-20250929";

export interface NewsArticle {
  id: string;
  title: string;
  trailText?: string | null;
  takeaway?: string | null;
  section?: string | null;
  published?: string | null;
}
export interface Signal {
  kind: "event" | "market";
  linkage: string;
  event?: EventResult;
  market?: MarketResult;
}
export interface SignalResult {
  signals: Signal[];
  coreEvent?: string;
  error?: string;
}

// ── LLM helper (Dartmouth gateway, OpenAI-compatible, non-streamed) ──
async function llmText(system: string, user: string, maxTokens: number): Promise<string> {
  const key = process.env.DARTMOUTH_API_KEY;
  if (!key) throw new Error("No DARTMOUTH_API_KEY set");
  const res = await fetch(`${GATEWAY_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    cache: "no-store",
    body: JSON.stringify({
      model: GATEWAY_MODEL,
      max_tokens: maxTokens,
      temperature: 0, // reproducible judgments
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`gateway ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const d = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return d.choices?.[0]?.message?.content || "";
}

// Models sometimes wrap JSON in prose/fences — extract the first {...} block.
function parseLooseJSON(s: string): unknown {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : s;
  const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no JSON object in model output");
  return JSON.parse(raw.slice(a, b + 1));
}

// Salvage signal objects from a possibly-truncated judge response (recovers every
// complete {…} object even if the array was cut off at max_tokens).
function salvageSignals(s: string): Array<{ n?: number; relevance?: number; keep?: boolean; linkage?: string }> {
  const out: Array<{ n?: number; relevance?: number; keep?: boolean; linkage?: string }> = [];
  for (const m of s.matchAll(/\{[^{}]*?"n"\s*:\s*\d+[^{}]*?\}/g)) {
    try { out.push(JSON.parse(m[0])); } catch {}
  }
  return out;
}

// ── Stage 1: extract the linkable core + diverse keyword queries ──
const EXTRACT_SYSTEM = `You extract the linkable core of a news article for matching against prediction markets (Kalshi/Polymarket-style YES/NO markets that resolve on a FUTURE date).

Output ONLY a JSON object:
{
  "coreEvent": "1-2 sentence factual summary of the NEW event this article reports (not opinion/background)",
  "entities": ["key people, orgs, places, tickers — include common aliases"],
  "temporalScope": "the relevant time horizon (e.g. 'by end of 2026', 'next Fed meeting') or 'none'",
  "futureQuestions": ["2-4 future-resolvable YES/NO questions this news bears on — what a prediction market about this would ask"],
  "queries": ["exactly 3 diverse SHORT keyword search queries, 2-5 words each, to find related prediction markets — one entity-focused, one event/outcome-focused, one broader-topic; plain keywords only, no punctuation"]
}
Prediction markets are about the FUTURE: the implied future-resolvable questions, not surface keywords, are the real link target. If the piece is pure opinion/retrospective with no future angle, still fill entities but keep futureQuestions/queries minimal. Output JSON only, no prose.`;

interface Core {
  coreEvent: string;
  entities: string[];
  temporalScope: string;
  futureQuestions: string[];
  queries: string[];
}

// ── Stage 2: precision relevance judge ──
const JUDGE_SYSTEM = `You are a precision relevance judge linking a news event to prediction markets. You get the news core and a numbered list of candidate markets/events found by keyword search. MOST candidates are FALSE POSITIVES that merely share a keyword or topic.

For each candidate ask: would THIS specific news event plausibly MOVE this market's probability, or is the market's outcome genuinely informative about this event? Require a real entity + causal/temporal link — not mere topical overlap.

Reason step by step internally, then output ONLY JSON:
{ "signals": [ { "n": <candidate number>, "relevance": <0-3>, "keep": <true|false>, "linkage": "one grounded sentence (<=110 chars) on WHY this market is moved by / informative about the news; no hype, no invented facts" } ] }

Scoring: 3 = the news directly bears on this market's resolution (clear entity + causal/temporal link); 2 = related but indirect; 1 = same topic only; 0 = coincidental keyword match.
Only include an entry for candidates scoring relevance >= 2; OMIT the coincidental 0/1 matches entirely (keeps the output short).
Set keep=true ONLY for relevance 3. Be strict — it is CORRECT to output an empty list if no candidate is a genuine match. Never force weak links. Output JSON only.`;

const RRF_K = 60;
const PER_QUERY = 6;
const MAX_CANDIDATES = 18;

type Candidate = { kind: "event" | "market"; id: string; event?: EventResult; market?: MarketResult; rrf: number };

async function retrieve(queries: string[], onLog?: LogFn): Promise<Candidate[]> {
  const byId = new Map<string, Candidate>();
  for (const q of queries.slice(0, 3)) {
    const query = (q || "").trim();
    if (!query) continue;
    let events: EventResult[] = [], markets: MarketResult[] = [];
    try { events = await searchEventsFull({ q: query, status: "active", limit: PER_QUERY }); } catch {}
    try { markets = await searchMarketsFull({ q: query, status: "active", limit: PER_QUERY }); } catch {}
    onLog?.(`  "${query}" → ${events.length} events, ${markets.length} markets`);
    events.forEach((e, i) => {
      const key = `e:${e.event_id}`;
      const cur = byId.get(key) || { kind: "event" as const, id: e.event_id, event: e, rrf: 0 };
      cur.rrf += 1 / (RRF_K + i);
      byId.set(key, cur);
    });
    markets.forEach((m, i) => {
      const key = `m:${m.market_id}`;
      const cur = byId.get(key) || { kind: "market" as const, id: m.market_id, market: m, rrf: 0 };
      cur.rrf += 1 / (RRF_K + i);
      byId.set(key, cur);
    });
  }
  return [...byId.values()].sort((a, b) => b.rrf - a.rrf).slice(0, MAX_CANDIDATES);
}

const pct = (x: number | null | undefined) => (x == null ? "?" : `${Math.round(x * 100)}%`);
const usd = (v: number | null | undefined) => (v == null ? "?" : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`);

function candidateLine(c: Candidate, n: number): string {
  if (c.kind === "market" && c.market) {
    const m = c.market;
    return `${n}. [MARKET · ${m.exchange}] ${m.question} (YES ${pct(m.yes)}, vol ${usd(m.volume)})`;
  }
  const e = c.event!;
  return `${n}. [EVENT · ${e.exchange}] ${e.title} (${e.category || "—"}, ${e.marketCount ?? "?"} markets, vol ${usd(e.totalVolume)})`;
}

// In-memory cache so re-linking the same article within a server session is free.
const cache = new Map<string, { at: number; data: SignalResult }>();
const CACHE_TTL = 30 * 60 * 1000;

export type LogFn = (line: string) => void;

export async function linkNewsToSignals(article: NewsArticle, onLog?: LogFn): Promise<SignalResult> {
  const cacheKey = article.id;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL) { onLog?.("loaded from recent cache"); return hit.data; }

  const out = await runPipeline(article, onLog);
  cache.set(cacheKey, { at: Date.now(), data: out });
  return out;
}

async function runPipeline(article: NewsArticle, onLog?: LogFn): Promise<SignalResult> {
  // Full article body (best-effort) → compact article text.
  onLog?.("fetching article…");
  let body = "";
  try {
    const a = await getArticle(article.id.split("#")[0]);
    body = (a.paragraphs || []).join("\n").slice(0, 5000);
    onLog?.(`read ${a.paragraphs?.length || 0} paragraphs from source`);
  } catch {
    onLog?.("no full body — using headline + standfirst");
  }
  const articleText = [
    `HEADLINE: ${article.title}`,
    article.trailText ? `STANDFIRST: ${article.trailText}` : "",
    article.takeaway ? `TAKEAWAY: ${article.takeaway}` : "",
    article.section ? `SECTION: ${article.section}` : "",
    article.published ? `PUBLISHED: ${article.published}` : "",
    body ? `\nBODY:\n${body}` : "",
  ].filter(Boolean).join("\n");

  // Stage 1 — extract the linkable core + queries
  onLog?.("analyzing the story with claude-sonnet-4.5…");
  let core: Core;
  try {
    core = parseLooseJSON(await llmText(EXTRACT_SYSTEM, articleText, 800)) as Core;
  } catch (e) {
    onLog?.("extraction failed");
    return { signals: [], error: e instanceof Error ? e.message : "extract failed" };
  }
  if (core.coreEvent) onLog?.(`core event: ${core.coreEvent.slice(0, 72)}${core.coreEvent.length > 72 ? "…" : ""}`);
  const queries = Array.isArray(core.queries) ? core.queries : [];
  if (!queries.length) { onLog?.("no market-relevant angle in this story"); return { signals: [], coreEvent: core.coreEvent }; }
  onLog?.(`generated queries → ${queries.slice(0, 3).map((q) => `"${q}"`).join("  ")}`);

  // Stage 2 — retrieve + RRF fuse
  onLog?.("searching kalshi + polymarket…");
  const candidates = await retrieve(queries, onLog);
  if (!candidates.length) { onLog?.("no candidate markets found"); return { signals: [], coreEvent: core.coreEvent }; }
  onLog?.(`fused → ${candidates.length} unique candidate markets`);

  // Stage 3 judge
  const judgeUser = [
    `NEWS CORE: ${core.coreEvent}`,
    core.temporalScope && core.temporalScope !== "none" ? `TIME HORIZON: ${core.temporalScope}` : "",
    core.entities?.length ? `ENTITIES: ${core.entities.join(", ")}` : "",
    "",
    "CANDIDATE MARKETS/EVENTS:",
    ...candidates.map((c, i) => candidateLine(c, i + 1)),
  ].filter(Boolean).join("\n");

  onLog?.(`judging relevance across ${candidates.length} candidates…`);
  let judged: { signals?: Array<{ n?: number; relevance?: number; keep?: boolean; linkage?: string }> };
  try {
    const raw = await llmText(JUDGE_SYSTEM, judgeUser, 1600);
    try { judged = parseLooseJSON(raw) as typeof judged; }
    catch { judged = { signals: salvageSignals(raw) }; } // recover from a truncated array
  } catch (e) {
    onLog?.("relevance judge failed");
    return { signals: [], coreEvent: core.coreEvent, error: e instanceof Error ? e.message : "judge failed" };
  }

  const signals: Signal[] = [];
  for (const s of judged.signals || []) {
    if (!s.keep || (s.relevance ?? 0) < 3 || !s.n) continue;
    const c = candidates[s.n - 1];
    if (!c) continue;
    signals.push({
      kind: c.kind,
      linkage: (s.linkage || "").trim().slice(0, 140),
      event: c.event,
      market: c.market,
    });
  }
  onLog?.(signals.length ? `curated → ${signals.length} signal${signals.length === 1 ? "" : "s"}` : "no genuine matches — 0 signals");
  return { signals, coreEvent: core.coreEvent };
}
