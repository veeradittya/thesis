"use client";

import { useEffect, useState } from "react";
import type { PredictionPayload } from "@/lib/oddpool";
import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@/components/ui/card";

function pct(x: number | null | undefined): string {
  if (x == null) return "—";
  return `${Math.round(x * 100)}%`;
}
function fmtUSD(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}
function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtTime(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function venueLabel(ex: string): string {
  if (/polymarket/i.test(ex)) return "Polymarket";
  if (/kalshi/i.test(ex)) return "Kalshi";
  return ex;
}
function thresholdLabel(m: { strike: number | null; question: string }): string {
  if (m.strike == null) return m.question.replace(/^Will\s+/i, "").slice(0, 22);
  const usd = `$${m.strike.toLocaleString()}`;
  if (/above|high|≥|reach/i.test(m.question)) return `≥ ${usd}`;
  if (/below|low|dip|under/i.test(m.question)) return `≤ ${usd}`;
  return usd;
}

function Sparkline({ bars }: { bars: Array<{ ts: string; close: number }> }) {
  if (!bars || bars.length < 2) return null;
  const W = 104;
  const H = 30;
  const ys = bars.map((b) => b.close);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const pts = bars
    .map((b, i) => {
      const x = (i / (bars.length - 1)) * W;
      const y = H - ((b.close - min) / span) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = ys[ys.length - 1] >= ys[0];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={up ? "text-positive" : "text-negative"} fill="none">
      <polyline points={pts} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border/40 pb-1">
      <dt className="text-text-muted">{label}</dt>
      <dd className="truncate text-right font-mono text-[11px] text-text">{value}</dd>
    </div>
  );
}

export function PredictionCard() {
  const [data, setData] = useState<PredictionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/prediction")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j);
      })
      .catch(() => setError("Couldn't load the prediction market."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-10">
        <p className="animate-pulse text-center text-[13px] text-text-muted">Pulling live NVDA markets from Oddpool…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-10">
        <p className="text-center text-[13px] text-negative">{error || "No data."}</p>
      </div>
    );
  }

  const { event, markets, headline } = data;
  const change1d = headline.stats?.change_1d;
  const changeLabel =
    change1d == null
      ? null
      : `${change1d >= 0 ? "+" : "−"}${Math.abs(change1d * 100).toFixed(1)} pts 24h`;
  const resolves = headline.scheduled_close_at || headline.settled_at;

  return (
    <div className="fade-in flex flex-col gap-5 py-5">
      <CardHeader className="flex-col gap-2">
        <div className="flex w-full items-center gap-2">
          <Badge variant="secondary">{venueLabel(event.exchange)}</Badge>
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" />
            {event.status}
          </span>
          {event.category && <Badge variant="muted">{event.category}</Badge>}
          <CardAction>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">NVDA</span>
          </CardAction>
        </div>
        <CardTitle className="text-[15px] leading-snug">{event.title}</CardTitle>
        <CardDescription className="text-xs">
          {markets.length} live outcomes · prediction-market leading indicator · resolves {fmtDate(resolves)}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Headline — the most contested active market */}
        <div className="rounded-lg border border-border bg-surface/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-text-muted">Most contested market</p>
              <p className="mt-1 truncate text-sm text-text">{headline.question}</p>
            </div>
            <div className="shrink-0">
              <Sparkline bars={headline.bars} />
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tabular-nums text-crimson">{pct(headline.yes)}</span>
                <span className="text-xs text-text-muted">YES</span>
              </div>
              <div className="mt-0.5 text-xs text-text-muted">
                NO {pct(headline.yes == null ? null : 1 - headline.yes)}
                {changeLabel && (
                  <>
                    {" · "}
                    <span className={change1d! >= 0 ? "text-positive" : "text-negative"}>{changeLabel}</span>
                  </>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-x-4 text-right text-[11px]">
              <div>
                <dt className="text-text-muted">Volume</dt>
                <dd className="font-mono text-text">{fmtUSD(headline.volume)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Liquidity</dt>
                <dd className="font-mono text-text">{fmtUSD(headline.liquidity)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Resolves</dt>
                <dd className="font-mono text-text">{fmtDate(resolves)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Outcome ladder — implied probability by threshold */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Implied probability by threshold</p>
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Yes · Vol</p>
          </div>
          <div className="flex flex-col">
            {markets.map((m) => (
              <div key={m.market_id} className="flex items-center gap-3 py-1.5">
                <span className="w-16 shrink-0 font-mono text-xs text-text">{thresholdLabel(m)}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-crimson"
                    style={{ width: `${Math.round((m.yes ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-9 text-right font-mono text-xs tabular-nums text-text">{pct(m.yes)}</span>
                <span className="w-12 text-right font-mono text-[10px] text-text-muted">{fmtUSD(m.volume)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Full API detail — everything the endpoint serves */}
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-wider text-text-muted">Market details</p>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs">
            <Detail label="Event" value={event.event_id.slice(0, 18)} />
            <Detail label="Series" value={event.series_id} />
            <Detail label="Venue" value={event.exchange} />
            <Detail label="Category" value={event.category ?? "—"} />
            <Detail label="Outcomes" value={event.market_count} />
            <Detail label="Status" value={event.status} />
            <Detail label="Total volume" value={fmtUSD(event.total_volume)} />
            <Detail label="Total liquidity" value={fmtUSD(event.total_liquidity)} />
            <Detail label="Discovered" value={fmtDate(event.discovered_at)} />
            <Detail label="Headline id" value={`${headline.market_id.slice(0, 10)}…`} />
            <Detail
              label="Snapshot"
              value={headline.interval ? `${headline.interval} · ${headline.snapshot_cadence ?? ""}`.trim() : "—"}
            />
            <Detail label="History" value={`${fmtDate(headline.window_start)}–${fmtDate(headline.window_end)}`} />
          </dl>
        </div>
      </CardContent>

      <CardFooter className="justify-between text-[11px] text-text-muted">
        <span>Live from {data.source} · {venueLabel(event.exchange)}</span>
        <span>Updated {fmtTime(data.fetchedAt)}</span>
      </CardFooter>
    </div>
  );
}
