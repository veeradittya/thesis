"use client";

import { useEffect, useState } from "react";

const LABEL = "block text-[10px] uppercase tracking-wider text-text-muted mb-1.5";
const FIELD =
  "w-full bg-bg border border-border rounded px-3 py-2 text-[14px] text-text placeholder-text-muted/50 focus:outline-none focus:border-border-light transition-colors";

export function ThesisForm({
  onSubmit,
  loading,
  error,
  initialTicker,
  initialThesis,
}: {
  onSubmit: (v: { holdings: string; thesisText: string; timeHorizon: string }) => void;
  loading: boolean;
  error: string | null;
  initialTicker?: string;
  initialThesis?: string;
}) {
  const [holdings, setHoldings] = useState(initialTicker ?? "");
  const [thesisText, setThesisText] = useState(initialThesis ?? "");
  const [timeHorizon, setTimeHorizon] = useState("");

  useEffect(() => {
    if (initialTicker) setHoldings(initialTicker);
  }, [initialTicker]);

  useEffect(() => {
    if (initialThesis) setThesisText(initialThesis);
  }, [initialThesis]);

  const canSubmit = holdings.trim() && thesisText.trim() && !loading;

  return (
    <div className="max-w-2xl mx-auto w-full px-6 py-10 fade-in">
      <div className="mb-6">
        <h1 className="text-[22px] text-accent tracking-wider mb-1">State your thesis</h1>
        <p className="text-[13px] text-text-muted leading-relaxed">
          Write why you hold it, in plain English. We decompose it into falsifiable claims with explicit
          break conditions, then map each to leading + confirming signals to watch.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className={LABEL}>Holdings (ticker or asset)</label>
          <input
            className={`${FIELD} font-mono`}
            placeholder="NVDA"
            value={holdings}
            onChange={(e) => setHoldings(e.target.value)}
          />
        </div>

        <div>
          <label className={LABEL}>Thesis</label>
          <textarea
            className={`${FIELD} min-h-[140px] leading-relaxed resize-y`}
            placeholder="Nvidia stays the backbone of AI. CUDA and its yearly chip cadence keep it ahead of AMD and custom silicon, and hyperscaler data-center spending keeps climbing. I hold it as the picks-and-shovels play on AI."
            value={thesisText}
            onChange={(e) => setThesisText(e.target.value)}
          />
        </div>

        <div>
          <label className={LABEL}>
            Time horizon <span className="normal-case tracking-normal">(optional, recommended for story/macro theses)</span>
          </label>
          <input
            className={FIELD}
            placeholder="2 years"
            value={timeHorizon}
            onChange={(e) => setTimeHorizon(e.target.value)}
          />
        </div>

        {error && (
          <div className="border border-negative/40 bg-negative/5 rounded px-3 py-2 text-[13px] text-negative">
            {error}
          </div>
        )}

        <button
          disabled={!canSubmit}
          onClick={() => onSubmit({ holdings, thesisText, timeHorizon })}
          className="w-full px-3 py-2.5 rounded text-[14px] font-medium text-white bg-crimson hover:bg-crimson-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
              Watching the world for breaks…
            </span>
          ) : (
            "Decompose thesis →"
          )}
        </button>
      </div>
    </div>
  );
}
