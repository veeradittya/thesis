import { NextResponse } from "next/server";
import { getWhaleFeed } from "@/lib/oddpool";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    return NextResponse.json(await getWhaleFeed());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load whale feed." }, { status: 502 });
  }
}
