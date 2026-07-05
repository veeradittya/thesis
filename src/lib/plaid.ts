import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { Holding } from "./types";

export const plaidConfigured = !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);

export function plaidClient(): PlaidApi {
  const envName = (process.env.PLAID_ENV || "sandbox").toLowerCase();
  const basePath = (PlaidEnvironments as Record<string, string>)[envName] || PlaidEnvironments.sandbox;
  const configuration = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  });
  return new PlaidApi(configuration);
}

// Server-side token store. No DB yet, so a single gitignored JSON file (single-user prototype).
const STORE = path.join(process.cwd(), ".plaid-store.json");
export interface PlaidItem {
  item_id: string;
  access_token: string;
  institution: string;
}

export async function saveItem(item: PlaidItem): Promise<void> {
  await writeFile(STORE, JSON.stringify(item, null, 2), "utf8");
}

export async function getItem(): Promise<PlaidItem | null> {
  try {
    return JSON.parse(await readFile(STORE, "utf8")) as PlaidItem;
  } catch {
    return null;
  }
}

export async function fetchHoldings(client: PlaidApi, accessToken: string, institution: string): Promise<Holding[]> {
  const r = await client.investmentsHoldingsGet({ access_token: accessToken });
  const secById = new Map(r.data.securities.map((s) => [s.security_id, s]));
  return r.data.holdings
    .map((h) => {
      const s = secById.get(h.security_id);
      const ticker = (s?.ticker_symbol || "").toUpperCase();
      return {
        ticker,
        name: s?.name || ticker || "Unknown",
        quantity: h.quantity,
        value: h.institution_value,
        costBasis: h.cost_basis ?? 0,
        institution,
      } as Holding;
    })
    // keep equities/ETFs; drop cash and long option symbols
    .filter((h) => h.ticker && h.ticker.length > 0 && h.ticker.length <= 6);
}

export function plaidError(e: unknown): string {
  const any = e as { response?: { data?: { error_message?: string; error_code?: string } }; message?: string };
  return any?.response?.data?.error_message || any?.response?.data?.error_code || any?.message || "Plaid request failed";
}
