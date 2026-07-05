import { NextResponse } from "next/server";
import { plaidClient, plaidConfigured, saveItem, fetchHoldings, plaidError } from "@/lib/plaid";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!plaidConfigured) {
    return NextResponse.json({ error: "Plaid not configured." }, { status: 501 });
  }
  let body: { public_token?: string; institution?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.public_token) {
    return NextResponse.json({ error: "public_token is required." }, { status: 400 });
  }
  const institution = body.institution?.trim() || "Brokerage";
  try {
    const client = plaidClient();
    const ex = await client.itemPublicTokenExchange({ public_token: body.public_token });
    // access_token is a long-lived secret — persist server-side only, never return it.
    await saveItem({ item_id: ex.data.item_id, access_token: ex.data.access_token, institution });
    const holdings = await fetchHoldings(client, ex.data.access_token, institution);
    return NextResponse.json({ holdings, institution });
  } catch (e) {
    return NextResponse.json({ error: plaidError(e) }, { status: 502 });
  }
}
