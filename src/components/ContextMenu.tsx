"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Global right-click menu for the platform canvas. Supports nested submenus.
export interface MenuItem {
  label: string;
  onClick?: () => void;
  children?: MenuItem[];
  disabled?: boolean;
  hint?: string;
}

const PANEL =
  "min-w-[190px] rounded-[12px] border border-white/10 bg-[#0e0e0e]/95 p-1 font-sans tracking-[-0.01em] shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-xl";

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Clamp the root panel inside the viewport.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = x + r.width > window.innerWidth - 8 ? Math.max(8, x - r.width) : x;
    const ny = y + r.height > window.innerHeight - 8 ? Math.max(8, window.innerHeight - r.height - 8) : y;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100]"
      onPointerDown={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
    >
      <div ref={ref} style={{ left: pos.x, top: pos.y }} className={cn("fixed", PANEL)} onPointerDown={(e) => e.stopPropagation()}>
        <MenuList items={items} onClose={onClose} />
      </div>
    </div>
  );
}

function MenuList({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      {items.map((it, i) => {
        const kids = it.children?.length ? it.children : null;
        return (
          <div key={i} className="relative" onMouseEnter={() => setOpen(i)} onMouseLeave={() => setOpen((o) => (o === i ? null : o))}>
            <button
              disabled={it.disabled}
              onClick={() => {
                if (kids) return;
                it.onClick?.();
                onClose();
              }}
              className={cn(
                "flex w-full items-center justify-between gap-6 rounded-[8px] px-2.5 py-[7px] text-left text-[13px] transition-colors",
                it.disabled ? "cursor-default text-white/25" : "text-white/85 hover:bg-white/[0.07] hover:text-white",
              )}
            >
              <span className="truncate">{it.label}</span>
              {kids ? <span className="text-white/40">›</span> : it.hint ? <span className="text-[11px] text-white/35">{it.hint}</span> : null}
            </button>
            {kids && open === i && <Submenu items={kids} onClose={onClose} />}
          </div>
        );
      })}
    </>
  );
}

function Submenu({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.getBoundingClientRect().right > window.innerWidth - 8) setFlip(true);
  }, []);
  return (
    <div ref={ref} className={cn("absolute top-[-5px] z-10", flip ? "right-full" : "left-full", PANEL)}>
      <MenuList items={items} onClose={onClose} />
    </div>
  );
}
