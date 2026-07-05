"use client";

import { useEffect, useState } from "react";
import type { MacroEvent } from "@/components/MacroSignalsCard";

function whenLabel(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const d = t - Date.now();
  if (d <= 0) return "now";
  const h = Math.floor(d / 3600_000);
  if (h < 48) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d`;
}

// Floating picker of available macro signals to add to the card.
export function MacroAddPicker({ excludeKeys, onPick, onClose }: { excludeKeys: string[]; onPick: (ev: MacroEvent) => void; onClose: () => void }) {
  const [events, setEvents] = useState<MacroEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/macro/catalog")
      .then((r) => r.json())
      .then((j) => { if (alive) { setEvents(j?.events || []); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const avail = events.filter((e) => !excludeKeys.includes(e.eventKey));

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onPointerDown={onClose}>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-[400px] flex-col overflow-hidden rounded-[16px] border border-white/10 bg-[#0e0e0e] font-sans tracking-[-0.01em] shadow-[0_24px_70px_rgba(0,0,0,0.65)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#8a8a8a]">Macro Signals</p>
            <h3 className="mt-0.5 text-[14px] font-semibold text-white">Add a signal</h3>
          </div>
          <button onClick={onClose} title="Close" className="grid h-6 w-6 place-items-center rounded-full text-[#8a8a8a] transition-colors hover:bg-white/10 hover:text-white">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading && <p className="mt-8 animate-pulse text-center text-[13px] text-[#8a8a8a]">Loading catalog…</p>}
          {!loading && !avail.length && <p className="mt-8 text-center text-[12px] text-[#666]">No more signals to add.</p>}
          {avail.map((ev) => (
            <button
              key={ev.eventKey}
              onClick={() => onPick(ev)}
              className="flex w-full items-center justify-between gap-3 rounded-[8px] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]"
            >
              <div className="min-w-0">
                <p className="truncate text-[12.5px] text-white/90">{ev.title}</p>
                <p className="mt-0.5 text-[10.5px] text-[#8a8a8a]">
                  {ev.category ? ev.category.replace(/_/g, " ") : ev.type}
                  {ev.venues.length ? ` · ${ev.venues.map((v) => (v === "kalshi" ? "Kalshi" : v === "polymarket" ? "Polymarket" : v)).join("+")}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-[#8a8a8a]">{whenLabel(ev.releaseAt)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
