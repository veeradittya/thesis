"use client";

import type React from "react";
import { cn } from "@/lib/utils";
import type { Thesis, Verdict } from "@/lib/thesis";
import { VERDICT_LABEL } from "@/lib/thesis";
import type { Quote } from "@/lib/prices";

const VERDICT_STYLE: Record<Verdict, string> = {
  holds_up: "text-emerald-400",
  weakening: "text-amber-300",
  at_risk: "text-rose-400",
};

const fmtPrice = (v: number | null | undefined) => (v == null ? "—" : `$${v.toFixed(2)}`);

// Render crisp verdict prose with inline hyperlinks. Only markdown [text](url) is turned into a
// link; every other character is a plain string child (React escapes it — safe). The URLs are
// already validated server-side against the Tier-A sources the model actually retrieved.
function renderLinked(md: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    if (m.index > last) out.push(md.slice(last, m.index));
    out.push(
      <a
        key={m.index}
        href={m[2]}
        target="_blank"
        rel="noreferrer"
        className="text-white underline decoration-white/30 underline-offset-2 transition-colors hover:decoration-white"
      >
        {m[1]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < md.length) out.push(md.slice(last));
  return out;
}

export function ThesisCard({
  thesis,
  quote,
  analyzing,
  onRemove,
}: {
  thesis: Thesis;
  quote?: Quote;
  analyzing?: boolean;
  onRemove?: (id: string) => void;
}) {
  const a = thesis.lastAnalysis;
  const up = (quote?.percent ?? 0) >= 0;

  return (
    <div className="fade-in relative flex flex-col rounded-[20px] border border-white/[0.06] bg-[#0e0e0e] p-5 font-sans tracking-[-0.01em] shadow-[0_18px_50px_rgba(0,0,0,0.4)]">
      {/* header: name + price */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-white">{thesis.name}</h3>
          {thesis.horizon && <p className="mt-0.5 text-[10.5px] uppercase tracking-wider text-[#6b6b6b]">Horizon · {thesis.horizon}</p>}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {quote && (
            <div className="text-right">
              <p className="text-[14px] font-semibold tabular-nums text-white">{fmtPrice(quote.price)}</p>
              <p className={cn("text-[11px] tabular-nums", quote.percent == null ? "text-[#8a8a8a]" : up ? "text-emerald-400" : "text-rose-400")}>
                {quote.percent == null ? "—" : `${up ? "+" : ""}${quote.percent.toFixed(2)}%`}
              </p>
            </div>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(thesis.id)}
              title="Remove thesis"
              className="-mr-1 -mt-1 grid h-6 w-6 place-items-center rounded-full text-[#6b6b6b] transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* the user's thesis */}
      {thesis.thesisText && <p className="mt-3 text-[12.5px] leading-snug text-white/70">{thesis.thesisText}</p>}

      {/* today's verdict — plain text with inline source links */}
      <div className="mt-4 border-t border-white/[0.06] pt-3">
        {thesis.passive ? (
          <span className="text-[12px] text-[#a8a8a8]">Passive · tracked, not analyzed</span>
        ) : !a ? (
          analyzing ? (
            <div className="flex items-center gap-2.5">
              <span className="dot-loader" role="status" aria-label="Analyzing" />
              <span className="text-[12px] text-[#8a8a8a]">Updating…</span>
            </div>
          ) : (
            <span className="text-[12px] text-[#666]">Not analyzed yet</span>
          )
        ) : (
          <>
            <p className="text-[13px] leading-relaxed text-white/85">
              {/* Verdict tag only when there's a thesis to hold/break; a stock tracked without one
                  gets the assessment text only. */}
              {thesis.thesisText?.trim() && (
                <>
                  <span className={cn("font-semibold", VERDICT_STYLE[a.verdict])}>{VERDICT_LABEL[a.verdict]}.</span>{" "}
                </>
              )}
              {renderLinked(a.rationale)}
            </p>
            {(analyzing || a.degraded) && (
              <p className="mt-1.5 text-[10px] text-[#666]">{analyzing ? "updating…" : "limited data today"}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
