"use client";

import { useEffect, useState } from "react";
import { useMovableCard } from "@/components/ui/useMovableCard";
import type { NewsItem, Article } from "@/lib/guardian";

function fmtDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// Full-article reader card. Opens instantly with the headline/image from the list item,
// then streams in the body text from /api/guardian?id=. Stays on the portfolio canvas.
export function ArticleCard({
  item,
  x = 120,
  y = 140,
  onClose,
}: {
  item: NewsItem;
  x?: number;
  y?: number;
  onClose: () => void;
}) {
  const { style, dragHandle, resizeHandle, raise } = useMovableCard(`article:${item.id}`, { x, y, w: 480, h: 600 }, { minW: 360, minH: 320 });
  const [article, setArticle] = useState<Article | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [heroErr, setHeroErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/guardian?id=${encodeURIComponent(item.id.split("#")[0])}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) setErr(j.error);
        else setArticle(j as Article);
      })
      .catch(() => !cancelled && setErr("Couldn't load the article."));
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  const title = article?.title || item.title;
  const image = article?.image || item.image;
  const byline = article?.byline ?? item.byline;
  const published = article?.published || item.published;
  const section = article?.section || item.section;
  const url = article?.url || item.url;

  return (
    <div
      onPointerDown={raise}
      style={style}
      className="fade-in absolute flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#0e0e0e] font-sans tracking-[-0.01em] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
    >
      {/* header — drag handle */}
      <div {...dragHandle} className="flex shrink-0 cursor-move touch-none select-none items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
        <p className="truncate text-[10px] uppercase tracking-wider text-[#8a8a8a]">The Guardian{section ? ` · ${section}` : ""}</p>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          title="Close"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#8a8a8a] transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* body */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {image && !heroErr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={article?.imageAlt || ""} onError={() => setHeroErr(true)} className="mb-3 h-44 w-full rounded-xl object-cover" />
        )}

        <h2 className="text-[19px] font-semibold leading-snug text-white">{title}</h2>
        <p className="mt-1.5 text-[11.5px] text-[#8a8a8a]">
          {byline ? `${byline} · ` : ""}
          {fmtDate(published)}
        </p>

        <div className="mt-3.5">
          {err && <p className="text-[13px] text-rose-400">{err}</p>}
          {!article && !err && <p className="animate-pulse text-[13px] text-[#8a8a8a]">Loading article…</p>}
          {article?.paragraphs.map((p, i) => (
            <p key={i} className="mb-3 text-[13.5px] leading-relaxed text-white/85">
              {p}
            </p>
          ))}
          {article && article.paragraphs.length === 0 && !err && (
            <p className="text-[13px] text-[#8a8a8a]">No preview text available for this item — open the original below.</p>
          )}
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-[12px] text-emerald-400 transition-colors hover:text-emerald-300"
        >
          Read on theguardian.com
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7M7 7h10v10" />
          </svg>
        </a>
      </div>

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
