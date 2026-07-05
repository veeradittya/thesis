"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

// Recreated from Aceternity UI "glowing-stars" (MIT). A dense star grid where a handful
// of random stars scale up and bloom with a soft emerald glow, then settle, on a loop.
// Adapted to render full-bleed as a page background.
export function GlowingStarsBackground({ columns = 26, rows = 16 }: { columns?: number; rows?: number }) {
  const total = columns * rows;
  const [glowing, setGlowing] = useState<number[]>([]);

  useEffect(() => {
    const pick = () => {
      const n = Math.max(5, Math.floor(total * 0.013));
      setGlowing(Array.from({ length: n }, () => Math.floor(Math.random() * total)));
    };
    pick();
    const id = setInterval(pick, 2600);
    return () => clearInterval(id);
  }, [total]);

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: "1px",
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const on = glowing.includes(i);
        const delay = (i % 12) * 0.08;
        return (
          <div key={i} className="relative flex items-center justify-center">
            <Star on={on} delay={delay} />
            <AnimatePresence>{on && <Glow delay={delay} />}</AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

const Star = ({ on, delay }: { on: boolean; delay: number }) => (
  <motion.div
    initial={{ scale: 1, opacity: 0.45 }}
    animate={{ scale: on ? [1, 1.2, 2.6, 2.2, 1.5] : 1, opacity: on ? 1 : 0.45 }}
    transition={{ duration: 2.2, ease: "easeInOut", delay }}
    className="h-[1px] w-[1px] rounded-full"
    style={{ background: on ? "#ffffff" : "var(--color-text-muted)" }}
  />
);

const Glow = ({ delay }: { delay: number }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 2.2, ease: "easeInOut", delay }}
    className="absolute left-1/2 top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full"
    style={{
      background: "#ffffff",
      filter: "blur(1px)",
      boxShadow: "0 0 10px 1.5px rgba(255,255,255,0.9)",
    }}
  />
);
