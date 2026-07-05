import { getEventDetail } from "@/lib/oddpool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Event detail: outcomes + odds + multi-outcome chart. Oddpool key stays server-side.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const id = sp.get("id");
  const exchange = sp.get("exchange") || "kalshi";
  const range = sp.get("range") || undefined;
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });
  try {
    return Response.json(await getEventDetail(id, exchange, range));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "event detail failed" }, { status: 502 });
  }
}
