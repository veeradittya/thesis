import { searchEventsFull, searchMarketsFull, type SearchParams } from "@/lib/oddpool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Search events/markets across venues. Oddpool key stays server-side.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const mode = sp.get("mode") === "markets" ? "markets" : "events";
  const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);
  const params: SearchParams = {
    q: sp.get("q") || undefined,
    exchange: sp.get("exchange") || undefined,
    status: sp.get("status") || undefined,
    category: sp.get("category") || undefined,
    minVolume: num("min_volume"),
    minLiquidity: num("min_liquidity"),
    sortBy: sp.get("sort_by") || undefined,
    limit: num("limit"),
    offset: num("offset"),
  };
  try {
    const results = mode === "markets" ? await searchMarketsFull(params) : await searchEventsFull(params);
    return Response.json({ mode, results });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "search failed" }, { status: 502 });
  }
}
