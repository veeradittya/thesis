import { NextResponse } from "next/server";
import { syncHoldings } from "@/lib/turso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { userId, holdings:[{ticker,name?,weight?,thesis?}] } → replaces that user's holdings in
// Turso, which is the source the scheduled CMA agent reads each pass. Called when the ledger
// changes so the agent always analyzes the current portfolio.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      userId?: string;
      holdings?: Array<{ ticker: string; name?: string | null; weight?: number | null; thesis?: string | null }>;
    };
    const userId = (body.userId || "").trim();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const count = await syncHoldings(userId, Array.isArray(body.holdings) ? body.holdings : []);
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "sync failed" }, { status: 502 });
  }
}
