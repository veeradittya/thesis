"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMovableCard } from "@/components/ui/useMovableCard";
import { ContextMenu, type MenuItem } from "@/components/ContextMenu";
import { MacroAddPicker } from "@/components/MacroAddPicker";

// Wire types (redeclared — the server module @/lib/macroFeed imports `ws`, so we don't import it here).
interface MacroOutcome { outcome: string; label: string; prob: number | null; kalshiProb: number | null; polyProb: number | null; depthUsd: number }
interface MacroDist { eventKey: string; seq: number; publishedTs: number; outcomes: MacroOutcome[] }
export interface MacroEvent { eventKey: string; title: string; type: string; category: string | null; label: string | null; agency: string | null; description: string | null; sourceUrl: string | null; venues: string[]; releaseAt: string }

const pct = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x * 100)}%`);
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

const DISMISS_KEY = "thesis.macro.dismissed";
const ADD_KEY = "thesis.macro.added";

export function MacroSignalsCard({
  x = 560,
  y = 180,
  width = 440,
  height = 520,
  onClose,
  onOpenEvent,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  onClose: () => void;
  onOpenEvent: (ev: MacroEvent) => void;
}) {
  const { style, dragHandle, resizeHandle, raise } = useMovableCard("macro", { x, y, w: width, h: height }, { minW: 340, minH: 260 });
  const [events, setEvents] = useState<MacroEvent[]>([]);
  const [dists, setDists] = useState<Record<string, MacroDist>>({});
  const [vols, setVols] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState<Record<string, { dir: "up" | "down"; ts: number }>>({});
  const prevTop = useRef<Record<string, number>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]")); } catch { return new Set(); }
  });
  const [added, setAdded] = useState<MacroEvent[]>(() => {
    try { return JSON.parse(localStorage.getItem(ADD_KEY) || "[]"); } catch { return []; }
  });
  const [menu, setMenu] = useState<{ vx: number; vy: number; eventKey: string | null } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Merge a distribution into state + flash the pill on a top-outcome change.
  const applyDist = useCallback((d: MacroDist) => {
    const top = d.outcomes?.[0]?.prob ?? null;
    const prev = prevTop.current[d.eventKey];
    if (top != null && prev != null && top !== prev) setFlash((f) => ({ ...f, [d.eventKey]: { dir: top > prev ? "up" : "down", ts: Date.now() } }));
    if (top != null) prevTop.current[d.eventKey] = top;
    setDists((p) => ({ ...p, [d.eventKey]: d }));
    setStatus("live");
  }, []);

  // Default set: catalog + live distributions.
  useEffect(() => {
    const es = new EventSource("/api/macro");
    es.addEventListener("catalog", (e) => { try { setEvents(JSON.parse((e as MessageEvent).data)); setStatus("live"); } catch {} });
    es.addEventListener("dist", (e) => { try { applyDist(JSON.parse((e as MessageEvent).data)); } catch {} });
    es.onerror = () => setStatus("error");
    return () => es.close();
  }, [applyDist]);

  // Volume (REST batch for the default set) — give dist a few seconds, then poll.
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/macro/volumes").then((r) => r.json()).then((j) => { if (alive && j?.volumes) setVols((p) => ({ ...p, ...j.volumes })); }).catch(() => {});
    const t = setTimeout(load, 3000);
    const id = setInterval(load, 120000);
    return () => { alive = false; clearTimeout(t); clearInterval(id); };
  }, []);

  // Added (non-default) signals each get their own live dist stream + a volume lookup.
  const extraStr = added.filter((a) => !events.some((e) => e.eventKey === a.eventKey)).map((a) => a.eventKey).join("|");
  useEffect(() => {
    if (!extraStr) return;
    const keys = extraStr.split("|");
    const srcs = keys.map((k) => {
      const es = new EventSource(`/api/macro/event?key=${encodeURIComponent(k)}`);
      es.addEventListener("dist", (e) => { try { applyDist(JSON.parse((e as MessageEvent).data)); } catch {} });
      return es;
    });
    const vt = setTimeout(() => {
      keys.forEach((k) =>
        fetch(`/api/macro/event/volumes?key=${encodeURIComponent(k)}`).then((r) => r.json()).then((j) => {
          if (j?.volumes) { const tot = Object.values(j.volumes as Record<string, number>).reduce((s, v) => s + v, 0); if (tot > 0) setVols((p) => ({ ...p, [k]: tot })); }
        }).catch(() => {}),
      );
    }, 3500);
    return () => { srcs.forEach((es) => es.close()); clearTimeout(vt); };
  }, [extraStr, applyDist]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      setFlash((f) => { const n = Date.now(); let ch = false; const o = { ...f }; for (const k in o) if (n - o[k].ts > 500) { delete o[k]; ch = true; } return ch ? o : f; });
    }, 300);
    return () => clearInterval(id);
  }, []);

  const dismiss = (key: string) => {
    setDismissed((prev) => { const n = new Set(prev); n.add(key); try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...n])); } catch {} return n; });
    setMenu(null);
  };
  const addSignal = (ev: MacroEvent) => {
    setDismissed((prev) => { if (!prev.has(ev.eventKey)) return prev; const n = new Set(prev); n.delete(ev.eventKey); try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...n])); } catch {} return n; });
    setAdded((prev) => {
      if (events.some((e) => e.eventKey === ev.eventKey) || prev.some((a) => a.eventKey === ev.eventKey)) return prev;
      const n = [...prev, ev];
      try { localStorage.setItem(ADD_KEY, JSON.stringify(n)); } catch {}
      return n;
    });
    setPickerOpen(false);
  };

  const onContextMenu = (e: React.MouseEvent) => {
    const row = (e.target as HTMLElement).closest("[data-event-key]") as HTMLElement | null;
    e.preventDefault();
    e.stopPropagation(); // suppress the global platform menu while over this card
    setMenu({ vx: e.clientX, vy: e.clientY, eventKey: row?.dataset.eventKey || null });
  };

  const byKey = new Map<string, MacroEvent>();
  for (const e of [...events, ...added]) if (!byKey.has(e.eventKey)) byKey.set(e.eventKey, e);
  const shown = [...byKey.values()].filter((e) => !dismissed.has(e.eventKey)).sort((a, b) => Date.parse(a.releaseAt) - Date.parse(b.releaseAt));

  const menuItems: MenuItem[] = menu
    ? [{ label: "Add Signal", onClick: () => setPickerOpen(true) }, ...(menu.eventKey ? [{ label: "Close Signal", onClick: () => dismiss(menu.eventKey as string) }] : [])]
    : [];

  return (
    <div
      onPointerDown={raise}
      onContextMenu={onContextMenu}
      style={style}
      className="fade-in absolute flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#0e0e0e] font-sans tracking-[-0.01em] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
    >
      {/* header — drag handle */}
      <div {...dragHandle} className="flex shrink-0 cursor-move touch-none select-none items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Macro Signals</h2>
        </div>
        <div className="flex items-center gap-2">
          {status !== "live" && (
            <span className="text-[10px] uppercase tracking-wider text-[#8a8a8a]">{status === "connecting" ? "connecting…" : "reconnecting…"}</span>
          )}
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

      {/* body — event rows */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-1.5">
        {status === "connecting" && !shown.length && <p className="mt-10 animate-pulse text-center text-[13px] text-[#8a8a8a]">Connecting to macro feed…</p>}
        {status === "error" && !shown.length && <p className="mt-10 text-center text-[13px] text-rose-400">Macro feed unavailable.</p>}
        {status === "live" && !shown.length && (
          <p className="mt-10 text-center text-[12px] text-[#666]">No signals — right-click → Add Signal.</p>
        )}

        {shown.map((ev) => {
          const d = dists[ev.eventKey];
          const top = d?.outcomes?.[0];
          const liq = (d?.outcomes || []).reduce((s, o) => s + (o.depthUsd || 0), 0);
          const vol = vols[ev.eventKey];
          const cd = countdown(ev.releaseAt, now);
          const t = Date.parse(ev.releaseAt);
          const soon = !isNaN(t) && t - now < 24 * 3600_000;
          const fl = flash[ev.eventKey];
          return (
            <div key={ev.eventKey} data-event-key={ev.eventKey} className="border-t border-white/[0.06] py-2.5 first:border-t-0">
              <button onClick={() => onOpenEvent(ev)} title="Open event detail · right-click to add/close" className="group block w-full text-left">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[12.5px] font-medium text-white/90 group-hover:text-white">{ev.title}</span>
                  <span className={cn("shrink-0 text-[11px] tabular-nums", cd === "now" || soon ? "text-amber-300" : "text-[#8a8a8a]")}>
                    {cd === "now" ? "now" : `in ${cd}`}
                  </span>
                </div>
                {d ? (
                  <div className="mt-1 flex items-center gap-3 text-[11px] tabular-nums text-[#8a8a8a]">
                    <span className="shrink-0">Liq <span className="text-white/80">{liq > 0 ? fmtUSD(liq) : "—"}</span></span>
                    <span className="shrink-0">Vol <span className="text-white/80">{vol != null ? fmtUSD(vol) : "—"}</span></span>
                    {top && (
                      <span className="ml-auto flex min-w-0 items-center gap-1.5" title={`Leading: ${top.label}`}>
                        <span className="truncate text-[10.5px] text-[#8a8a8a]">{top.label}</span>
                        <span className={cn("shrink-0 rounded px-1 py-px text-[10px] font-semibold transition-colors", fl?.dir === "up" ? "bg-emerald-500/25 text-emerald-300" : fl?.dir === "down" ? "bg-rose-500/25 text-rose-300" : "bg-white/[0.06] text-emerald-400")}>
                        {pct(top.prob)}
                        </span>
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-[#666]">Awaiting quotes…</p>
                )}
              </button>
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
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M11 4L4 11M11 8L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </div>

      {menu && <ContextMenu x={menu.vx} y={menu.vy} items={menuItems} onClose={() => setMenu(null)} />}
      {pickerOpen && <MacroAddPicker excludeKeys={shown.map((e) => e.eventKey)} onPick={addSignal} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
