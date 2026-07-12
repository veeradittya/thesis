// SEC EDGAR — free, keyless primary source for the analysis model's filings tool.
// Ticker → CIK via the public company_tickers.json, then recent filings from the
// data.sec.gov submissions API. SEC requires a descriptive User-Agent with contact info.

const UA = "betathesis.com thesis-monitor (contact: veer.podder2429@gmail.com)";

// Forms that plausibly move a thesis; skips the Form 3/4/5/144 insider-paperwork firehose.
const MATERIAL_FORMS = new Set([
  "8-K", "10-Q", "10-K", "10-K/A", "10-Q/A", "6-K", "20-F",
  "S-1", "S-3", "424B5", "DEF 14A", "DEFA14A",
  "SC 13D", "SC 13D/A", "SC 13G", "SC 13G/A", "13F-HR",
]);

export interface Filing {
  form: string;
  filed: string; // YYYY-MM-DD
  description: string;
  url: string;
}

interface TickerRow {
  cik_str: number;
  ticker: string;
  title: string;
}

let tickerMapP: Promise<Map<string, { cik: string; name: string }>> | null = null;
function tickerMap(): Promise<Map<string, { cik: string; name: string }>> {
  if (!tickerMapP) {
    tickerMapP = (async () => {
      const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
        headers: { "User-Agent": UA },
        next: { revalidate: 86400 },
      });
      if (!res.ok) throw new Error(`EDGAR tickers ${res.status}`);
      const j = (await res.json()) as Record<string, TickerRow>;
      const map = new Map<string, { cik: string; name: string }>();
      for (const row of Object.values(j)) {
        map.set(row.ticker.toUpperCase(), { cik: String(row.cik_str).padStart(10, "0"), name: row.title });
      }
      return map;
    })();
    tickerMapP.catch(() => (tickerMapP = null)); // let a failed load retry next call
  }
  return tickerMapP;
}

// The company's recent MATERIAL filings within `days`, newest first (empty for unknown tickers,
// ETFs, or a quiet window). URLs point at the primary document on sec.gov.
export async function recentFilings(ticker: string, days = 14, limit = 6): Promise<Filing[]> {
  const t = ticker.trim().toUpperCase();
  let entry: { cik: string; name: string } | undefined;
  try {
    entry = (await tickerMap()).get(t);
  } catch {
    return [];
  }
  if (!entry) return [];

  let sub: {
    filings?: { recent?: { form?: string[]; filingDate?: string[]; accessionNumber?: string[]; primaryDocument?: string[]; primaryDocDescription?: string[] } };
  };
  try {
    const res = await fetch(`https://data.sec.gov/submissions/CIK${entry.cik}.json`, {
      headers: { "User-Agent": UA },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    sub = await res.json();
  } catch {
    return [];
  }

  const r = sub.filings?.recent;
  if (!r?.form?.length) return [];
  const cutoff = Date.now() - days * 864e5;
  const cikNum = String(Number(entry.cik)); // archive paths use the unpadded CIK
  const out: Filing[] = [];
  for (let i = 0; i < r.form.length && out.length < limit; i++) {
    const form = r.form[i] || "";
    const filed = r.filingDate?.[i] || "";
    if (!MATERIAL_FORMS.has(form)) continue;
    if (!filed || Date.parse(filed) < cutoff) continue;
    const accession = (r.accessionNumber?.[i] || "").replace(/-/g, "");
    const doc = r.primaryDocument?.[i] || "";
    if (!accession || !doc) continue;
    out.push({
      form,
      filed,
      description: r.primaryDocDescription?.[i] || form,
      url: `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accession}/${doc}`,
    });
  }
  return out;
}
