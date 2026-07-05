"use client";

import { useEffect, useRef, useState } from "react";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Shared z so the last-interacted card comes to the front.
let zTop = 30;

// Movable + resizable card with localStorage persistence (pointer-driven, no deps).
// Position/size are restored from `thesis.layout.<id>` on mount, saved on release.
export function useMovableCard(id: string, def: Box, opts?: { minW?: number; minH?: number }) {
  const minW = opts?.minW ?? 340;
  const minH = opts?.minH ?? 220;
  const [box, setBox] = useState<Box>(def);
  const [z, setZ] = useState(10);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const rez = useRef<{ px: number; py: number; w: number; h: number } | null>(null);

  useEffect(() => {
    if (drag.current || rez.current) return; // never re-place a card mid-interaction
    try {
      const s = localStorage.getItem("thesis.layout." + id);
      if (s) {
        const b = JSON.parse(s);
        if (b && [b.x, b.y, b.w, b.h].every((n) => Number.isFinite(n))) {
          setBox({ x: b.x, y: b.y, w: b.w, h: b.h });
          return;
        }
      }
    } catch {}
    // No saved layout → keep following the (responsive) default, so untouched cards
    // re-pack live when the computed home layout changes with the viewport.
    setBox({ x: def.x, y: def.y, w: def.w, h: def.h });
  }, [id, def.x, def.y, def.w, def.h]);

  const save = (b: Box) => {
    try {
      localStorage.setItem("thesis.layout." + id, JSON.stringify(b));
    } catch {}
  };
  const raise = () => setZ(++zTop);

  const dragHandle = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      raise();
      drag.current = { px: e.clientX, py: e.clientY, x: box.x, y: box.y };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      setBox((b) => ({ ...b, x: Math.max(0, d.x + (e.clientX - d.px)), y: Math.max(0, d.y + (e.clientY - d.py)) }));
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (drag.current) {
        drag.current = null;
        setBox((b) => {
          save(b);
          return b;
        });
      }
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    },
  };

  const resizeHandle = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      raise();
      rez.current = { px: e.clientX, py: e.clientY, w: box.w, h: box.h };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    },
    onPointerMove: (e: React.PointerEvent) => {
      const r = rez.current;
      if (!r) return;
      setBox((b) => ({ ...b, w: Math.max(minW, r.w + (e.clientX - r.px)), h: Math.max(minH, r.h + (e.clientY - r.py)) }));
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (rez.current) {
        rez.current = null;
        setBox((b) => {
          save(b);
          return b;
        });
      }
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    },
  };

  const style: React.CSSProperties = { left: box.x, top: box.y, width: box.w, height: box.h, zIndex: z };
  return { box, z, raise, style, dragHandle, resizeHandle };
}
