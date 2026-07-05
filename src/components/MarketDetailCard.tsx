"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { MarketLite, MarketDetail, WhaleTrade } from "@/lib/oddpool";
import { useMovableCard } from "@/components/ui/useMovableCard";
import { usePollingActive } from "@/components/ui/usePollingActive";
import { PredictionChart, RangeToggle, type ChartRange, type ChartSeries } from "@/components/PredictionChart";

const pct = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x * 100)}%`);
const cents = (p: number | null | undefined) => (p == null ? "—" : `${(p * 100).toFixed(1)}¢`);
function fmtUSD(v: number | null | undefined): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}
function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
const wallet = (w?: string) => (w ? `${w.slice(0, 6)}…${w.slice(-4)}` : "");
const venueLabel = (ex: string) => (/polymarket/i.test(ex) ? "Polymarket" : /kalshi/i.test(ex) ? "Kalshi" : ex);

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg bg-white/[0.03] py-2">
      <p className="text-[9px] uppercase tracking-wider text-[#8a8a8a]">{label}</p>
      <p className={cn("mt-0.5 text-[12.5px] tabular-nums", tone === "up" ? "text-emerald-400" : tone === "down" ? "text-rose-400" : "text-white")}>
        {value}
      </p>
    </div>
  );
}

function BookSide({ title, rows, side }: { title: string; rows: Array<{ price: number; size: number }>; side: "bid" | "ask" }) {
  const max = Math.max(...rows.map((r) => r.size), 1);
  const bar = side === "bid" ? "bg-emerald-500/15" : "bg-rose-500/15";
  const txt = side === "bid" ? "text-emerald-400" : "text-rose-400";
  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-wider text-[#8a8a8a]">{title}</p>
      {rows.length ? (
        rows.map((r, i) => (
          <div key={i} className="relative flex items-center justify-between px-1.5 py-0.5 text-[11px]">
            <div className={cn("absolute inset-y-0 right-0 rounded", bar)} style={{ width: `${(r.size / max) * 100}%` }} />
            <span className={cn("relative tabular-nums", txt)}>{cents(r.price)}</span>
            <span className="relative tabular-nums text-[#8a8a8a]">{r.size.toFixed(0)}</span>
          </div>
        ))
      ) : (
        <p className="text-[10px] text-[#666]">—</p>
      )}
    </div>
  );
}

export type OpenMarket = MarketLite & { ticker: string };

export function MarketDetailCard({ market, x = 80, y = 140, onClose }: { market: OpenMarket; x?: number; y?: number; onClose: () => void }) {
  const { style, dragHandle, resizeHandle, raise } = useMovableCard(`market:${market.market_id}`, { x, y, w: 460, h: 540 }, { minW: 360, minH: 300 });
  const cardRef = useRef<HTMLDivElement>(null);
  const activeRef = usePollingActive(cardRef);
  const [detail, setDetail] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<ChartRange>("30d");
  const [whales, setWhales] = useState<{ count: number; totalVolume: number; largest: number; yesVolume: number; noVolume: number; yesCount: number; noCount: number; trades: WhaleTrade[] } | null>(null);

  // Full load (with chart) — refetched when the range changes. Detail persists across a
  // range switch, so the loading spinner (gated on !detail) never re-appears mid-session.
  useEffect(() => {
    let alive = true;
    let retried = false;
    setLoading(true);
    const run = () => {
      const q = new URLSearchParams({ market_id: market.market_id, exchange: market.exchange, yes: market.yes != null ? String(market.yes) : "", range });
      fetch(`/api/prediction/market?${q.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive || d.error) return;
          setDetail(d);
          // The market full-load fires several Oddpool calls at once; under the polling
          // burst the OHLCV call can 429 and return empty bars (book/trades still load).
          // Retry once so the chart isn't stuck on "No price history".
          if ((!d.bars || d.bars.length === 0) && !retried) {
            retried = true;
            setTimeout(run, 1500);
          }
        })
        .catch(() => {})
        .finally(() => { if (alive) setLoading(false); });
    };
    run();
    return () => { alive = false; };
  }, [market.market_id, market.exchange, market.yes, range]);

  // Live quote/book/trades polling (chart stays — 6h cadence). The recurring poll
  // pauses when the card is off-screen or the tab is hidden (throttle) — the initial
  // tick still runs so a freshly-opened card always populates.
  useEffect(() => {
    const tick = () => {
      const q = new URLSearchParams({
        market_id: market.market_id,
        exchange: market.exchange,
        yes: market.yes != null ? String(market.yes) : "",
        quote: "1",
      });
      fetch(`/api/prediction/market?${q.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.error) return;
          setDetail((prev) =>
            prev
              ? {
                  ...prev,
                  yes: d.yes ?? prev.yes,
                  bid: d.bid,
                  ask: d.ask,
                  spread: d.spread,
                  book: d.book && (d.book.bids.length || d.book.asks.length) ? d.book : prev.book,
                }
              : prev,
          );
        })
        .catch(() => {});
    };
    tick();
    const id = setInterval(() => { if (activeRef.current) tick(); }, 6000);
    return () => clearInterval(id);
  }, [market.market_id, market.exchange, market.yes]);

  // Per-market whale trades (≥$1K); initial load always, recurring poll gated.
  useEffect(() => {
    const load = () => {
      const q = new URLSearchParams({ market_id: market.market_id, event_ticker: market.event_id, exchange: market.exchange });
      fetch(`/api/whales/market?${q.toString()}`)
        .then((r) => r.json())
        .then((d) => !d.error && setWhales(d))
        .catch(() => {});
    };
    load();
    const id = setInterval(() => { if (activeRef.current) load(); }, 15000);
    return () => clearInterval(id);
  }, [market.market_id, market.event_id, market.exchange]);

  const ch1 = detail?.stats?.change_1d;
  const bars = detail?.bars ?? [];
  const up = bars.length >= 2 ? bars[bars.length - 1].c >= bars[0].c : true;
  const marketSeries: ChartSeries[] = detail
    ? [{ key: market.market_id, label: "YES", color: up ? "#34d399" : "#f87171", points: bars.map((b) => ({ t: Date.parse(b.ts), c: b.c })), live: detail.yes }]
    : [];

  // Whale sentiment: YES vs NO whale $ → ratio bar + bull/bear tag (bearish = NO money leads).
  const wYes = whales?.yesVolume || 0, wNo = whales?.noVolume || 0, wSum = wYes + wNo;
  const yesPct = wSum > 0 ? (wYes / wSum) * 100 : 0;
  const noPct = wSum > 0 ? (wNo / wSum) * 100 : 0;
  const bearish = wNo > wYes;

  return (
    <div
      ref={cardRef}
      onPointerDown={raise}
      style={style}
      className="fade-in absolute flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#0e0e0e] font-sans tracking-[-0.01em] shadow-[0_24px_70px_rgba(0,0,0,0.6)]"
    >
      {/* header — drag handle */}
      <div {...dragHandle} className="shrink-0 cursor-move touch-none select-none border-b border-white/[0.06] px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-[#8a8a8a]">
            {market.ticker} · {venueLabel(market.exchange)}
          </span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="-mr-1 rounded-md p-1 text-[#8a8a8a] transition-colors hover:bg-white/[0.06] hover:text-white"
            title="Close"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-white">{market.question}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-white">{pct(detail?.yes ?? market.yes)}</span>
          <span className="text-[11px] text-[#8a8a8a]">YES</span>
          {ch1 != null && (
            <span className={cn("text-[11px]", ch1 >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {ch1 >= 0 ? "+" : "−"}
              {Math.abs(ch1 * 100).toFixed(1)} pts 24h
            </span>
          )}
        </div>
      </div>

      {/* body */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {loading && !detail && <p className="mt-10 animate-pulse text-center text-[13px] text-[#8a8a8a]">Loading live market…</p>}
        {detail && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-[#8a8a8a]">Probability</span>
                <RangeToggle value={range} onChange={setRange} />
              </div>
              <div className="mt-1.5">
                <PredictionChart series={marketSeries} range={range} height={132} area />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <Stat label="Bid" value={cents(detail.bid)} />
              <Stat label="Ask" value={cents(detail.ask)} />
              <Stat label="Spread" value={cents(detail.spread)} />
              <Stat
                label="24h"
                value={ch1 != null ? `${ch1 >= 0 ? "+" : "−"}${Math.abs(ch1 * 100).toFixed(1)}` : "—"}
                tone={ch1 == null ? undefined : ch1 >= 0 ? "up" : "down"}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Volume" value={fmtUSD(market.volume)} />
              <Stat label="Liquidity" value={fmtUSD(market.liquidity)} />
              <Stat label="Closes" value={fmtDate(detail.scheduledCloseAt)} />
            </div>

            {detail.book && (detail.book.bids.length > 0 || detail.book.asks.length > 0) && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#8a8a8a]">Order book · YES</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <BookSide title="Bids" rows={detail.book.bids} side="bid" />
                  <BookSide title="Asks" rows={detail.book.asks} side="ask" />
                </div>
              </div>
            )}

            {whales && (
              <div>
                {/* title + bull/bear tag + total */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-wider text-[#8a8a8a]">Whale activity · ≥$1K</p>
                    {whales.count > 0 && (
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", bearish ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400")}>
                        {bearish ? "Bearish" : "Bullish"}
                      </span>
                    )}
                  </div>
                  {whales.count > 0 && (
                    <div className="shrink-0 text-right leading-tight">
                      <p className="text-[12px] font-semibold tabular-nums text-white">{fmtUSD(whales.totalVolume)}</p>
                      <p className="text-[9px] tabular-nums text-[#8a8a8a]">{whales.count} whale {whales.count === 1 ? "trade" : "trades"}</p>
                    </div>
                  )}
                </div>

                {whales.count === 0 ? (
                  <p className="mt-2 text-[11px] text-[#666]">No whale trades (≥$1K) on this market yet.</p>
                ) : (
                  <>
                    {/* YES / NO ratio bar */}
                    <div className="mt-2.5">
                      <div className="mb-1 flex items-center justify-between text-[10.5px] tabular-nums">
                        <span className="text-emerald-400">YES {fmtUSD(whales.yesVolume)}</span>
                        <span className="text-rose-400">NO {fmtUSD(whales.noVolume)}</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full bg-emerald-500" style={{ width: `${yesPct}%` }} />
                        <div className="h-full bg-rose-500" style={{ width: `${noPct}%` }} />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[9.5px] tabular-nums text-[#8a8a8a]">
                        <span>{Math.round(yesPct)}% ({whales.yesCount} {whales.yesCount === 1 ? "trade" : "trades"})</span>
                        <span>{Math.round(noPct)}% ({whales.noCount} {whales.noCount === 1 ? "trade" : "trades"})</span>
                      </div>
                    </div>

                    {/* per-market whale list — wallet in place of market name */}
                    <div className="mt-3 flex flex-col">
                      {whales.trades.slice(0, 8).map((t) => {
                        const yes = /yes/i.test(t.taker_side);
                        return (
                          <div key={t.id} className="flex items-center gap-2 py-1 text-[10.5px] tabular-nums text-[#8a8a8a]">
                            <span className={cn("w-8 shrink-0 rounded px-1 text-center text-[9px] font-semibold uppercase", yes ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300")}>{yes ? "YES" : "NO"}</span>
                            <span className="w-12 shrink-0 text-white/80">{fmtUSD(t.trade_size_usd)}</span>
                            <span className="w-9 shrink-0">{Math.round(t.price)}¢</span>
                            <span className="min-w-0 flex-1 truncate">{wallet(t.trader_wallet)}</span>
                            <span className="shrink-0">{relTime(t.timestamp)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {!loading && !detail.book && (
              <p className="text-center text-[11px] text-[#666]">Live order book unavailable for this market.</p>
            )}
          </div>
        )}
      </div>

      {/* resize handle */}
      <div
        {...resizeHandle}
        className="absolute bottom-0 right-0 z-20 flex h-7 w-7 cursor-nwse-resize touch-none items-end justify-end p-1.5 text-white/40 transition-colors hover:text-white/80"
        title="Drag to resize"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M11 4L4 11M11 8L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
