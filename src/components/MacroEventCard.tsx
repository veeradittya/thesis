"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMovableCard } from "@/components/ui/useMovableCard";
import type { MacroEvent } from "@/components/MacroSignalsCard";

// dist wire shape (redeclared — server module @/lib/macroFeed imports `ws`).
interface Outcome { outcome: string; label: string; prob: number | null; kalshiProb: number | null; polyProb: number | null; kalshiDepthUsd: number; polyDepthUsd: number; depthUsd: number }
interface Dist { eventKey: string; seq: number; publishedTs: number; outcomes: Outcome[] }

const pct = (x: number | null | undefined, dp = 0) => (x == null ? "—" : `${(x * 100).toFixed(dp)}%`);
function fmtUSD(v: number | null | undefined): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}
function countdown(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const d = t - now;
  if (d <= 0) return "now";
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
function fmtReleaseET(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  return new Date(t).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET";
}
const venueLabel = (v: string) => (v === "kalshi" ? "Kalshi" : v === "polymarket" ? "Polymarket" : v);
const parseStrike = (t: string): number | null => { const m = (t || "").match(/-?[\d,]+(?:\.\d+)?/); return m ? parseFloat(m[0].replace(/,/g, "")) : null; };

export function MacroEventCard({
  event,
  x = 200,
  y = 200,
  onClose,
}: {
  event: MacroEvent;
  x?: number;
  y?: number;
  onClose: () => void;
}) {
  const { style, dragHandle, resizeHandle, raise } = useMovableCard(`macroEvent:${event.eventKey}`, { x, y, w: 460, h: 560 }, { minW: 360, minH: 300 });
  const [dist, setDist] = useState<Dist | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState<Record<string, { dir: "up" | "down"; ts: number }>>({});
  const [vols, setVols] = useState<Record<string, number>>({});
  const prev = useRef<Record<string, number>>({});

  useEffect(() => {
    const es = new EventSource(`/api/macro/event?key=${encodeURIComponent(event.eventKey)}`);
    es.addEventListener("dist", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as Dist;
        const n = Date.now();
        setFlash((f) => {
          const nf = { ...f };
          for (const o of d.outcomes || []) {
            const p = prev.current[o.outcome];
            if (p != null && o.prob != null && o.prob !== p) nf[o.outcome] = { dir: o.prob > p ? "up" : "down", ts: n };
          }
          return nf;
        });
        for (const o of d.outcomes || []) if (o.prob != null) prev.current[o.outcome] = o.prob;
        setDist(d);
        setStatus("live");
      } catch {}
    });
    es.onerror = () => setStatus("error");
    return () => es.close();
  }, [event.eventKey]);

  // Traded volume is REST-only (not on the live feed) — fetch once the live dist is up (the
  // server fingerprints the venue event against the feed mids), then refresh every 5 min.
  const hasDist = dist != null;
  useEffect(() => {
    if (!hasDist) return;
    let alive = true;
    const load = () =>
      fetch(`/api/macro/event/volumes?key=${encodeURIComponent(event.eventKey)}`)
        .then((r) => r.json())
        .then((j) => { if (alive && j?.volumes) setVols(j.volumes); })
        .catch(() => {});
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, [event.eventKey, hasDist]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      setFlash((f) => {
        const n = Date.now();
        let ch = false;
        const o = { ...f };
        for (const k in o) if (n - o[k].ts > 500) { delete o[k]; ch = true; }
        return ch ? o : f;
      });
    }, 300);
    return () => clearInterval(id);
  }, []);

  const outs = dist?.outcomes || [];
  const totalDepth = outs.reduce((s, o) => s + (o.depthUsd || 0), 0);
  const cd = countdown(event.releaseAt, now);

  return (
    <div
      onPointerDown={raise}
      style={style}
      className="fade-in absolute flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#0e0e0e] font-sans tracking-[-0.01em] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
    >
      {/* header — drag handle */}
      <div {...dragHandle} className="flex shrink-0 cursor-move touch-none select-none items-start justify-between gap-3 border-b border-white/[0.06] px-5 pt-4 pb-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-[#8a8a8a]">{event.category ? event.category.replace(/_/g, " ") : "Macro event"}</p>
          <h2 className="mt-1 truncate text-[16px] font-semibold text-white">{event.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {status !== "live" && <span className="text-[10px] uppercase tracking-wider text-[#8a8a8a]">{status === "connecting" ? "connecting…" : "reconnecting…"}</span>}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            title="Close"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#8a8a8a] transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* body */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-3">
        {/* event metadata */}
        {event.description && <p className="text-[11.5px] leading-snug text-white/70">{event.description}</p>}
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <Meta label="Release" value={`${fmtReleaseET(event.releaseAt)}${cd && cd !== "now" ? ` · in ${cd}` : cd === "now" ? " · now" : ""}`} />
          <Meta label="Agency" value={event.agency || "—"} />
          <Meta label="Venues" value={event.venues.map(venueLabel).join(" · ") || "—"} />
          <Meta label="Liquidity" value={fmtUSD(totalDepth)} />
        </div>
        {event.sourceUrl && (
          <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[11px] text-emerald-400 transition-colors hover:text-emerald-300">
            Official release ↗
          </a>
        )}

        {/* outcomes (markets) */}
        <div className="mt-3 border-t border-white/[0.06] pt-1">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-[#8a8a8a]">Outcomes · {outs.length || "…"}</p>
          {!outs.length && <p className="mt-6 animate-pulse text-center text-[12px] text-[#8a8a8a]">Loading live quotes…</p>}
          {outs.map((o) => {
            const fl = flash[o.outcome];
            const div = o.kalshiProb != null && o.polyProb != null ? Math.abs(o.kalshiProb - o.polyProb) : null;
            const strike = parseStrike(o.label);
            const vol = strike != null ? vols[String(strike)] : undefined;
            return (
              <div key={o.outcome} className="border-t border-white/[0.04] py-2 first:border-t-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[12.5px] text-white/90">{o.label}</span>
                  <span className={cn("shrink-0 rounded px-1 text-[13px] font-semibold tabular-nums transition-colors", fl?.dir === "up" ? "bg-emerald-500/25 text-emerald-300" : fl?.dir === "down" ? "bg-rose-500/25 text-rose-300" : "text-emerald-400")}>
                    {pct(o.prob, 1)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-emerald-500/70 transition-[width] duration-500" style={{ width: `${Math.round((o.prob ?? 0) * 100)}%` }} />
                </div>
                {/* per-venue detail */}
                <div className="mt-1.5 flex items-center gap-3 text-[10.5px] tabular-nums text-[#8a8a8a]">
                  <span>Kalshi <span className="text-white/70">{pct(o.kalshiProb, 1)}</span> · {fmtUSD(o.kalshiDepthUsd)}</span>
                  <span>Poly <span className="text-white/70">{pct(o.polyProb, 1)}</span> · {fmtUSD(o.polyDepthUsd)}</span>
                  {vol != null && <span>vol <span className="text-white/70">{fmtUSD(vol)}</span></span>}
                  {div != null && div >= 0.02 && (
                    <span className="ml-auto shrink-0 rounded bg-amber-400/15 px-1 text-[9.5px] font-semibold uppercase tracking-wide text-amber-300">Δ {(div * 100).toFixed(1)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* resize handle */}
      <div
        {...resizeHandle}
        className="absolute bottom-0 right-0 z-20 flex h-7 w-7 cursor-nwse-resize touch-none items-end justify-end p-1.5 text-white/40 transition-colors hover:text-white/80"
        title="Drag to resize"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M11 4L4 11M11 8L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-[#6f6f6f]">{label} </span>
      <span className="text-white/80">{value}</span>
    </div>
  );
}
