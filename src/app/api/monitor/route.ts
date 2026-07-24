import { NextResponse } from "next/server";
import { getLatestMonitor } from "@/lib/turso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET ?user=<scope> → the latest scheduled-agent run: portfolio risk memo + per-holding verdicts.
// The dashboard reads pre-computed results (instant, no on-open LLM cost); the CMA deployment
// writes them twice a day.
export async function GET(req: Request) {
  const userId = (new URL(req.url).searchParams.get("user") || "guest").trim();
  try {
    return NextResponse.json(await getLatestMonitor(userId));
  } catch (e) {
    return NextResponse.json(
      { runId: null, memo: null, finishedAt: null, results: [], error: e instanceof Error ? e.message : "monitor failed" },
      { status: 502 },
    );
  }
}
