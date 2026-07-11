import { NextResponse } from "next/server";
import { getNews } from "@/lib/news";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET ?tickers=NVDA,AAPL → { articles } — thin wrapper over src/lib/news.ts (the fetch/merge
// logic now lives there so /api/analyze can reuse it without an HTTP self-call).
export async function GET(req: Request) {
  const tickers = (new URL(req.url).searchParams.get("tickers") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 8);
  if (!tickers.length) return NextResponse.json({ articles: [] });
  return NextResponse.json({ articles: await getNews(tickers) });
}
