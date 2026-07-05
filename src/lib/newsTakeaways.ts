// Server-side "takeaway protocol": one concise, factual, ≤16-word takeaway per Guardian
// feed item via Claude Haiku (Dartmouth gateway, tool-calling). Non-live items summarize the
// article body; rolling live blogs summarize their last SUBSTANTIVE update (not the headline).

import { getArticle, getLiveUpdates, isLiveBlog, type NewsItem, type LiveUpdate } from "@/lib/guardian";

const MODEL = "anthropic.claude-haiku-4-5-20251001";

const SYSTEM = [
  "You write concise news takeaways.",
  "You are given a set of news articles (each with an id, headline, and text).",
  "Call the emit_takeaways tool exactly once, with ONE entry per article, echoing each id exactly.",
  "Rules per entry:",
  "- takeaway: a single concise, headline-style line of AT MOST 16 words, ending with a period.",
  "- Preserve the article's specific angle as signaled by its HEADLINE. If the headline emphasizes a reaction, condemnation, outcry, ruling, deal, or other new development, the takeaway must capture THAT specific angle — not merely the underlying background event readers already know.",
  "- Capture the single most important fact (the lede).",
  "- Strictly factual: use ONLY facts in the article. Do not invent, exaggerate, editorialize, or hedge. No meta phrases ('this article…'). No 'reportedly/could/may' unless the article itself hedges.",
].join("\n");

const LIVE_SYSTEM = [
  "You summarize the latest update from rolling news live blogs.",
  "You are given items, each with an id, the live blog's topic, and the text of its most recent substantive update.",
  "Call the emit_takeaways tool exactly once, with ONE entry per id, echoing each id exactly.",
  "Rules per entry:",
  "- takeaway: summarize THAT UPDATE (the new development it reports), not the blog's overall topic, in a single headline-style line of AT MOST 16 words, ending with a period.",
  "- Strictly factual: use ONLY facts in the update text. Do not invent, exaggerate, editorialize, or hedge. No meta phrases ('this update…', 'the live blog…').",
].join("\n");

const TOOLS = [
  {
    type: "function",
    function: {
      name: "emit_takeaways",
      description: "Return one concise takeaway for every item, in order.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "the id exactly as given, e.g. a1" },
                takeaway: { type: "string", description: "headline-style, <=16 words, ends with a period" },
              },
              required: ["id", "takeaway"],
            },
          },
        },
        required: ["items"],
      },
    },
  },
];

interface Prepared {
  k: string;
  id: string;
  block: string;
}

// One Haiku batch → map of real id → takeaway. Returns {} on any failure.
async function runBatch(prepared: Prepared[], system: string): Promise<Record<string, string>> {
  const base = process.env.DARTMOUTH_GATEWAY_BASE;
  const token = process.env.DARTMOUTH_API_KEY;
  const map: Record<string, string> = {};
  if (!base || !token || !prepared.length) return map;

  const user = `Articles:\n\n${prepared.map((p) => p.block).join("\n\n---\n\n")}`;
  try {
    const res = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        tools: TOOLS,
        tool_choice: { type: "function", function: { name: "emit_takeaways" } },
        temperature: 0.2,
        max_tokens: 2500,
      }),
    });
    const args = (await res.json())?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (args) {
      const byKey = new Map<string, string>();
      for (const e of JSON.parse(args).items || []) if (e.id && e.takeaway) byKey.set(e.id, e.takeaway);
      for (const p of prepared) {
        const tw = byKey.get(p.k);
        if (tw) map[p.id] = tw;
      }
    }
  } catch {
    /* gateway error → empty map; card falls back to headlines */
  }
  return map;
}

// ─── Non-live articles → takeaway from the article body. Memoized PER article-id (a fixed
// takeaway per article), so a churning feed only sends genuinely-NEW articles to the LLM — never
// the whole set again. This is the main token-cost control. ──
const takeCache = new Map<string, { at: number; tk: string }>();
const TTL = 30 * 60 * 1000;

