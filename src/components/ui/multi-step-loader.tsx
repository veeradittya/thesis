"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Recreated from Aceternity UI "multi-step-loader" (MIT), adapted to live inline (not a
// full-screen modal). The active step sits dead center; steps fade as they move away from
// it, and the ones already passed ("leaving") fade fastest. A vertical mask vignettes the
// top and bottom so steps dissolve at the edges. Loops until unmounted.
export function MultiStepLoader({
  states,
  duration = 2900,
  itemGap = 46,
  loop = true,
  onComplete,
}: {
  states: string[];
  duration?: number;
  itemGap?: number;
  loop?: boolean;
  onComplete?: () => void;
}) {
  const [value, setValue] = useState(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    const last = states.length - 1;
    if (value >= last) {
      // Reached the end: loop back, or (one-pass) hold the last item then signal completion.
      if (loop) {
        const t = setTimeout(() => setValue(0), duration);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => onCompleteRef.current?.(), duration);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setValue((p) => p + 1), duration);
    return () => clearTimeout(t);
  }, [value, duration, states.length, loop]);

  return (
    <div
      className="relative h-64 w-full overflow-hidden"
      style={{
        WebkitMaskImage: "linear-gradient(to bottom, transparent 2%, black 30%, black 70%, transparent 98%)",
        maskImage: "linear-gradient(to bottom, transparent 2%, black 30%, black 70%, transparent 98%)",
      }}
    >
      {states.map((text, index) => {
        const offset = index - value;
        const distance = Math.abs(offset);
        const leaving = offset < 0;
        const opacity = Math.max(1 - distance * (leaving ? 0.7 : 0.34), 0);
        const active = offset === 0;
        return (
          <div key={index} className="absolute left-1/2 top-1/2 w-max max-w-[88vw] -translate-x-1/2 -translate-y-1/2">
            <motion.div
              className="flex items-center gap-3 whitespace-nowrap"
              initial={false}
              animate={{ y: offset * itemGap, opacity }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            >
              <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                {active && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-60" />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-1.5 w-1.5 rounded-full",
                    active ? "bg-crimson" : leaving ? "bg-crimson/40" : "bg-text-muted/40",
                  )}
                />
              </span>
              <span className={cn("text-[15px] transition-colors", active ? "font-medium text-accent" : "text-text-muted")}>
                {text}
              </span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
