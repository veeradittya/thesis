"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useMovableCard } from "@/components/ui/useMovableCard";

interface Pt {
  t: number;
  c: number;
}

const fmtTime = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const fmtPrice = (v: number | null) => (v == null ? "—" : v.toFixed(2));

function Chart({ points, prevClose }: { points: Pt[]; prevClose: number | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(544); // coordinate width = the SVG's real pixel width, so 1 unit = 1px (no text distortion)
  const H = 200, padL = 46, padR = 12, padT = 12, padB = 22;

  // Match the SVG's internal coordinate width to its rendered pixel width. Without this the fixed
  // viewBox stretched non-uniformly and squashed all the text.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => { const w = Math.round(el.getBoundingClientRect().width); if (w > 0) setW(w); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  let body: ReactNode;
  if (points.length < 2) {
    body = <div className="grid h-[200px] place-items-center text-[12px] text-[#8a8a8a]">Waiting for live data…</div>;
  } else {
    const cs = points.map((p) => p.c);
    let lo = Math.min(...cs), hi = Math.max(...cs);
    if (prevClose != null) { lo = Math.min(lo, prevClose); hi = Math.max(hi, prevClose); }
    const span = hi - lo || 1;
    lo -= span * 0.08; hi += span * 0.08;
    const t0 = points[0].t, t1 = points[points.length - 1].t;
    const X = (t: number) => padL + ((t - t0) / (t1 - t0 || 1)) * (W - padL - padR);
    const Y = (c: number) => padT + (1 - (c - lo) / (hi - lo || 1)) * (H - padT - padB);

    const line = points.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.c).toFixed(1)}`).join(" ");
    const last = points[points.length - 1];
    const up = prevClose != null ? last.c >= prevClose : last.c >= points[0].c;
    const stroke = up ? "#34d399" : "#f87171";
    const area = `${line} L${X(t1).toFixed(1)},${(H - padB).toFixed(1)} L${X(t0).toFixed(1)},${(H - padB).toFixed(1)} Z`;
    const hp = hover != null ? points[hover] : null;
    const tipX = hp ? Math.min(Math.max(X(hp.t), 54), W - 54) : 0;

    body = (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: "block" }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const tt = t0 + ((px - padL) / (W - padL - padR)) * (t1 - t0);
          let bi = 0, bd = Infinity;
          for (let i = 0; i < points.length; i++) { const dd = Math.abs(points[i].t - tt); if (dd < bd) { bd = dd; bi = i; } }
          setHover(bi);
        }}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((f) => {
          const yv = hi - (hi - lo) * f, yy = Y(yv);
          return (
            <g key={f}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#ffffff" strokeOpacity="0.05" />
              <text x={padL - 6} y={yy + 3} textAnchor="end" fontSize="9" fill="#8a8a8a">{yv.toFixed(2)}</text>
            </g>
          );
        })}
        {prevClose != null && (
          <line x1={padL} y1={Y(prevClose)} x2={W - padR} y2={Y(prevClose)} stroke="#8a8a8a" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="4 3" />
        )}
        <defs>
          <linearGradient id={`grad-${stroke}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#grad-${stroke})`} />
        <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={X(last.t)} cy={Y(last.c)} r="3" fill={stroke} />
        <circle cx={X(last.t)} cy={Y(last.c)} r="3" fill={stroke}>
          <animate attributeName="r" values="3;8" dur="1.3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.55;0" dur="1.3s" repeatCount="indefinite" />
        </circle>
        <text x={padL} y={H - 6} fontSize="9" fill="#8a8a8a">{fmtTime(t0)}</text>
        <text x={W - padR} y={H - 6} textAnchor="end" fontSize="9" fill="#8a8a8a">{fmtTime(t1)}</text>
        {hp && (
          <g>
            <line x1={X(hp.t)} y1={padT} x2={X(hp.t)} y2={H - padB} stroke="#ffffff" strokeOpacity="0.18" />
            <circle cx={X(hp.t)} cy={Y(hp.c)} r="3" fill="#fff" />
            <g transform={`translate(${tipX},${padT + 2})`}>
              <rect x="-50" y="0" width="100" height="30" rx="5" fill="#1a1a1a" stroke="#ffffff" strokeOpacity="0.12" />
              <text x="0" y="13" textAnchor="middle" fontSize="10.5" fill="#fff">{hp.c.toFixed(2)}</text>
              <text x="0" y="24" textAnchor="middle" fontSize="8.5" fill="#8a8a8a">{fmtTime(hp.t)}</text>
            </g>
          </g>
        )}
      </svg>
    );
  }

  return <div ref={wrapRef} style={{ width: "100%" }}>{body}</div>;
}

