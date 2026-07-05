"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMovableCard } from "@/components/ui/useMovableCard";
import { computeMarketState } from "@/lib/marketHours";

export function MarketHoursCard({
  x = 1080,
  y = 690,
  width = 300,
  height = 116,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  const { style, dragHandle, resizeHandle, raise } = useMovableCard("hours", { x, y, w: width, h: height }, { minW: 220, minH: 100 });
  const [now, setNow] = useState<Date | null>(null);

  // Live tick — re-render every second. Null until mounted to avoid hydration mismatch.
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const s = now ? computeMarketState(now) : null;
  const isOpen = s?.phase === "open";
  const labelColor = !s ? "text-[#8a8a8a]" : isOpen ? "text-emerald-400" : "text-rose-500";

  return (
    <div
      onPointerDown={raise}
      style={style}
      className="fade-in absolute flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#0e0e0e] font-sans tracking-[-0.01em] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
    >
      <div {...dragHandle} className="flex h-full cursor-move touch-none select-none flex-col items-center justify-center gap-1.5 p-5 text-center">
        <span className={cn("text-[11px] font-semibold uppercase tracking-wider", labelColor)}>NYSE · Nasdaq</span>

        <div className="flex items-baseline gap-1.5">
          <span className="text-[25px] font-semibold tabular-nums leading-none text-white">{s ? s.clock : "—"}</span>
          <span className="text-[12px] text-[#8a8a8a]">ET</span>
        </div>

        <span className="text-[12.5px] text-[#8a8a8a]">{s ? `${s.countdownLabel} ${s.countdownText}` : ""}</span>
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
