import { getEventWhales } from "@/lib/oddpool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Event-level whale activity + sentiment. Tracks the event (idempotent) then reads its feed/stats.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const id = sp.get("id");
  const exchange = sp.get("exchange") || "kalshi";
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });
  try {
    return Response.json(await getEventWhales(id, exchange));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "event whale failed" }, { status: 502 });
  }
}
