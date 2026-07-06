"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMovableCard } from "@/components/ui/useMovableCard";
import type { EventResult, MarketResult, MarketLite } from "@/lib/oddpool";
import type { EventStub } from "@/components/EventDetailCard";

export type SearchMode = "events" | "markets";

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

const VENUES = [{ v: "", l: "All" }, { v: "kalshi", l: "Kalshi" }, { v: "polymarket", l: "Poly" }];
const VOL_OPTS = [{ v: 0, l: "Any vol" }, { v: 1000, l: "$1K+" }, { v: 10000, l: "$10K+" }, { v: 100000, l: "$100K+" }, { v: 1000000, l: "$1M+" }];
const CATEGORIES = ["Sports", "Crypto", "Politics", "Elections", "Economics", "Entertainment", "Esports", "Weather", "Culture", "Financials"];
const SORTS_EVENTS = [{ v: "relevance", l: "Relevance" }, { v: "volume", l: "Volume" }, { v: "newest", l: "Newest" }, { v: "liquidity", l: "Liquidity" }, { v: "markets", l: "Most markets" }];
const SORTS_MARKETS = [{ v: "relevance", l: "Relevance" }, { v: "volume", l: "Volume" }, { v: "newest", l: "Newest" }, { v: "liquidity", l: "Liquidity" }];
const LIMIT = 25;
const HISTORY_MAX = 10; // pre-loaded (empty-query) list = last N cards opened via search
const historyKey = (m: SearchMode) => `thesis.search.history.${m}`;

const selectCls = "appearance-none rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] text-white/80 outline-none transition-colors hover:border-white/20 focus:border-white/30";

