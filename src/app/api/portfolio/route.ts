import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// PanAgora Asset Management Inc — SEC EDGAR CIK.
const CIK = "0000883677";
const CIK_NUM = String(parseInt(CIK, 10));
// SEC requires a descriptive User-Agent with contact info on all programmatic requests.
const UA = "Thesis App (veer.podder2429@gmail.com)";
const SEC_HEADERS = { "User-Agent": UA, Accept: "application/json", "Accept-Encoding": "gzip, deflate" };

interface Holding {
  rank: number;
  name: string;
  cusip: string;
  cls: string;
  putCall: string;
  value: number; // USD
  shares: number;
  pct: number; // % of disclosed portfolio
}

// Tolerate optional XML namespace prefixes (e.g. <ns1:nameOfIssuer>).
function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<(?:[\\w-]+:)?${name}>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "i"));
  return m ? m[1].trim() : "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#0?39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export async function GET() {
  try {
    // 1) Latest 13F-HR (or amendment) from the manager's submissions index.
    const subRes = await fetch(`https://data.sec.gov/submissions/CIK${CIK}.json`, {
      headers: SEC_HEADERS,
      cache: "no-store",
    });
    if (!subRes.ok) {
      return NextResponse.json({ error: `SEC submissions ${subRes.status}` }, { status: 502 });
    }
    const sub = (await subRes.json()) as {
      name?: string;
      filings?: { recent?: { form: string[]; accessionNumber: string[]; filingDate: string[]; reportDate: string[] } };
    };
    const recent = sub.filings?.recent;
    if (!recent) return NextResponse.json({ error: "No filings index." }, { status: 502 });

    let idx = -1;
    for (let i = 0; i < recent.form.length; i++) {
      if (recent.form[i] === "13F-HR" || recent.form[i] === "13F-HR/A") {
        idx = i;
        break; // recent[] is newest-first
      }
    }
    if (idx < 0) return NextResponse.json({ error: "No 13F-HR filing found." }, { status: 404 });

    const accession = recent.accessionNumber[idx].replace(/-/g, "");
    const filingDate = recent.filingDate[idx];
    const reportDate = recent.reportDate?.[idx] || "";
    const base = `https://www.sec.gov/Archives/edgar/data/${CIK_NUM}/${accession}`;

    // 2) Find the information-table XML inside the filing folder.
    const dirRes = await fetch(`${base}/index.json`, { headers: SEC_HEADERS, cache: "no-store" });
    if (!dirRes.ok) return NextResponse.json({ error: `SEC filing index ${dirRes.status}` }, { status: 502 });
    const dir = (await dirRes.json()) as { directory?: { item?: Array<{ name: string }> } };
    const items = dir.directory?.item || [];
    const xmls = items.filter((f) => f.name.toLowerCase().endsWith(".xml"));
    const infoFile =
      xmls.find((f) => /infotable|inftable|form13f.*table|information.?table|table/i.test(f.name)) ||
      xmls.find((f) => !/primary_doc/i.test(f.name)) ||
      xmls[0];
    if (!infoFile) return NextResponse.json({ error: "No information table in filing." }, { status: 502 });

    // 3) Fetch + parse the info table.
    const xmlRes = await fetch(`${base}/${infoFile.name}`, {
      headers: { ...SEC_HEADERS, Accept: "application/xml" },
      cache: "no-store",
    });
    if (!xmlRes.ok) return NextResponse.json({ error: `SEC info table ${xmlRes.status}` }, { status: 502 });
    const xml = await xmlRes.text();

    const blocks = xml.split(/<(?:[\w-]+:)?infoTable[\s>]/i).slice(1);
    // Aggregate lots of the same security (key on cusip + class + put/call).
    const agg = new Map<string, { name: string; cusip: string; cls: string; putCall: string; value: number; shares: number }>();
    for (const b of blocks) {
      const name = decodeEntities(tag(b, "nameOfIssuer"));
      if (!name) continue;
      const cls = tag(b, "titleOfClass");
      const cusip = tag(b, "cusip");
      const putCall = tag(b, "putCall");
      const value = parseFloat(tag(b, "value").replace(/[^0-9.]/g, "")) || 0;
      const shares = parseFloat(tag(b, "sshPrnamt").replace(/[^0-9.]/g, "")) || 0;
      const key = `${cusip}|${cls}|${putCall}`;
      const cur = agg.get(key);
      if (cur) {
        cur.value += value;
        cur.shares += shares;
      } else {
        agg.set(key, { name, cusip, cls, putCall, value, shares });
      }
    }

    const all = [...agg.values()];
    let total = all.reduce((s, h) => s + h.value, 0);
    // 13F <value> is reported in whole dollars for filings on/after Jan 2023, but older
    // filings used thousands. Detect the legacy unit and normalize to dollars.
    let unitScale = 1;
    if (total > 0 && total < 1e9) {
      unitScale = 1000; // a real 13F manager's book is >$1B; small totals mean thousands.
      total *= 1000;
    }

    const holdings: Holding[] = all
      .sort((a, b) => b.value - a.value)
      .slice(0, 50)
      .map((h, i) => ({
        rank: i + 1,
        name: h.name,
        cusip: h.cusip,
        cls: h.cls,
        putCall: h.putCall,
        value: h.value * unitScale,
        shares: h.shares,
        pct: total > 0 ? (h.value * unitScale * 100) / total : 0,
      }));

    return NextResponse.json({
      manager: sub.name || "PanAgora Asset Management Inc",
      cik: CIK_NUM,
      filingDate,
      reportDate,
      totalValue: total,
      positions: all.length,
      holdings,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load portfolio." }, { status: 502 });
  }
}
