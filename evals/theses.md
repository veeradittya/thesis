# Eval Theses + Rubric (v1)

The fixed set used to test the decomposition prompt before any code. Each is written the way a
real user would write it. The set deliberately spans claim archetypes and includes one
non-falsifiable "lazy" thesis as a guardrail test.

## The 8 theses

1. **NVDA** — *single-stock / moat.* "Nvidia stays the backbone of AI. CUDA and its yearly chip
   cadence keep it ahead of AMD and custom silicon, and hyperscaler data-center spending keeps
   climbing. I hold it as the picks-and-shovels play on AI."
2. **LLY** — *thematic / demand.* "GLP-1 weight-loss drugs are a generational shift. Lilly can't
   make them fast enough; demand runs ahead of supply for years and expands into new indications."
3. **TSLA** — *story / optionality.* "Tesla isn't a car company — it's AI + robotics. The real
   value is FSD/robotaxi and Optimus, not auto margins. I hold it for the platform bet."
4. **COST** — *defensive compounder.* "Costco compounds through any cycle. The membership model
   locks in loyalty, gives pricing power, and grows steadily. My sleep-well-at-night core holding."
5. **CCJ** — *commodity supply/demand + macro.* "Nuclear is back. AI data-center power demand plus
   a structural uranium supply deficit pushes prices up for years; miners like Cameco win."
6. **Long-duration tech** — *pure macro.* "As rates come down, beaten-down high-growth and
   unprofitable tech re-rate higher. I'm positioned in long-duration growth names for the easing cycle."
7. **COIN** — *crypto / adoption.* "Spot ETFs created a permanent institutional bid for Bitcoin.
   Adoption only grows, and Coinbase is the regulated on-ramp that profits from the volume."
8. **AAPL** *(lazy / stress test)* — "Apple's a great company and always bounces back. Everyone has
   an iPhone. I'm holding for the long term."

## Rubric (score each CLAIM 1–5, then judge the SET)
- **Falsifiable** — some observable could prove it wrong.
- **Measurable** — tied to a metric/threshold/timeframe, not a vibe.
- **Material** — if it breaks, the thesis genuinely weakens.
- **Monitorable** — maps to ≥1 real registry source (ideally ≥1 leading + 1 confirming).
- **Break condition present** — explicit "broken if X."
- **Coverage (set-level)** — claims together capture the thesis; no big unstated assumption missed.

Pass bar: every claim ≥4 on Falsifiable + Break-condition; set-level Coverage ≥4; no claim that
restates price. Also check **stability**: same thesis run 2–3× should produce materially the same claims.

## What each thesis stress-tests
- NVDA: baseline / canonical moat thesis.
- LLY: demand thesis with rich alt-data leading signals.
- TSLA: optionality — hardest to make falsifiable; needs milestone dates.
- COST: defensive thesis where signals are mostly medium-observability consumer alt-data.
- CCJ: commodity — exposes whether the registry has a price feed.
- Long-duration tech: macro + an undefined basket (should trigger a clarifying question).
- COIN: crypto — prediction markets + on-chain should map cleanly (best wedge showcase).
- AAPL: guardrail — must flag vagueness and ask, not fabricate confidence.
