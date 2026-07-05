// Layout for the home cards.
//
// DESKTOP (≥768px): a fill-height packer. Cards are distributed into equal-width
// columns (balanced by their preferred heights), then each column's cards are scaled
// so the column ends EXACTLY at the viewport bottom — the first screen is fully used
// with no dead space below. If the viewport is too short for the width-derived column
// count (cards would squash below MIN_SCALE), extra columns are added to the right for
// density; the region can extend past the viewport and is reached by panning (the main
// scroller hides its scrollbars). One uniform gap everywhere. Reflows on every resize.
//
// MOBILE (<768px): the canvas is replaced by a native vertical stack (see MonacoHome);
// this module just supplies the per-card readable heights for that stack.
//
// These are DEFAULTS: useMovableCard persists any card the user drags/resizes and that
// saved box wins; untouched cards keep following this layout live.

export interface LayoutBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MOBILE_BREAKPOINT = 768;

// Placement priority (leftmost column first). `h` = preferred/basis height used for
// balancing + scaling; `min` = never scale below this (content becomes unreadable).
const HOME_CARDS: Array<{ key: string; h: number; min: number }> = [
  { key: "ledger", h: 470, min: 260 },
  { key: "markets", h: 560, min: 300 },
  { key: "chat", h: 560, min: 300 },
  { key: "whale", h: 420, min: 260 },
  { key: "prices", h: 500, min: 260 },
  { key: "news", h: 560, min: 300 },
  { key: "hours", h: 116, min: 104 },
];

// Readable full-width heights for the mobile stack (charts/lists uncramped at ~350px wide).
export const MOBILE_CARD_HEIGHTS: Record<string, number> = {
  ledger: 470,
  markets: 540,
  chat: 500,
  whale: 430,
  prices: 480,
  news: 540,
  hours: 116,
};

const MIN_COL_W = 340;
const MAX_COL_W = 520;
const MIN_SCALE = 0.6; // below this cards squash → add a column instead

export function computeHomeLayout(viewportW: number, viewportH: number): Record<string, LayoutBox> {
  const margin = 40;
  const gap = 20;
  const top = 110; // clears the floating nav pill
  const bottom = 20;

  const usable = Math.max(320, viewportW - margin * 2);
  const widthCols = Math.min(6, Math.max(1, Math.floor((usable + gap) / (MIN_COL_W + gap))));
  const colW = Math.min(MAX_COL_W, Math.floor((usable - (widthCols - 1) * gap) / widthCols));
  const availH = Math.max(380, viewportH - top - bottom);

  // Balanced assignment: next card → column with the smallest summed basis height.
  const assign = (n: number) => {
    const cols: Array<Array<(typeof HOME_CARDS)[number]>> = Array.from({ length: n }, () => []);
    const sums = Array(n).fill(0);
    for (const card of HOME_CARDS) {
      let best = 0;
      for (let i = 1; i < n; i++) if (sums[i] < sums[best]) best = i;
      cols[best].push(card);
      sums[best] += card.h;
    }
    return { cols, sums };
  };

  // Grow the column count past the width-derived one until nothing squashes below
  // MIN_SCALE (extra columns extend right → panned to, not squeezed in).
  let n = widthCols;
  let picked = assign(n);
  while (n < HOME_CARDS.length) {
    const worst = Math.min(
      ...picked.cols.map((col, i) => (col.length ? (availH - (col.length - 1) * gap) / picked.sums[i] : Infinity)),
    );
    if (worst >= MIN_SCALE) break;
    n += 1;
    picked = assign(n);
  }

  const out: Record<string, LayoutBox> = {};
  picked.cols.forEach((col, ci) => {
    if (!col.length) return;
    const inner = availH - (col.length - 1) * gap;
    const scale = inner / picked.sums[ci];
    // Scale to fill the column exactly; enforce per-card minimums by taking the excess
    // out of the tallest card, and pin the last card to the exact bottom edge.
    let heights = col.map((c) => Math.max(c.min, Math.round(c.h * scale)));
    let excess = heights.reduce((s, h) => s + h, 0) - inner;
    if (excess !== 0) {
      const iTall = heights.indexOf(Math.max(...heights));
      heights[iTall] = Math.max(col[iTall].min, heights[iTall] - excess);
    }
    excess = heights.reduce((s, h) => s + h, 0) - inner;
    if (excess < 0) heights[heights.length - 1] -= excess; // stretch last card to the edge

    let y = top;
    col.forEach((c, ri) => {
      out[c.key] = { x: margin + ci * (colW + gap), y, w: colW, h: heights[ri] };
      y += heights[ri] + gap;
    });
  });
  return out;
}
