import { NextResponse } from "next/server";
import { getNvdaPrediction } from "@/lib/oddpool";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic"; // compute at runtime (getNvdaPrediction caches internally) — no build-time Oddpool call

export async function GET() {
  try {
    const data = await getNvdaPrediction();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load prediction market." },
      { status: 502 },
    );
  }
}
