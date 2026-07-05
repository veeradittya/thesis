import { getAllMacroVolumes } from "@/lib/macroFeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Total traded volume (USD) per current macro event, for the Macro Signals list card. REST-sourced
// + price-fingerprinted; only events with a live dist resolve. Oddpool key stays server-side.
export async function GET() {
  if (!process.env.ODDPOOL_API_KEY) return new Response("ODDPOOL_API_KEY not set", { status: 500 });
  try {
    return Response.json({ volumes: await getAllMacroVolumes() });
  } catch (e) {
    return Response.json({ volumes: {}, error: e instanceof Error ? e.message : "failed" });
  }
}
