"use client";

import { motion, useDragControls } from "motion/react";
import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

// Shared stacking counter so the last-interacted card comes to the front.
let zCounter = 20;

export function MovableCard({
  children,
  title,
  x = 24,
  y = 24,
  width = 880,
  height = 660,
  minWidth = 340,
  className,
}: {
  children: ReactNode;
  title?: ReactNode;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  className?: string;
}) {
  const controls = useDragControls();
  const [z, setZ] = useState(10);
  const raise = () => setZ(++zCounter);

  return (
    <motion.div
      drag
      dragControls={controls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0}
      onPointerDown={raise}
      style={{ left: x, top: y, width, height, minWidth, zIndex: z }}
      className={cn(
        "absolute flex max-h-[calc(100%-2rem)] min-h-[220px] max-w-[calc(100%-2rem)] resize flex-col overflow-hidden rounded-xl border border-border bg-panel text-text shadow-sm",
        className,
      )}
    >
      {/* drag handle — subtle grip, doubles as an optional label bar */}
      <div
        onPointerDown={(e) => controls.start(e)}
        className="flex h-7 shrink-0 cursor-move select-none items-center gap-2 border-b border-border bg-panel px-3"
      >
        <svg width="14" height="8" viewBox="0 0 14 8" fill="currentColor" className="text-text-muted/45">
          <circle cx="2" cy="2" r="1" />
          <circle cx="7" cy="2" r="1" />
          <circle cx="12" cy="2" r="1" />
          <circle cx="2" cy="6" r="1" />
          <circle cx="7" cy="6" r="1" />
          <circle cx="12" cy="6" r="1" />
        </svg>
        {title && <span className="truncate text-[11px] tracking-wide text-text-muted">{title}</span>}
      </div>

      {/* body */}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>

      {/* resize affordance */}
      <span className="pointer-events-none absolute bottom-1 right-1 text-text-muted/50">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M11 5L5 11M11 9L9 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </span>
    </motion.div>
  );
}
