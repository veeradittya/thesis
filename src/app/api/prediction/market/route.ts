import { NextResponse } from "next/server";
import { getMarketDetail } from "@/lib/oddpool";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("market_id");
  const exchange = searchParams.get("exchange") || "polymarket";
  const yesParam = searchParams.get("yes");
  if (!id) return NextResponse.json({ error: "market_id required" }, { status: 400 });
  try {
    const yes = yesParam != null && yesParam !== "" ? parseFloat(yesParam) : null;
    const quote = searchParams.get("quote") === "1";
    const range = searchParams.get("range") || undefined;
    return NextResponse.json(await getMarketDetail(id, exchange, yes, { ohlcv: !quote, range }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load market." }, { status: 502 });
  }
}
