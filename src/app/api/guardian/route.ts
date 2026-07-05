import { getNews, getArticle, isLiveBlog } from "@/lib/guardian";
import { getTakeaways, getLiveItems } from "@/lib/newsTakeaways";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const id = sp.get("id");
    if (id) return Response.json(await getArticle(id));

    const payload = await getNews(sp.get("q") || "");
    if (sp.get("takeaways") === "1") {
      try {
        const items = payload.items;
        // Non-live → Haiku of the article body; live blogs → each recent update as its own row.
        const [takeaways, liveItems] = await Promise.all([getTakeaways(items), getLiveItems(items.filter((it) => isLiveBlog(it.title)))]);
        const nonLive = items.filter((it) => !isLiveBlog(it.title)).map((it) => ({ ...it, takeaway: takeaways[it.id] }));
        const merged = [...nonLive, ...liveItems].sort((a, b) => Date.parse(b.published || "") - Date.parse(a.published || ""));
        // Return a COPY — never mutate payload.items, which is the shared getNews cache object.
        return Response.json({ ...payload, items: merged });
      } catch {
        /* best-effort — fall back to headlines */
      }
    }
    return Response.json(payload);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "News failed." }, { status: 500 });
  }
}
