"use client";

import { motion } from "motion/react";

// Recreated from Aceternity UI's "loader-one" (MIT): a row of dots bouncing in a wave.
export function LoaderOne() {
  return (
    <div className="flex items-center gap-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-2.5 w-2.5 rounded-full bg-crimson"
          initial={{ y: 0, opacity: 0.4 }}
          animate={{ y: [0, -9, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}
