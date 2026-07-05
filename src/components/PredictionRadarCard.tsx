"use client";

import { useEffect, useState } from "react";
import type { RadarPayload } from "@/lib/oddpool";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@/components/ui/card";

function pct(x: number | null | undefined): string {
  return x == null ? "—" : `${Math.round(x * 100)}%`;
}
function fmtUSD(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}
function fmtTime(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function venueDot(ex: string): string {
  return /kalshi/i.test(ex) ? "bg-warning/80" : "bg-crimson/70";
}

export function PredictionRadarCard() {
  const [data, setData] = useState<RadarPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/prediction/radar")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j);
      })
      .catch(() => setError("Couldn't load the prediction radar."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-10">
        <p className="animate-pulse text-center text-[13px] text-text-muted">Scanning markets across your holdings…</p>
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

  return (
    <div className="fade-in flex flex-col gap-4 py-5">
      <CardHeader className="flex-col gap-1.5">
        <div className="flex w-full items-center gap-2">
          <CardTitle className="text-[15px]">Prediction radar</CardTitle>
          <CardAction>
            <Badge variant="secondary">{data.questionCount} open</Badge>
          </CardAction>
        </div>
        <CardDescription className="text-xs">
          Live prediction markets across {data.assetCount} of your holdings · {data.source}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {data.assets.map((a) => (
          <div key={a.ticker} className="flex flex-col gap-1">
            <div className="flex items-center justify-between border-b border-border/50 pb-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[13px] font-semibold text-accent">{a.ticker}</span>
                <span className="text-[11px] text-text-muted">{a.label}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-text-muted">
                {a.eventCount} Q · {fmtUSD(a.totalVolume)}
              </span>
            </div>

            {a.events.map((e) => (
              <div key={e.event_id} className="flex items-center gap-2 py-0.5">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", venueDot(e.exchange))} />
                <span className="min-w-0 flex-1 truncate text-xs text-text">{e.title}</span>
                {e.marketCount > 1 && (
                  <span className="shrink-0 rounded bg-surface px-1 font-mono text-[9px] text-text-muted">
                    {e.marketCount}
                  </span>
                )}
                <span
                  className={cn(
                    "w-8 shrink-0 text-right font-mono text-xs tabular-nums",
                    (e.yes ?? 0) >= 0.5 ? "text-crimson" : "text-text",
                  )}
                >
                  {pct(e.yes)}
                </span>
                <span className="w-11 shrink-0 text-right font-mono text-[10px] text-text-muted">{fmtUSD(e.volume)}</span>
              </div>
            ))}

            {a.eventCount > a.events.length && (
              <span className="pl-3.5 text-[10px] text-text-muted">+{a.eventCount - a.events.length} more</span>
            )}
          </div>
        ))}
      </CardContent>

      <CardFooter className="justify-between text-[11px] text-text-muted">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-crimson/70" />
            Polymarket
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-warning/80" />
            Kalshi
          </span>
        </span>
        <span>Updated {fmtTime(data.fetchedAt)}</span>
      </CardFooter>
    </div>
  );
}
