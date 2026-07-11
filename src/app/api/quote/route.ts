import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET ?symbols=NVDA,AAPL → { quotes: { NVDA: {price,prevClose,change,percent}, ... } }.
// REST snapshot (Vercel-safe) — replaces the SSE/websocket price relay for the thesis cards.
export async function GET(req: Request) {
  const symbols = (new URL(req.url).searchParams.get("symbols") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 30);
  if (!symbols.length) return NextResponse.json({ quotes: {} });
  try {
    return NextResponse.json({ quotes: await getQuotes(symbols) });
  } catch (e) {
    return NextResponse.json({ quotes: {}, error: e instanceof Error ? e.message : "Quote failed." }, { status: 502 });
  }
}
