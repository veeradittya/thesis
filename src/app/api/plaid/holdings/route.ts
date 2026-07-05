import { NextResponse } from "next/server";
import { plaidClient, plaidConfigured, getItem, fetchHoldings, plaidError } from "@/lib/plaid";

export const runtime = "nodejs";

export async function GET() {
  if (!plaidConfigured) {
    return NextResponse.json({ error: "Plaid not configured." }, { status: 501 });
  }
  const item = await getItem();
  if (!item) {
    return NextResponse.json({ error: "No linked brokerage yet." }, { status: 404 });
  }
  try {
    const holdings = await fetchHoldings(plaidClient(), item.access_token, item.institution);
    return NextResponse.json({ holdings, institution: item.institution });
  } catch (e) {
    return NextResponse.json({ error: plaidError(e) }, { status: 502 });
  }
}