export function ChartCard({
  symbol,
  name,
  x = 120,
  y = 140,
  onClose,
}: {
  symbol: string;
  name: string | null;
  x?: number;
  y?: number;
  onClose: () => void;
}) {
  const { style, dragHandle, resizeHandle, raise } = useMovableCard(`chart:${symbol}`, { x, y, w: 560, h: 340 }, { minW: 380, minH: 260 });
  const [seed, setSeed] = useState<Pt[]>([]);
  const [tail, setTail] = useState<Pt[]>([]);
  const [cur, setCur] = useState<{ price: number | null; prevClose: number | null; percent: number | null }>({ price: null, prevClose: null, percent: null });
  const [err, setErr] = useState<string | null>(null);

  // Intraday history seed
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/prices/history?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) { if (j.error) setErr(j.error); else setSeed(j.points || []); } })
      .catch(() => !cancelled && setErr("Couldn't load chart history."));
    return () => { cancelled = true; };
  }, [symbol]);

  // Live ticks via the shared price stream
  useEffect(() => {
    const es = new EventSource(`/api/prices?symbols=${encodeURIComponent(symbol)}`);
    es.addEventListener("snapshot", (e) => {
      try {
        const q = JSON.parse((e as MessageEvent).data)[symbol];
        if (q) setCur({ price: q.price, prevClose: q.prevClose, percent: q.percent });
      } catch {}
    });
    es.addEventListener("trade", (e) => {
      try {
        const t = JSON.parse((e as MessageEvent).data)[symbol];
        if (!t) return;
        const now = t.t > 1e12 ? t.t : Date.now(); // Finnhub WS ts is ms
        setCur((c) => ({ price: t.p, prevClose: c.prevClose, percent: c.prevClose ? ((t.p - c.prevClose) / c.prevClose) * 100 : c.percent }));
        // Throttle: extend the line ~every 8s, otherwise update the latest point in place.
        setTail((prev) => {
          const np = prev.slice();
          if (np.length && now - np[np.length - 1].t < 8000) np[np.length - 1] = { t: now, c: t.p };
          else np.push({ t: now, c: t.p });
          return np.slice(-400);
        });
      } catch {}
    });
    return () => es.close();
  }, [symbol]);

  const points = seed.length || tail.length ? [...seed, ...tail] : [];
  const price = cur.price ?? (points.length ? points[points.length - 1].c : null);
  const up = (cur.percent ?? 0) >= 0;
  // The session date (ET) of the data shown — clarifies when the market is closed and the chart
  // is the last real session rather than today.
  const sessionDate = points.length
    ? new Date(points[points.length - 1].t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })
    : null;

  return (
    <div
      onPointerDown={raise}
      style={style}
      className="fade-in absolute flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#0e0e0e] font-sans tracking-[-0.01em] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
    >
      {/* header — drag handle */}
      <div {...dragHandle} className="flex shrink-0 cursor-move touch-none select-none items-start justify-between gap-3 border-b border-white/[0.06] px-5 pt-4 pb-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-white">{symbol}</p>
          {name && <p className="truncate text-[11px] text-[#8a8a8a]">{name}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[16px] font-semibold tabular-nums leading-none text-white">{fmtPrice(price)}</p>
            <p className={cn("mt-1 text-[11px] tabular-nums", cur.percent == null ? "text-[#8a8a8a]" : up ? "text-emerald-400" : "text-rose-400")}>
              {cur.percent == null ? "" : `${cur.percent >= 0 ? "+" : ""}${cur.percent.toFixed(2)}%`}
            </p>
          </div>
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

      {/* chart */}
      <div className="min-h-0 flex-1 px-2 py-3">
        {err && !points.length ? (
          <div className="grid h-full place-items-center text-[12px] text-rose-400">{err}</div>
        ) : (
          <Chart points={points} prevClose={cur.prevClose} />
        )}
      </div>

      <div className="shrink-0 px-5 pb-2 text-[10px] text-[#8a8a8a]">
        {sessionDate && <span className="font-medium text-white/70">{sessionDate}</span>}
        {sessionDate ? " · " : ""}Intraday · 5-min seed + live ticks · prev close dashed
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
