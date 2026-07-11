import { NextResponse } from "next/server";
import { recommend } from "@/lib/recommend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET ?picks=NVDA,AAPL&page=0 → { suggestions:[{symbol,name,sector}] } (7 per page, refreshable).
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const picks = (sp.get("picks") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const page = Math.max(0, parseInt(sp.get("page") || "0", 10) || 0);
  try {
    return NextResponse.json({ suggestions: await recommend(picks, page) });
  } catch (e) {
    return NextResponse.json({ suggestions: [], error: e instanceof Error ? e.message : "Recommend failed." }, { status: 502 });
  }
}
