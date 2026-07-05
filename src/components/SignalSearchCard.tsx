"use client";

import { useEffect, useState } from "react";
import { useMovableCard } from "@/components/ui/useMovableCard";
import { ContextMenu } from "@/components/ContextMenu";
import type { EventResult, MarketResult, MarketLite } from "@/lib/oddpool";
import type { EventStub } from "@/components/EventDetailCard";
import type { NewsItem } from "@/lib/guardian";

// Mirror of @/lib/signalLink Signal (kept local so this client card never pulls the
// server-only linking module into the browser bundle).
interface Signal { kind: "event" | "market"; linkage: string; event?: EventResult; market?: MarketResult }

function fmtUSD(v: number | null | undefined): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}
const pct = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x * 100)}%`);
const shortTicker = (mid: string) => {
  if (/^0x[0-9a-f]{6,}$/i.test(mid)) return `${mid.slice(0, 6)}…${mid.slice(-4)}`;
  const p = mid.split("-");
  return p[p.length - 1] || mid;
};
const venueLabel = (v: string) => (v === "kalshi" ? "Kalshi" : v === "polymarket" ? "Polymarket" : v || "—");
const sigKey = (s: Signal) => `${s.kind}:${s.kind === "market" ? s.market?.market_id : s.event?.event_id}`;
const resultKey = (id: string) => `thesis.signals.result.${id}`;

export function SignalSearchCard({
  article,
  x = 300,
  y = 150,
  onClose,
  onOpenEvent,
  onOpenMarket,
}: {
  article: NewsItem;
  x?: number;
  y?: number;
  onClose: () => void;
  onOpenEvent: (ev: EventStub) => void;
  onOpenMarket: (m: MarketLite, ticker: string) => void;
}) {
  const { style, dragHandle, resizeHandle, raise } = useMovableCard(`signals:${article.id}`, { x, y, w: 440, h: 500 }, { minW: 340, minH: 300 });
  const [signals, setSignals] = useState<Signal[] | null>(null); // null = not loaded yet
  const [err, setErr] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ vx: number; vy: number; key: string } | null>(null);

  useEffect(() => {
    // Persisted results (per article) → no re-spend on reopen/reload.
    try {
      const cached = localStorage.getItem(resultKey(article.id));
      if (cached) { const j = JSON.parse(cached); setSignals(Array.isArray(j.signals) ? j.signals : []); return; }
    } catch {}
    let alive = true;
    const commit = (sigs: Signal[], error?: string) => {
      if (!alive) return;
      setSignals(sigs);
      if (error && !sigs.length) setErr(error);
      try { localStorage.setItem(resultKey(article.id), JSON.stringify({ signals: sigs })); } catch {}
    };

    (async () => {
      try {
        const res = await fetch("/api/signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: article.id, title: article.title, trailText: article.trailText, takeaway: article.takeaway, section: article.section, published: article.published }),
        });
        if (!res.body) { // no stream (e.g. 400 JSON) → parse once
          const j = await res.json().catch(() => ({}));
          commit(Array.isArray(j.signals) ? j.signals : [], j.error);
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 2);
            if (!raw.startsWith("data:")) continue;
            let evt: { type?: string; signals?: Signal[]; error?: string };
            try { evt = JSON.parse(raw.slice(5).trim()); } catch { continue; }
            // Pipeline still streams per-stage `log` frames; we consume + ignore them and act on `result`.
            if (evt.type === "result") commit(Array.isArray(evt.signals) ? evt.signals : [], evt.error);
          }
          if (!alive) { try { await reader.cancel(); } catch {} return; }
        }
      } catch {
        if (alive) { setSignals([]); setErr("Couldn't reach the linker."); }
      }
    })();

    return () => { alive = false; };
  }, [article.id, article.title, article.trailText, article.takeaway, article.section, article.published]);

  const removeSignal = (key: string) => {
    setSignals((prev) => {
      const next = (prev || []).filter((s) => sigKey(s) !== key);
      try { localStorage.setItem(resultKey(article.id), JSON.stringify({ signals: next })); } catch {}
      return next;
    });
    setMenu(null);
  };

  const openSignal = (s: Signal) => {
    if (s.kind === "market" && s.market) {
      const m = s.market;
      onOpenMarket({ market_id: m.market_id, question: m.question, exchange: m.exchange, yes: m.yes, volume: m.volume, liquidity: m.liquidity, event_id: m.event_id }, shortTicker(m.market_id));
    } else if (s.event) {
      const e = s.event;
      onOpenEvent({ event_id: e.event_id, exchange: e.exchange, title: e.title, category: e.category, image: e.image });
    }
  };

  const loading = signals === null;

  return (
    <div
      onPointerDown={raise}
      style={style}
      className="fade-in absolute flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#0e0e0e] font-sans tracking-[-0.01em] shadow-[0_24px_70px_rgba(0,0,0,0.6)]"
    >
      {/* header */}
      <div {...dragHandle} className="shrink-0 cursor-move touch-none select-none border-b border-white/[0.06] px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-[#8a8a8a]">Signal · Search</p>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-white/90">{article.title}</p>
          </div>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} title="Close" className="-mr-1 shrink-0 rounded-md p-1 text-[#8a8a8a] transition-colors hover:bg-white/[0.06] hover:text-white">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* body */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <div className="dot-loader" role="status" aria-label="Finding signals" />
          </div>
        )}

        {!loading && signals!.length === 0 && (
          <div className="mt-10 px-3 text-center">
            <p className="text-[12.5px] text-white/80">No relevant signals for this story.</p>
            <p className="mt-1 text-[11px] text-[#666]">{err ? err : "No prediction market is meaningfully moved by this news."}</p>
          </div>
        )}

        {!loading && signals!.length > 0 && (
          <>
            <p className="px-2 pb-1 pt-0.5 text-[9px] uppercase tracking-wider text-[#666]">{signals!.length} signal{signals!.length === 1 ? "" : "s"}</p>
            {signals!.map((s) => {
              const key = sigKey(s);
              const isMarket = s.kind === "market" && s.market;
              const m = s.market, e = s.event;
              return (
                <button
                  key={key}
                  onClick={() => openSignal(s)}
                  onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setMenu({ vx: ev.clientX, vy: ev.clientY, key }); }}
                  className="block w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[9px] uppercase tracking-wider text-[#7a7a7a]">{venueLabel(isMarket ? m!.exchange : e!.exchange)}</span>
                    <span className="min-w-0 flex-1 truncate text-[10px] text-white/90">{isMarket ? m!.question : e!.title}</span>
                    <span className="shrink-0 text-[10px] tabular-nums text-[#8a8a8a]">{fmtUSD(isMarket ? m!.volume : e!.totalVolume)}</span>
                    {isMarket ? (
                      <span className="shrink-0 text-[10px] font-semibold tabular-nums text-emerald-400">{pct(m!.yes)}</span>
                    ) : (
                      e!.marketCount != null && <span className="shrink-0 text-[10px] tabular-nums text-[#8a8a8a]">{e!.marketCount} mkt{e!.marketCount === 1 ? "" : "s"}</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-[#8a8a8a]">{s.linkage}</p>
                </button>
              );
            })}
          </>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.vx}
          y={menu.vy}
          items={[{ label: "Remove", onClick: () => removeSignal(menu.key) }]}
          onClose={() => setMenu(null)}
        />
      )}

      <div {...resizeHandle} className="absolute bottom-0 right-0 z-20 flex h-7 w-7 cursor-nwse-resize touch-none items-end justify-end p-1.5 text-white/40 transition-colors hover:text-white/80" title="Drag to resize">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M11 4L4 11M11 8L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </div>
    </div>
  );
}
