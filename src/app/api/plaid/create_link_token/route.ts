import { NextResponse } from "next/server";
import { Products, CountryCode } from "plaid";
import { plaidClient, plaidConfigured, plaidError } from "@/lib/plaid";

export const runtime = "nodejs";

export async function POST() {
  if (!plaidConfigured) {
    return NextResponse.json(
      { error: "Plaid not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to .env.local and restart." },
      { status: 501 },
    );
  }
  try {
    const client = plaidClient();
    const r = await client.linkTokenCreate({
      user: { client_user_id: "thesis-local-user" },
      client_name: "Thesis",
      products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return NextResponse.json({ link_token: r.data.link_token });
  } catch (e) {
    return NextResponse.json({ error: plaidError(e) }, { status: 502 });
  }
}
