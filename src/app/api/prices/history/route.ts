export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Intraday seed for the live chart: the most recent session's 5-min IEX bars from Alpaca (free).
// Keys stay server-side. Live ticks are layered on top by the client via /api/prices (Finnhub WS).
export async function GET(req: Request) {
  try {
    const symbol = (new URL(req.url).searchParams.get("symbol") || "").trim().toUpperCase();
    if (!symbol) return Response.json({ error: "no symbol" }, { status: 400 });
    const id = process.env.ALPACA_API_KEY_ID;
    const sec = process.env.ALPACA_API_SECRET_KEY;
    if (!id || !sec) return Response.json({ error: "Alpaca not configured" }, { status: 500 });

    // Look back a full week so we always reach the last real session across weekends/holidays;
    // limit 2000 keeps the newest bars from being truncated. The filter below trims to that session.
    const start = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const url = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=5Min&start=${start}&feed=iex&limit=2000`;
    const r = await fetch(url, { headers: { "APCA-API-KEY-ID": id, "APCA-API-SECRET-KEY": sec }, cache: "no-store" });
    if (!r.ok) return Response.json({ error: `Alpaca ${r.status}` }, { status: 502 });

    const j = (await r.json()) as { bars?: Array<{ t: string; c: number }> };
    const bars = (j.bars || []).map((b) => ({ t: Date.parse(b.t), c: b.c })).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.c));

    // Keep only the most recent session (bars sharing the last bar's UTC date).
    let points = bars;
    if (bars.length) {
      const lastDay = new Date(bars[bars.length - 1].t).toISOString().slice(0, 10);
      points = bars.filter((p) => new Date(p.t).toISOString().slice(0, 10) === lastDay);
    }
    return Response.json({ symbol, points });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "history failed" }, { status: 500 });
  }
}
