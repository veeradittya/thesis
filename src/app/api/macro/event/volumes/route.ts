import { getMacroEventVolumes } from "@/lib/macroFeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-outcome traded volume (USD) for a macro event — REST-sourced, matched to the live feed
// outcomes by strike via price-fingerprint. Returns {} when it can't confidently resolve the
// venue event (better no volume than wrong volume). Oddpool key stays server-side.
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return new Response("missing key", { status: 400 });
  if (!process.env.ODDPOOL_API_KEY) return new Response("ODDPOOL_API_KEY not set", { status: 500 });
  try {
    return Response.json({ volumes: await getMacroEventVolumes(key) });
  } catch (e) {
    return Response.json({ volumes: {}, error: e instanceof Error ? e.message : "failed" });
  }
}