export async function getTakeaways(items: NewsItem[]): Promise<Record<string, string>> {
  const targets = items.filter((it) => !isLiveBlog(it.title));
  const now = Date.now();
  for (const [id, v] of takeCache) if (now - v.at > TTL) takeCache.delete(id); // evict stale

  // Only the articles we haven't already summarized go to the LLM.
  const misses = targets.filter((it) => !takeCache.has(it.id));
  if (misses.length) {
    const prepared = await Promise.all(
      misses.map(async (it, i) => {
        let content = it.trailText || "";
        try {
          const a = await getArticle(it.id);
          if (a.paragraphs?.length) content = a.paragraphs.join("\n\n");
        } catch {
          /* fall back to trailText */
        }
        if (!content) content = it.trailText || it.title;
        const k = `a${i + 1}`;
        return { k, id: it.id, block: `id: ${k}\nHeadline: ${it.title}\nFull text: ${content.slice(0, 3500)}` };
      }),
    );
    const map = await runBatch(prepared, SYSTEM);
    for (const it of misses) if (map[it.id]) takeCache.set(it.id, { at: now, tk: map[it.id] });
  }

  const out: Record<string, string> = {};
  for (const it of targets) { const v = takeCache.get(it.id); if (v) out[it.id] = v.tk; }
  return out;
}

// ─── Rolling live blogs → each exploded into its latest few updates, each Haiku-summarized.
// Memoized PER update block id (an update's text is fixed once posted), so a blog posting a new
// update only sends THAT update to the LLM — not all of the blog's recent updates every time.
const liveTakeCache = new Map<string, { at: number; tk: string }>();
const LIVE_TTL = 30 * 60 * 1000;
const UPDATES_PER_BLOG = 3;

// Distinct, readable fallback when the LLM takeaway is unavailable: the update's own first
// sentence — so a blog's exploded rows never collapse into one identical headline.
function snippet(text: string, maxWords = 18): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentence = clean.match(/^.{24,}?[.!?](?=\s|$)/)?.[0] || clean;
  const words = sentence.split(" ");
  return words.length > maxWords ? words.slice(0, maxWords).join(" ").replace(/[,;:]$/, "") + "…" : sentence;
}

export async function getLiveItems(live: NewsItem[]): Promise<NewsItem[]> {
  if (!live.length) return [];

  const perBlog = await Promise.all(
    live.map(async (blog) => ({ blog, updates: await getLiveUpdates(blog.id, UPDATES_PER_BLOG).catch(() => [] as LiveUpdate[]) })),
  );
  const flat: Array<{ blog: NewsItem; u: LiveUpdate }> = [];
  for (const { blog, updates } of perBlog) for (const u of updates) flat.push({ blog, u });
  if (!flat.length) return [];

  const now = Date.now();
  for (const [id, v] of liveTakeCache) if (now - v.at > LIVE_TTL) liveTakeCache.delete(id); // evict stale

  // Only updates we haven't summarized yet go to the LLM (memoized per update block id).
  const misses = flat.filter((x) => !liveTakeCache.has(`${x.blog.id}#${x.u.blockId}`));
  if (misses.length) {
    const prepared = misses.map((x, i) => ({
      k: `a${i + 1}`,
      id: `${x.blog.id}#${x.u.blockId}`,
      block: `id: a${i + 1}\nLive blog: ${x.blog.title}\nUpdate: ${x.u.text.slice(0, 2500)}`,
    }));
    const map = await runBatch(prepared, LIVE_SYSTEM);
    for (const x of misses) {
      const id = `${x.blog.id}#${x.u.blockId}`;
      if (map[id]) liveTakeCache.set(id, { at: now, tk: map[id] });
    }
  }

  return flat.map((x) => {
    const id = `${x.blog.id}#${x.u.blockId}`; // composite: parent blog id + update block id (unique per update)
    return {
      id,
      title: x.blog.title, // keeps the "– live" suffix so the card shows the LIVE chip
      trailText: null,
      section: x.blog.section,
      url: `${x.blog.url}#block-${x.u.blockId}`,
      published: x.u.published || x.blog.published,
      byline: x.blog.byline, // client currentAuthor() extracts the "(now)" author
      image: x.u.image || null, // this update's OWN image, else null → card shows the Guardian logo
      imageAlt: null,
      takeaway: liveTakeCache.get(id)?.tk || snippet(x.u.text), // memoized LLM takeaway, else the update's own first sentence
    };
  });
}
