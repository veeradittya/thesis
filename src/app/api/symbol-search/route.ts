import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface FinnhubMatch {
  symbol?: string;
  displaySymbol?: string;
  description?: string;
  type?: string;
}

export async function GET(req: Request) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return NextResponse.json({ error: "FINNHUB_API_KEY not set." }, { status: 501 });

  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const res = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${key}`);
    if (!res.ok) return NextResponse.json({ error: `Finnhub ${res.status}` }, { status: 502 });
    const data: { result?: FinnhubMatch[] } = await res.json();

    const seen = new Set<string>();
    const results = (data.result || [])
      // keep clean, primarily US-listed equities/ETFs (skip foreign-suffixed symbols)
      .filter((r) => r.symbol && r.description && !r.symbol.includes(".") && r.symbol.length <= 6)
      .filter((r) => {
        const s = (r.displaySymbol || r.symbol)!.toUpperCase();
        if (seen.has(s)) return false;
        seen.add(s);
        return true;
      })
      .slice(0, 6)
      .map((r) => ({
        symbol: (r.displaySymbol || r.symbol)!.toUpperCase(),
        description: r.description,
        type: r.type || "",
      }));

    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Search failed." }, { status: 502 });
  }
}
