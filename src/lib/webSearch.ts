// Pluggable live-web search for the analysis model's `search_web` tool, restricted to Tier-A
// outlets. Backend is chosen by which key exists: TAVILY_API_KEY → Tavily (time_range + domain
// allowlist), else EXA_API_KEY → Exa (date bounds + includeDomains + inline content), else the
// keyless Guardian+NYT searcher. Adding a key upgrades the model to whole-web Tier-A search with
// no code change.

import { searchTierANews } from "@/lib/tierANews";

export interface WebResult {
  title: string;
  url: string;
  source: string; // hostname, e.g. "reuters.com"
  published: string | null;
  snippet: string;
}

// Tier-A reliability allowlist — primary wires, papers of record, and the SEC.
const TIER_A = [
  "reuters.com",
  "apnews.com",
  "bloomberg.com",
  "wsj.com",
  "ft.com",
  "economist.com",
  "cnbc.com",
  "nytimes.com",
  "theguardian.com",
  "barrons.com",
  "sec.gov",
];

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

async function tavily(query: string, days: number, key: string): Promise<WebResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      topic: "general",
      time_range: days <= 1 ? "day" : days <= 7 ? "week" : "month",
      include_domains: TIER_A,
      max_results: 8,
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const j = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }> };
  return (j.results || [])
    .filter((r) => r.title && r.url)
    .map((r) => ({ title: r.title!, url: r.url!, source: host(r.url!), published: r.published_date || null, snippet: (r.content || "").slice(0, 500) }));
}

async function exa(query: string, days: number, key: string): Promise<WebResult[]> {
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults: 8,
      includeDomains: TIER_A,
      startPublishedDate: new Date(Date.now() - days * 864e5).toISOString(),
      contents: { text: { maxCharacters: 800 } },
    }),
  });
  if (!res.ok) throw new Error(`Exa ${res.status}`);
  const j = (await res.json()) as { results?: Array<{ title?: string; url?: string; publishedDate?: string; text?: string }> };
  return (j.results || [])
    .filter((r) => r.title && r.url)
    .map((r) => ({ title: r.title!, url: r.url!, source: host(r.url!), published: r.publishedDate || null, snippet: (r.text || "").slice(0, 500) }));
}

// Search the live web, Tier-A only. `days` bounds recency (1 = last ~24h).
export async function webSearch(query: string, days = 1): Promise<{ backend: string; results: WebResult[] }> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  const exaKey = process.env.EXA_API_KEY;
  if (tavilyKey) {
    try {
      return { backend: "tavily", results: await tavily(query, days, tavilyKey) };
    } catch {}
  }
  if (exaKey) {
    try {
      return { backend: "exa", results: await exa(query, days, exaKey) };
    } catch {}
  }
  // Keyless fallback — Guardian + NYT (still Tier-A, narrower reach).
  const arts = await searchTierANews(query, Math.max(2, days));
  return {
    backend: "guardian+nyt",
    results: arts.map((a) => ({ title: a.headline, url: a.url, source: host(a.url), published: a.published || null, snippet: a.snippet })),
  };
}
