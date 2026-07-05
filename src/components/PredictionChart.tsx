"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Shared probability chart for market (single-series) and event (multi-series) cards.
// Labeled + ticked axes, hover crosshair with a timestamp-headed tooltip, optional
// live tail point. The API OHLCV floor is 6h, so 24h is inherently coarse (~4 pts).

export type ChartRange = "24h" | "3d" | "7d" | "30d";
export const CHART_RANGES: ChartRange[] = ["24h", "3d", "7d", "30d"];

export function RangeToggle({ value, onChange }: { value: ChartRange; onChange: (r: ChartRange) => void }) {
  return (
    <div className="flex gap-0.5 rounded-md bg-white/[0.05] p-0.5">
      {CHART_RANGES.map((r) => (
        <button
          key={r}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onChange(r)}
          className={cn(
            "rounded px-1.5 py-0.5 text-[9px] font-medium uppercase leading-none tabular-nums transition-colors",
            value === r ? "bg-white/15 text-white" : "text-[#8a8a8a] hover:text-white",
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  points: Array<{ t: number; c: number }>; // t = epoch ms, c = probability 0..1
  live?: number | null; // optional current value, appended as a tail point at "now"
}

interface EffPoint { t: number; c: number; live?: boolean }

const fmtPct = (c: number) => `${Math.round(c * 100)}%`;
const fmtTick = (t: number, range: ChartRange) => {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return range === "24h"
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const fmtStamp = (t: number, range: ChartRange, isNow: boolean) => {
  if (isNow) return "Now";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (range === "30d") return date;
  return `${date} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
};

const GUT = 30; // left y-axis gutter (px)
const XAX = 15; // bottom x-axis strip (px)

export function PredictionChart({
  series,
  range,
  height = 140,
  area = false,
}: {
  series: ChartSeries[];
  range: ChartRange;
  height?: number;
  area?: boolean; // fill under the line — used for single-series market charts
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null); // fraction 0..1 across the plot box
  const single = series.length === 1;
  const now = Date.now();

  const eff = series.map((s) => {
    const pts: EffPoint[] = s.points
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.c))
      .map((p) => ({ t: p.t, c: p.c }));
    if (s.live != null && Number.isFinite(s.live)) pts.push({ t: now, c: s.live, live: true });
    return { s, pts };
  });

  const allPts = eff.flatMap((e) => e.pts);
  if (allPts.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-white/[0.03] text-[11px] text-[#666]" style={{ height }}>
        No price history
      </div>
    );
  }

  const times = allPts.map((p) => p.t);
  const t0 = Math.min(...times), t1 = Math.max(...times), tSpan = t1 - t0 || 1;
  const cs = allPts.map((p) => p.c);
  let lo = Math.min(...cs), hi = Math.max(...cs);
  const padY = (hi - lo) * 0.15 || 0.02;
  lo = Math.max(0, lo - padY);
  hi = Math.min(1, hi + padY);
  const cSpan = hi - lo || 1;

  const xF = (t: number) => (t - t0) / tSpan; // 0..1
  const yF = (c: number) => 1 - (c - lo) / cSpan; // 0..1 (0 = top)

  const yTicks = [0, 1, 2, 3].map((k) => lo + (cSpan * k) / 3);
  const N = 4;
  const xTicks = Array.from({ length: N }, (_, k) => t0 + (tSpan * k) / (N - 1));

  // Hover → snap to the nearest sampled timestamp, read each series at that point.
  const uniq = [...new Set(times)].sort((a, b) => a - b);
  let hover: { t: number; rows: Array<{ s: ChartSeries; c: number; live: boolean }> } | null = null;
  if (hoverX != null) {
    const tH = t0 + hoverX * tSpan;
    let snap = uniq[0], best = Infinity;
    for (const t of uniq) { const dd = Math.abs(t - tH); if (dd < best) { best = dd; snap = t; } }
    const rows = eff
      .map((e) => {
        let bp: EffPoint | null = null, bd = Infinity;
        for (const p of e.pts) { const dd = Math.abs(p.t - snap); if (dd < bd) { bd = dd; bp = p; } }
        return bp ? { s: e.s, c: bp.c, live: !!bp.live } : null;
      })
      .filter((r): r is { s: ChartSeries; c: number; live: boolean } => r != null)
      .sort((a, b) => b.c - a.c);
    hover = { t: snap, rows };
  }

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    setHoverX(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };

  return (
    <div className="relative select-none" style={{ height }}>
      {/* y-axis labels */}
      <div className="absolute left-0 top-0" style={{ width: GUT, bottom: XAX }}>
        {yTicks.map((v, i) => (
          <span key={i} className="absolute right-1 -translate-y-1/2 text-[9px] tabular-nums text-[#7a7a7a]" style={{ top: `${yF(v) * 100}%` }}>
            {fmtPct(v)}
          </span>
        ))}
      </div>

      {/* plot box */}
      <div ref={ref} className="absolute top-0 cursor-crosshair" style={{ left: GUT, right: 0, bottom: XAX }} onMouseMove={onMove} onMouseLeave={() => setHoverX(null)}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
          {yTicks.map((v, i) => (
            <line key={i} x1="0" x2="100" y1={yF(v) * 100} y2={yF(v) * 100} stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {single && area && eff[0].pts.length >= 2 && (() => {
            const p = eff[0].pts;
            const d =
              `M${(xF(p[0].t) * 100).toFixed(2)},100 ` +
              p.map((pt) => `L${(xF(pt.t) * 100).toFixed(2)},${(yF(pt.c) * 100).toFixed(2)}`).join(" ") +
              ` L${(xF(p[p.length - 1].t) * 100).toFixed(2)},100 Z`;
            return <path d={d} fill={eff[0].s.color} opacity="0.08" />;
          })()}
          {eff.map((e) => {
            if (e.pts.length < 2) return null;
            const d = e.pts.map((p, i) => `${i ? "L" : "M"}${(xF(p.t) * 100).toFixed(2)},${(yF(p.c) * 100).toFixed(2)}`).join(" ");
            return <path key={e.s.key} d={d} fill="none" stroke={e.s.color} strokeWidth={single ? 1.6 : 1.5} strokeLinejoin="round" strokeLinecap="round" opacity="0.95" vectorEffect="non-scaling-stroke" />;
          })}
          {hover && <line x1={xF(hover.t) * 100} x2={xF(hover.t) * 100} y1="0" y2="100" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        </svg>

        {/* live pulsing tip (single-series) */}
        {single && series[0].live != null && (() => {
          const p = eff[0].pts[eff[0].pts.length - 1];
          return (
            <>
              <div className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full" style={{ left: `${xF(p.t) * 100}%`, top: `${yF(p.c) * 100}%`, background: eff[0].s.color, opacity: 0.5 }} />
              <div className="pointer-events-none absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${xF(p.t) * 100}%`, top: `${yF(p.c) * 100}%`, background: eff[0].s.color }} />
            </>
          );
        })()}

        {/* hover dots */}
        {hover?.rows.map((row) => (
          <div key={row.s.key} className="pointer-events-none absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[#0e0e0e]" style={{ left: `${xF(hover!.t) * 100}%`, top: `${yF(row.c) * 100}%`, background: row.s.color }} />
        ))}

        {/* tooltip */}
        {hover && (
          <div className="pointer-events-none absolute top-0 z-10 min-w-[54px] -translate-x-1/2 rounded-md border border-white/10 bg-[#1a1a1a] px-2 py-1 shadow-lg" style={{ left: `${Math.min(80, Math.max(20, xF(hover.t) * 100))}%` }}>
            <div className="mb-0.5 whitespace-nowrap text-[9px] tabular-nums text-[#8a8a8a]">{fmtStamp(hover.t, range, hover.rows.some((r) => r.live))}</div>
            {hover.rows.map((row) => (
              <div key={row.s.key} className="flex items-center gap-1.5 text-[10px] leading-tight">
                {!single && <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: row.s.color }} />}
                {!single && <span className="max-w-[120px] truncate text-white/70">{row.s.label}</span>}
                <span className="ml-auto font-semibold tabular-nums text-white">{fmtPct(row.c)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* x-axis labels */}
      <div className="absolute bottom-0 right-0" style={{ left: GUT, height: XAX }}>
        {xTicks.map((t, i) => {
          const edge = i === 0 ? "left-0" : i === N - 1 ? "right-0" : "-translate-x-1/2";
          const style = i === 0 || i === N - 1 ? undefined : { left: `${xF(t) * 100}%` };
          return (
            <span key={i} className={cn("absolute top-0 whitespace-nowrap text-[9px] tabular-nums text-[#7a7a7a]", edge)} style={style}>
              {fmtTick(t, range)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
