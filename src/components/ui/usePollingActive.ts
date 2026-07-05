"use client";

import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";

// Returns a ref whose `.current` is true only when the tab is visible AND the card
// is on-screen. Poll effects should do their initial fetch unconditionally, then
// gate the recurring interval on this ref — e.g.
//   const id = setInterval(() => { if (activeRef.current) load(); }, 6000);
// This pauses network polling for hidden tabs and cards scrolled off the canvas,
// keeping the Oddpool request budget in check when many detail cards are open —
// without re-rendering the card or tearing down effects (which would drop an
// in-flight initial fetch).
export function usePollingActive(ref: RefObject<HTMLElement | null>): MutableRefObject<boolean> {
  const activeRef = useRef(true);
  useEffect(() => {
    const el = ref.current;
    let visible = typeof document === "undefined" || document.visibilityState === "visible";
    let onScreen = true;
    const update = () => { activeRef.current = visible && onScreen; };
    const onVis = () => { visible = document.visibilityState === "visible"; update(); };
    document.addEventListener("visibilitychange", onVis);
    let io: IntersectionObserver | undefined;
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entries) => { onScreen = entries.some((e) => e.isIntersecting); update(); }, { threshold: 0 });
      io.observe(el);
    }
    update();
    return () => { document.removeEventListener("visibilitychange", onVis); io?.disconnect(); };
  }, [ref]);
  return activeRef;
}
