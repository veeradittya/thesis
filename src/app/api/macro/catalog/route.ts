import { getMacroCatalog } from "@/lib/macroFeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Full upcoming macro catalog (all streamable events) for the "Add Signal" picker.
export async function GET() {
  if (!process.env.ODDPOOL_API_KEY) return new Response("ODDPOOL_API_KEY not set", { status: 500 });
  try {
    return Response.json({ events: await getMacroCatalog() });
  } catch (e) {
    return Response.json({ events: [], error: e instanceof Error ? e.message : "failed" }, { status: 502 });
  }
}
