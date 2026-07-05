import { NextResponse } from "next/server";
import { getPortfolioMarkets, type HoldingLite } from "@/lib/oddpool";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic"; // always run the handler; 10-min freshness comes from the module cache

// POST { holdings: [{ticker,name,weight}] } → markets grouped by the caller's holdings.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const holdings: HoldingLite[] | undefined = Array.isArray(body?.holdings) ? body.holdings : undefined;
    return NextResponse.json(await getPortfolioMarkets(holdings));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load markets." }, { status: 502 });
  }
}

// GET → the default demo set (no holdings), kept for convenience/back-compat.
export async function GET() {
  try {
    return NextResponse.json(await getPortfolioMarkets());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load markets." }, { status: 502 });
  }
}
