"use client";

import { motion } from "motion/react";

// A single emerald base with one bright sheen that sweeps across the whole word.
// Every letter shares the same color at any instant, so the light reads as one smooth
// highlight instead of a patchwork of per-letter shades.
export function ColourfulText({ text }: { text: string }) {
  return (
    <motion.span
      className="inline-block bg-clip-text font-semibold text-transparent"
      style={{
        backgroundImage:
          "linear-gradient(100deg, var(--color-crimson) 0%, var(--color-crimson) 42%, oklch(0.93 0.08 162) 50%, var(--color-crimson) 58%, var(--color-crimson) 100%)",
        backgroundSize: "220% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
      }}
      animate={{ backgroundPosition: ["160% 0%", "-60% 0%"] }}
      transition={{ duration: 3.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.9 }}
    >
      {text}
    </motion.span>
  );
}
