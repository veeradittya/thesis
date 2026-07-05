"use client";

import { cn } from "@/lib/utils";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef, useState, type ReactNode } from "react";

// Recreated from Aceternity UI's "floating-dock" (MIT): a macOS-style dock that
// magnifies icons near the cursor.
export interface DockItem {
  title: string;
  icon: ReactNode;
  onClick?: () => void;
  active?: boolean;
}

export function FloatingDock({ items, className }: { items: DockItem[]; className?: string }) {
  const mouseX = useMotionValue(Infinity);
  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        "mx-auto flex h-16 items-end gap-3 rounded-2xl border border-border bg-panel/80 px-4 pb-3 backdrop-blur panel-glow",
        className,
      )}
    >
      {items.map((item, i) => (
        <IconContainer key={i} mouseX={mouseX} item={item} />
      ))}
    </motion.div>
  );
}

function IconContainer({ mouseX, item }: { mouseX: MotionValue<number>; item: DockItem }) {
  const ref = useRef<HTMLButtonElement>(null);
  const distance = useTransform(mouseX, (val) => {
    const b = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - b.x - b.width / 2;
  });
  const sizeT = useTransform(distance, [-140, 0, 140], [42, 68, 42]);
  const iconT = useTransform(distance, [-140, 0, 140], [20, 30, 20]);
  const size = useSpring(sizeT, { mass: 0.1, stiffness: 150, damping: 12 });
  const iconSize = useSpring(iconT, { mass: 0.1, stiffness: 150, damping: 12 });
  const [hovered, setHovered] = useState(false);

  return (
    <button
      ref={ref}
      onClick={item.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative"
    >
      <motion.div
        style={{ width: size, height: size }}
        className={cn(
          "flex items-center justify-center rounded-xl border transition-colors",
          item.active
            ? "bg-crimson/15 border-crimson/40 text-accent"
            : "bg-surface border-border text-text-muted hover:text-text",
        )}
      >
        <AnimatePresence>
          {hovered && (
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 2 }}
              className="absolute -top-9 whitespace-nowrap rounded-md border border-border bg-panel px-2 py-1 text-[11px] text-text"
            >
              {item.title}
            </motion.span>
          )}
        </AnimatePresence>
        <motion.div style={{ width: iconSize, height: iconSize }} className="flex items-center justify-center">
          {item.icon}
        </motion.div>
      </motion.div>
    </button>
  );
}