export function SearchCard({
  mode,
  onModeChange,
  x = 260,
  y = 130,
  width = 440,
  height = 540,
  onClose,
  onOpenEvent,
  onOpenMarket,
}: {
  mode: SearchMode;
  onModeChange: (m: SearchMode) => void;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  onClose: () => void;
  onOpenEvent: (ev: EventStub) => void;
  onOpenMarket: (m: MarketLite, ticker: string) => void;
}) {
  const { style, dragHandle, resizeHandle, raise } = useMovableCard("search", { x, y, w: width, h: height }, { minW: 340, minH: 320 });
  const [q, setQ] = useState("");
  const [venue, setVenue] = useState("");
  const [status, setStatus] = useState("active");
  const [sortBy, setSortBy] = useState("relevance");
  const [minVolume, setMinVolume] = useState(0);
  const [category, setCategory] = useState("");
  // Results are tagged with the mode they belong to. The render only shows them when the
  // tag matches the current mode, so the frame right after a mode flip (new mode, old
  // items) never renders cross-mode data (which would collide React keys).
  const [data, setData] = useState<{ mode: SearchMode; items: Array<EventResult | MarketResult> }>({ mode, items: [] });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Oddpool search can return the same event/market twice, and load-more pages can
  // overlap — dedupe by id so React keys stay unique and rows don't repeat.
  const dedupe = (list: Array<EventResult | MarketResult>, m: SearchMode) => {
    const seen = new Set<string>();
    const out: Array<EventResult | MarketResult> = [];
    for (const x of list) {
      const k = m === "markets" ? (x as MarketResult).market_id : (x as EventResult).event_id;
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  };

  // Spawned-card history (per mode) — the empty-query list shows the last 10 events/markets
  // opened via search, persisted so it survives reloads.
  const idOf = (m: SearchMode, x: EventResult | MarketResult) => (m === "markets" ? (x as MarketResult).market_id : (x as EventResult).event_id);
  const loadHistory = (m: SearchMode): Array<EventResult | MarketResult> => {
    if (typeof window === "undefined") return [];
    try { const v = JSON.parse(localStorage.getItem(historyKey(m)) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
  };
  const recordHistory = (m: SearchMode, item: EventResult | MarketResult) => {
    if (typeof window === "undefined") return;
    const id = idOf(m, item);
    const next = [item, ...loadHistory(m).filter((x) => idOf(m, x) !== id)].slice(0, HISTORY_MAX);
    try { localStorage.setItem(historyKey(m), JSON.stringify(next)); } catch {}
    if (!q.trim() && m === mode) setData({ mode: m, items: next }); // refresh the shown history in place
  };

  const buildUrl = (off: number) => {
    const sp = new URLSearchParams();
    sp.set("mode", mode);
    if (q.trim()) sp.set("q", q.trim());
    if (venue) sp.set("exchange", venue);
    if (status) sp.set("status", status);
    if (category && mode === "events") sp.set("category", category);
    if (minVolume) sp.set("min_volume", String(minVolume));
    const effSort = mode === "markets" && sortBy === "markets" ? "relevance" : sortBy;
    if (effSort) sp.set("sort_by", effSort);
    sp.set("limit", String(LIMIT));
    if (off) sp.set("offset", String(off));
    return `/api/oddpool/search?${sp.toString()}`;
  };

  // Empty query → show the spawned-card history; otherwise debounced live search.
  useEffect(() => {
    if (!q.trim()) {
      setData({ mode, items: loadHistory(mode) });
      setLoading(false);
      setErr(null);
      setHasMore(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setErr(null);
    const t = setTimeout(() => {
      fetch(buildUrl(0))
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return; // ignore a response whose query/mode has been superseded
          if (d.error) { setErr(d.error); setData({ mode, items: [] }); setHasMore(false); }
          else { const r = d.results || []; setData({ mode, items: dedupe(r, mode) }); setHasMore(r.length >= LIMIT); setOffset(0); }
        })
        .catch(() => { if (alive) setErr("Search failed."); })
        .finally(() => { if (alive) setLoading(false); });
    }, 350);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, venue, status, sortBy, minVolume, category, mode]);

  const loadMore = () => {
    const next = offset + LIMIT;
    const reqMode = mode;
    fetch(buildUrl(next))
      .then((r) => r.json())
      .then((d) => {
        if (d.error || reqMode !== modeRef.current) return;
        const r = d.results || [];
        setData((prev) => (prev.mode === reqMode ? { mode: reqMode, items: dedupe([...prev.items, ...r], reqMode) } : prev));
        setHasMore(r.length >= LIMIT);
        setOffset(next);
      })
      .catch(() => {});
  };

  const sorts = mode === "events" ? SORTS_EVENTS : SORTS_MARKETS;
  // Only surface results that belong to the current mode (guards the post-mode-flip frame).
  const items = data.mode === mode ? data.items : [];

  return (
    <div
      onPointerDown={raise}
      style={style}
      className="fade-in absolute flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#0e0e0e] font-sans tracking-[-0.01em] shadow-[0_24px_70px_rgba(0,0,0,0.6)]"
    >
      {/* header */}
      <div {...dragHandle} className="shrink-0 cursor-move touch-none select-none border-b border-white/[0.06] px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-[#8a8a8a]">Prediction Markets · Search</p>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} title="Close" className="-mr-1 rounded-md p-1 text-[#8a8a8a] transition-colors hover:bg-white/[0.06] hover:text-white">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        {/* mode toggle */}
        <div className="mt-2 flex gap-0.5 rounded-md bg-white/[0.05] p-0.5" onPointerDown={(e) => e.stopPropagation()}>
          {(["events", "markets"] as SearchMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={cn("flex-1 rounded px-2 py-1 text-[11px] font-medium capitalize transition-colors", mode === m ? "bg-white/15 text-white" : "text-[#8a8a8a] hover:text-white")}
            >
              {m}
            </button>
          ))}
        </div>
        {/* search input */}
        <div className="mt-2" onPointerDown={(e) => e.stopPropagation()}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={mode === "events" ? "Search events…" : "Search markets…"}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-[#666] outline-none transition-colors focus:border-white/25"
          />
        </div>
        {/* filters */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
          <div className="flex gap-0.5 rounded-md bg-white/[0.05] p-0.5">
            {VENUES.map((o) => (
              <button key={o.l} onClick={() => setVenue(o.v)} className={cn("rounded px-1.5 py-0.5 text-[10px] transition-colors", venue === o.v ? "bg-white/15 text-white" : "text-[#8a8a8a] hover:text-white")}>{o.l}</button>
            ))}
          </div>
          <div className="flex gap-0.5 rounded-md bg-white/[0.05] p-0.5">
            {[{ v: "active", l: "Active" }, { v: "closed", l: "Closed" }].map((o) => (
              <button key={o.v} onClick={() => setStatus(o.v)} className={cn("rounded px-1.5 py-0.5 text-[10px] transition-colors", status === o.v ? "bg-white/15 text-white" : "text-[#8a8a8a] hover:text-white")}>{o.l}</button>
            ))}
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectCls} title="Sort by">
            {sorts.map((o) => <option key={o.v} value={o.v} className="bg-[#1a1a1a]">{o.l}</option>)}
          </select>
          <select value={minVolume} onChange={(e) => setMinVolume(Number(e.target.value))} className={selectCls} title="Min volume">
            {VOL_OPTS.map((o) => <option key={o.v} value={o.v} className="bg-[#1a1a1a]">{o.l}</option>)}
          </select>
          {mode === "events" && (
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls} title="Category">
              <option value="" className="bg-[#1a1a1a]">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* results */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {loading && <p className="mt-8 animate-pulse text-center text-[12px] text-[#8a8a8a]">Searching…</p>}
        {!loading && err && <p className="mt-8 text-center text-[12px] text-rose-400">{err}</p>}
        {!loading && !err && items.length === 0 && (
          <p className="mt-8 text-center text-[12px] text-[#666]">{q.trim() ? "No results." : "No recently opened cards yet — search to open events & markets."}</p>
        )}
        {!loading && !err && !q.trim() && items.length > 0 && (
          <p className="px-2 pb-1 pt-0.5 text-[9px] uppercase tracking-wider text-[#666]">Recently opened</p>
        )}

        {!loading && !err && items.length > 0 && mode === "events" && (items as EventResult[]).map((e) => (
          <button
            key={e.event_id}
            onClick={() => { recordHistory("events", e); onOpenEvent({ event_id: e.event_id, exchange: e.exchange, title: e.title, category: e.category, image: e.image }); }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
          >
            <span className="shrink-0 text-[9px] uppercase tracking-wider text-[#7a7a7a]">{venueLabel(e.exchange)}</span>
            <span className="min-w-0 flex-1 truncate text-[10px] text-white/90">{e.title}</span>
            <span className="shrink-0 text-[10px] tabular-nums text-[#8a8a8a]">{fmtUSD(e.totalVolume)}</span>
            {e.marketCount != null && <span className="shrink-0 text-[10px] tabular-nums text-[#8a8a8a]">{e.marketCount} mkt{e.marketCount === 1 ? "" : "s"}</span>}
          </button>
        ))}

        {!loading && !err && items.length > 0 && mode === "markets" && (items as MarketResult[]).map((m) => (
          <button
            key={m.market_id}
            onClick={() => { recordHistory("markets", m); onOpenMarket({ market_id: m.market_id, question: m.question, exchange: m.exchange, yes: m.yes, volume: m.volume, liquidity: m.liquidity, event_id: m.event_id }, shortTicker(m.market_id)); }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
          >
            <span className="shrink-0 text-[9px] uppercase tracking-wider text-[#7a7a7a]">{venueLabel(m.exchange)}</span>
            <span className="min-w-0 flex-1 truncate text-[10px] text-white/90">{m.question}</span>
            <span className="shrink-0 text-[10px] tabular-nums text-[#8a8a8a]">{fmtUSD(m.volume)}</span>
            <span className="shrink-0 text-[10px] font-semibold tabular-nums text-emerald-400">{pct(m.yes)}</span>
          </button>
        ))}

        {!loading && !err && hasMore && (
          <button onClick={loadMore} className="mx-auto mt-1 mb-2 block rounded-md border border-white/10 px-3 py-1 text-[11px] text-[#8a8a8a] transition-colors hover:border-white/25 hover:text-white">
            Load more
          </button>
        )}
      </div>

      <div {...resizeHandle} className="absolute bottom-0 right-0 z-20 flex h-7 w-7 cursor-nwse-resize touch-none items-end justify-end p-1.5 text-white/40 transition-colors hover:text-white/80" title="Drag to resize">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M11 4L4 11M11 8L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </div>
    </div>
  );
}
