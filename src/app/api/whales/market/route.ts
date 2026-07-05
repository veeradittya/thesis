import { NextResponse } from "next/server";
import { getMarketWhales } from "@/lib/oddpool";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("market_id");
  const eventTicker = searchParams.get("event_ticker");
  const exchange = searchParams.get("exchange") || "polymarket";
  if (!id || !eventTicker) return NextResponse.json({ error: "market_id and event_ticker required" }, { status: 400 });
  try {
    return NextResponse.json(await getMarketWhales(id, eventTicker, exchange));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load market whales." }, { status: 502 });
  }
}
