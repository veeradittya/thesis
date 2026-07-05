"use client";

import { useEffect, useMemo, useState } from "react";

interface Article {
  id: string;
  ticker: string;
  provider: "Alpaca" | "Finnhub" | "NYT" | "Guardian";
  source: string;
  headline: string;
  summary: string;
  url: string;
  image: string | null;
  datetime: number;
}

function relTime(ms: number): string {
  if (!ms) return "";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function Meta({ a }: { a: Article }) {
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-muted">
      <span className="font-mono text-crimson">{a.ticker}</span>
      <span className="text-border-light">/</span>
      <span className="font-mono">{a.source}</span>
      {a.datetime ? (
        <>
          <span className="text-border-light">·</span>
          <span>{relTime(a.datetime)}</span>
        </>
      ) : null}
    </div>
  );
}

export function NewsPage({ tickers }: { tickers: string[] }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const key = tickers.join(",");

  useEffect(() => {
    if (!key) {
      setArticles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/news?tickers=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((j) => setArticles(j.articles || []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [key]);

  const dateStr = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    [],
  );

  const lead = articles.find((a) => a.image) || articles[0] || null;
  const rest = articles.filter((a) => a.id !== lead?.id);

  return (
    <div className="flex-1 overflow-y-auto fade-in">
      <div className="mx-auto max-w-5xl px-6 py-8 pb-28">
        {/* masthead */}
        <header className="text-center">
          <div className="flex items-center justify-between border-b border-border pb-2 text-[10px] uppercase tracking-widest text-text-muted">
            <span>{dateStr}</span>
            <span>Portfolio Edition</span>
          </div>
          <h1 className="mt-5 text-[40px] font-semibold tracking-tight text-accent leading-none">
            thesis<span className="text-crimson">.</span> dispatch
          </h1>
          <p className="mt-3 text-[12px] text-text-muted">
            Curated coverage on what you hold
            {tickers.length ? (
              <>
                {" · "}
                <span className="font-mono text-text">{tickers.join("  ")}</span>
              </>
            ) : null}
          </p>
          <div className="mt-5 border-t-2 border-accent/70" />
        </header>

        {loading && (
          <p className="mt-16 text-center text-[13px] text-text-muted animate-pulse">
            Gathering the latest coverage on {tickers.join(", ") || "your holdings"}…
          </p>
        )}

        {!loading && !tickers.length && (
          <p className="mt-16 text-center text-[13px] text-text-muted">
            Add a thesis to start tracking coverage on your holdings.
          </p>
        )}

        {!loading && tickers.length > 0 && articles.length === 0 && (
          <p className="mt-16 text-center text-[13px] text-text-muted">
            No recent coverage found for {tickers.join(", ")}. Check back soon.
          </p>
        )}

        {!loading && lead && (
          <>
            {/* lead story */}
            <a
              href={lead.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-8 grid grid-cols-1 gap-6 border-b border-border pb-8 md:grid-cols-[1.4fr_1fr]"
            >
              <div className="flex flex-col justify-center">
                <Meta a={lead} />
                <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-accent group-hover:text-crimson transition-colors">
                  {lead.headline}
                </h2>
                {lead.summary && (
                  <p className="mt-3 text-[14px] leading-relaxed text-text-muted line-clamp-4">{lead.summary}</p>
                )}
                <span className="mt-3 text-[11px] uppercase tracking-wider text-crimson opacity-0 group-hover:opacity-100 transition-opacity">
                  Read on {lead.source} →
                </span>
              </div>
              {lead.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lead.image}
                  alt=""
                  className="h-56 w-full rounded-lg border border-border object-cover md:h-full"
                  onError={(e) => ((e.currentTarget.style.display = "none"))}
                />
              )}
            </a>

            {/* the rest — newspaper columns */}
            <div className="mt-8 columns-1 gap-8 md:columns-2 lg:columns-3">
              {rest.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mb-6 block break-inside-avoid border-t border-border pt-4"
                >
                  <Meta a={a} />
                  <h3 className="mt-1.5 text-[15px] font-medium leading-snug text-text group-hover:text-crimson transition-colors">
                    {a.headline}
                  </h3>
                  {a.summary && (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted line-clamp-3">{a.summary}</p>
                  )}
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
