"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { WhalePayload } from "@/lib/oddpool";
import { useMovableCard } from "@/components/ui/useMovableCard";

function fmtUSD(v: number | null | undefined): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}
const cents = (p: number | null | undefined) => (p == null ? "—" : `${(p > 1 ? p : p * 100).toFixed(1)}¢`);
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

export function WhaleCard({ x = 40, y = 680, width = 1010, height = 300 }: { x?: number; y?: number; width?: number; height?: number }) {
  const { style, dragHandle, resizeHandle, raise } = useMovableCard("whale", { x, y, w: width, h: height }, { minW: 380, minH: 240 });
  const [data, setData] = useState<WhalePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = (first: boolean) =>
      fetch("/api/whales")
        .then((r) => r.json())
        .then((j) => {
          if (cancelled) return;
          if (j.error) setErr(j.error);
          else {
            setData(j);
            setErr(null);
          }
        })
        .catch(() => !cancelled && first && setErr("Couldn't load whale feed."))
        .finally(() => first && !cancelled && setLoading(false));
    load(true);
    const id = setInterval(() => load(false), 12000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div
      onPointerDown={raise}
      style={style}
      className="fade-in absolute flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#0e0e0e] font-sans tracking-[-0.01em] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
    >
      {/* header — drag handle */}
      <div {...dragHandle} className="shrink-0 cursor-move touch-none select-none px-5 pt-4 pb-3">
        <h2 className="text-[16px] font-semibold text-white">Whale Tracker</h2>
        {data && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white/[0.03] py-1.5">
              <p className="text-[9px] uppercase tracking-wider text-[#8a8a8a]">24h volume</p>
              <p className="mt-0.5 text-[13px] tabular-nums text-white">{fmtUSD(data.stats.total_volume_24h)}</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] py-1.5">
              <p className="text-[9px] uppercase tracking-wider text-[#8a8a8a]">24h trades</p>
              <p className="mt-0.5 text-[13px] tabular-nums text-white">{data.stats.total_trades_24h ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] py-1.5">
              <p className="text-[9px] uppercase tracking-wider text-[#8a8a8a]">Avg size</p>
              <p className="mt-0.5 text-[13px] tabular-nums text-white">{fmtUSD(data.stats.avg_trade_size)}</p>
            </div>
          </div>
        )}
      </div>

      {/* body — trade feed */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-2">
        {loading && <p className="mt-10 animate-pulse text-center text-[13px] text-[#8a8a8a]">Loading whale trades…</p>}
        {err && !data && <p className="mt-10 text-center text-[13px] text-rose-400">{err}</p>}
        {data && data.trades.length === 0 && !loading && (
          <p className="mt-10 text-center text-[12px] text-[#666]">No whale trades (≥$1K) on tracked markets yet.</p>
        )}

        {data?.trades.map((t) => {
          const yes = /yes/i.test(t.taker_side || t.outcome);
          return (
            <div key={t.id} className="flex items-start gap-3 border-t border-white/[0.06] py-2.5 first:border-t-0">
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                  yes ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
                )}
              >
                {yes ? "Yes" : "No"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[12.5px] leading-[1.25] text-white/90">{t.market_title}</p>
                <p className="mt-0.5 truncate text-[10.5px] text-[#8a8a8a]">
                  {t.event_title}
                  {t.trader_wallet ? ` · ${wallet(t.trader_wallet)}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-semibold tabular-nums text-white">{fmtUSD(t.trade_size_usd)}</p>
                <p className="mt-0.5 text-[10.5px] tabular-nums text-[#8a8a8a]">
                  {cents(t.price)} · {relTime(t.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
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
