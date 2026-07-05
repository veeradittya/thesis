"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMovableCard } from "@/components/ui/useMovableCard";
import { ContextMenu } from "@/components/ContextMenu";
import type { NewsItem } from "@/lib/guardian";

const POLL_MS = 120_000; // server caches 5 min; this just keeps the card fresh

const isLiveBlog = (t: string) => /[–—-]\s*(live|as it happened)\s*$/i.test((t || "").trim());

// Live-blog bylines tag the writer currently on the blog with "(now)" — show that author
// (fall back to the lead author when there's no "(now)" tag).
function currentAuthor(byline: string): string {
  const now = byline.match(/([^;,]+?)\s*\(now\)/i);
  if (now) return now[1].trim();
  const cleaned = byline.replace(/\s*\((?:now|earlier|then)\)/gi, " ").replace(/\s+/g, " ").trim();
  return cleaned.split(/\s*(?:;|,|\band\b)\s*/i).map((s) => s.trim()).filter(Boolean)[0] || cleaned;
}

function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// The Guardian's logo — the fallback when a piece has no image.
const GUARDIAN_LOGO = "https://assets.guim.co.uk/images/guardian-logo-rss.c45beb1bafa34b347ac333af2e6fe23f.png";

// Thumbnail that degrades gracefully: falls back to the Guardian logo — never a broken <img>.
function Thumb({ src, alt }: { src: string | null; alt: string | null }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={GUARDIAN_LOGO} alt="The Guardian" className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt || ""} onError={() => setErr(true)} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
  );
}

export function NewsAlertCard({
  query,
  onOpenArticle,
  onFindSignals,
  x = 1080,
  y = 826,
  width = 430,
  height = 560,
}: {
  query?: string;
  onOpenArticle: (item: NewsItem) => void;
  onFindSignals: (item: NewsItem) => void;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  const { style, dragHandle, resizeHandle, raise } = useMovableCard("news", { x, y, w: width, h: height }, { minW: 320, minH: 280 });
  const [menu, setMenu] = useState<{ vx: number; vy: number; item: NewsItem } | null>(null);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const firstRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    firstRef.current = true; // re-baseline "seen" whenever the query (portfolio) changes
    const load = (first: boolean) =>
      fetch(`/api/guardian?q=${encodeURIComponent(query || "")}&takeaways=1`)
        .then((r) => r.json())
        .then((j) => {
          if (cancelled) return;
          if (j.error) {
            if (first) setErr(j.error);
            return;
          }
          const next: NewsItem[] = j.items || [];
          setItems(next);
          setErr(null);
          if (firstRef.current) {
            setSeen(new Set(next.map((i) => i.id))); // nothing is "new" on first load
            firstRef.current = false;
          }
        })
        .catch(() => first && !cancelled && setErr("Couldn't load news."))
        .finally(() => first && !cancelled && setLoading(false));
    load(true);
    const id = setInterval(() => load(false), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [query]);

  return (
    <div
      onPointerDown={raise}
      style={style}
      className="fade-in absolute flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#0e0e0e] font-sans tracking-[-0.01em] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
    >
      {/* header — drag handle */}
      <div {...dragHandle} className="flex shrink-0 cursor-move touch-none select-none items-start justify-between gap-3 border-b border-white/[0.06] px-5 pt-4 pb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#8a8a8a]">News</p>
          <h2 className="mt-1 text-[16px] font-semibold text-white">Portfolio headlines</h2>
        </div>
      </div>

      {/* body — feed */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-2">
        {loading && <p className="mt-10 animate-pulse text-center text-[13px] text-[#8a8a8a]">Loading headlines…</p>}
        {err && !items.length && <p className="mt-10 text-center text-[13px] text-rose-400">{err}</p>}
        {!loading && !err && !items.length && <p className="mt-10 text-center text-[12px] text-[#666]">No headlines right now.</p>}

        {items.map((i) => {
          const isNew = !seen.has(i.id);
          const live = isLiveBlog(i.title);
          return (
            <button
              key={i.id}
              onClick={() => onOpenArticle(i)}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu({ vx: e.clientX, vy: e.clientY, item: i }); }}
              className="group flex w-full gap-3 border-t border-white/[0.06] py-3 text-left first:border-t-0"
            >
              <Thumb src={i.image} alt={i.imageAlt} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[11px] leading-snug text-white/90 group-hover:text-white">{i.takeaway || i.title}</p>
                <div className="mt-1 flex items-center gap-2 overflow-hidden text-[10.5px] text-[#8a8a8a]">
                  {isNew && (
                    <span className="shrink-0 rounded-[5px] bg-emerald-500/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-400">
                      New
                    </span>
                  )}
                  {i.section && <span className="shrink-0">{i.section}</span>}
                  <span className="shrink-0">· {relTime(i.published)}</span>
                  {i.byline && <span className="truncate">· {live ? currentAuthor(i.byline) : i.byline}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {menu && (
        <ContextMenu
          x={menu.vx}
          y={menu.vy}
          items={[{ label: "Find Signals", onClick: () => { onFindSignals(menu.item); setMenu(null); } }]}
          onClose={() => setMenu(null)}
        />
      )}

      {/* resize handle */}
      <div
        {...resizeHandle}
        className="absolute bottom-0 right-0 z-20 flex h-7 w-7 cursor-nwse-resize touch-none items-end justify-end p-1.5 text-white/40 transition-colors hover:text-white/80"
        title="Drag to resize"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M11 4L4 11M11 8L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
