"use client";

import { useEffect, useState } from "react";

interface Holding {
  rank: number;
  name: string;
  cusip: string;
  cls: string;
  putCall: string;
  value: number;
  shares: number;
  pct: number;
}
interface PortfolioData {
  manager: string;
  cik: string;
  filingDate: string;
  reportDate: string;
  totalValue: number;
  positions: number;
  holdings: Holding[];
}

function fmtUSD(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}
function fmtShares(s: number): string {
  if (s >= 1e6) return `${(s / 1e6).toFixed(1)}M`;
  if (s >= 1e3) return `${(s / 1e3).toFixed(0)}K`;
  return String(Math.round(s));
}
function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}
function quarterOf(d: string): string {
  const m = new Date(d).getUTCMonth();
  if (Number.isNaN(m)) return "";
  return `Q${Math.floor(m / 3) + 1} ${new Date(d).getUTCFullYear()}`;
}
function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(Inc|Corp|Co|Llc|Ltd|Plc|Sa|Nv|Ag|Etf|Reit|Com)\b/g, (m) => m); // keep as-is
}

export function PortfolioLedger() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j);
      })
      .catch(() => setError("Couldn't load the portfolio."))
      .finally(() => setLoading(false));
  }, []);

  const topPct = data?.holdings?.[0]?.pct || 1;

  return (
    <div className="fade-in">
      <div className="px-5 py-5 pb-10">
        {/* header */}
        <div className="flex items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-accent">PanAgora Asset Management</h1>
            <p className="mt-1 text-[12px] text-text-muted">
              Latest disclosed 13F holdings
              {data && (
                <>
                  {" · "}
                  {quarterOf(data.reportDate)} (as of {data.reportDate}) · filed {fmtDate(data.filingDate)}
                </>
              )}
            </p>
          </div>
          {data && (
            <div className="shrink-0 text-right">
              <div className="font-mono text-[18px] text-accent">{fmtUSD(data.totalValue)}</div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted">
                {data.positions.toLocaleString()} positions · top 50
              </div>
            </div>
          )}
        </div>

        {loading && (
          <p className="mt-16 text-center text-[13px] text-text-muted animate-pulse">
            Pulling PanAgora&apos;s latest 13F from SEC EDGAR…
          </p>
        )}
        {error && <p className="mt-16 text-center text-[13px] text-negative">{error}</p>}

        {data && (
          <table className="mt-5 w-full border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-text-muted">
                <th className="w-8 py-2 pr-3 text-left font-medium">#</th>
                <th className="py-2 px-3 text-left font-medium">Holding</th>
                <th className="py-2 px-3 text-right font-medium">Shares</th>
                <th className="py-2 px-3 text-right font-medium">Market value</th>
                <th className="w-44 py-2 pl-3 text-right font-medium">% of book</th>
              </tr>
            </thead>
            <tbody>
              {data.holdings.map((h) => (
                <tr key={`${h.rank}-${h.cusip}`} className="border-border/50 transition-colors hover:bg-panel/60">
                  <td className="border-t border-border/50 py-2.5 pr-3 font-mono text-text-muted">{h.rank}</td>
                  <td className="border-t border-border/50 py-2.5 px-3">
                    <span className="text-text">{titleCase(h.name)}</span>
                    {h.putCall && (
                      <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-text-muted">
                        {h.putCall}
                      </span>
                    )}
                  </td>
                  <td className="border-t border-border/50 py-2.5 px-3 text-right font-mono text-text-muted">
                    {fmtShares(h.shares)}
                  </td>
                  <td className="border-t border-border/50 py-2.5 px-3 text-right font-mono text-text">{fmtUSD(h.value)}</td>
                  <td className="border-t border-border/50 py-2.5 pl-3">
                    <div className="flex items-center justify-end gap-2.5">
                      <div className="h-1 w-20 overflow-hidden rounded-full bg-surface">
                        <div className="h-full rounded-full bg-crimson" style={{ width: `${Math.min(100, (h.pct / topPct) * 100)}%` }} />
                      </div>
                      <span className="w-12 text-right font-mono text-text-muted">{h.pct.toFixed(2)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data && (
          <p className="mt-6 text-[11px] leading-relaxed text-text-muted">
            Source: SEC EDGAR Form 13F-HR (CIK {data.cik}). 13F discloses long U.S. equity positions only, ~45 days
            after quarter-end; it excludes shorts, cash, and non-13F assets.
          </p>
        )}
      </div>
    </div>
  );
}
