// Responsive default layout for the home-canvas cards (monaco.com-style masonry).
// Given the viewport width it packs the card set into N equal-width columns with a
// UNIFORM gap everywhere (between columns and between stacked cards) and no holes:
// each card lands in the column (or column-span window) with the lowest skyline.
// Phones resolve to a single column → cards stack sequentially under the nav.
//
// These are only the DEFAULTS: useMovableCard persists any card the user drags or
// resizes and that saved box always wins; untouched cards keep following this layout
// (including live window resizes).

export interface LayoutBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Placement priority (also the top-to-bottom order on phones). Heights are each
// card's designed height; `span` lets the wide whale table cover two columns.
const HOME_CARDS: Array<{ key: string; h: number; span?: number }> = [
  { key: "ledger", h: 470 },
  { key: "markets", h: 560 },
  { key: "chat", h: 560 },
  { key: "whale", h: 300, span: 2 },
  { key: "prices", h: 500 },
  { key: "news", h: 560 },
  { key: "hours", h: 116 },
];

const MIN_COL_W = 340; // below this a card's content cramps
const MAX_COL_W = 520; // beyond this cards look bloated — extra width becomes side margin

export function computeHomeLayout(viewportW: number): Record<string, LayoutBox> {
  const mobile = viewportW < 640;
  const margin = mobile ? 14 : 40; // canvas edge inset
  const gap = mobile ? 14 : 20; // THE uniform gap (columns + stacked cards)
  const top = mobile ? 96 : 110; // clears the floating nav pill (top 24 + 55 high)

  const usable = Math.max(280, viewportW - margin * 2);
  const cols = Math.min(6, Math.max(1, Math.floor((usable + gap) / (MIN_COL_W + gap))));
  const colW = Math.min(MAX_COL_W, Math.floor((usable - (cols - 1) * gap) / cols));
  // Center the packed region when the column cap leaves spare width (large screens).
  const regionW = cols * colW + (cols - 1) * gap;
  const left = margin + Math.max(0, Math.floor((usable - regionW) / 2));

  // Skyline per column; seeded at top-gap so `y = skyline + gap` is uniform for row 1 too.
  const colH: number[] = Array(cols).fill(top - gap);
  const out: Record<string, LayoutBox> = {};

  for (const card of HOME_CARDS) {
    const span = Math.min(card.span ?? 1, cols);
    // Pick the span-window with the lowest skyline; tie-break on least "waste"
    // (skyline raised under the card), so a spanning card never buries an empty column.
    let best = 0;
    let bestY = Infinity;
    let bestWaste = Infinity;
    for (let i = 0; i + span <= cols; i++) {
      const win = colH.slice(i, i + span);
      const y = Math.max(...win);
      const waste = win.reduce((s, h) => s + (y - h), 0);
      if (y < bestY || (y === bestY && waste < bestWaste)) {
        best = i;
        bestY = y;
        bestWaste = waste;
      }
    }
    const y = bestY + gap;
    out[card.key] = { x: left + best * (colW + gap), y, w: colW * span + gap * (span - 1), h: card.h };
    for (let i = best; i < best + span; i++) colH[i] = y + card.h;
  }
  return out;
}
