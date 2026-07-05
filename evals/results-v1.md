# Decomposition Prompt — Validation Run v1

Prompt: `prompts/decomposition.md` · Registry: `registry/source-registry.json` · Theses: `evals/theses.md`
Run: manual (model = same family as production). Format per claim:
`cN (weight) — statement | BREAK: ... | lead: a,b -> confirm: c | obs:H/M/L`

---

## 1. NVDA — single-stock/moat
- c1 (.30) Hyperscaler AI capex keeps growing | BREAK: 2 consec Q capex decline or guidance cuts from >=2 of MSFT/GOOG/AMZN/META | lead: job_postings, metaculus -> confirm: earnings | obs:H
- c2 (.20) Nvidia keeps the performance lead | BREAK: rival ships matching/beating chip at comparable cost+availability, or NVDA roadmap slips a generation | lead: hacker_news, job_postings -> confirm: news, earnings | obs:M
- c3 (.20) CUDA lock-in holds | BREAK: a major hyperscaler moves a significant share of training/inference off CUDA | lead: github (ROCm/Triton), hacker_news -> confirm: news, earnings | obs:M
- c4 (.15) Pricing power persists | BREAK: gross margin < 60% for 2 quarters | lead: (none strong) -> confirm: earnings, sec_edgar | obs:L fallback: earnings-only
- c5 (.15) No external shock | BREAK: new export rules removing a large revenue slice, or TSMC supply disruption | lead: polymarket/kalshi (export-control odds), metaculus -> confirm: sec_edgar (8-K), news | obs:H
- unstated: valuation multiple; TSMC single-supplier concentration.
- **Grade:** Falsifiable 5 · Measurable 4 (c2/c3 softer) · Monitorable 4 · Coverage 5. **PASS.**

## 2. LLY — thematic/demand
- c1 (.30) Demand outruns supply | BREAK: company states supply meets demand, or script growth decelerates 2Q | lead: google_trends, web_traffic, reddit -> confirm: earnings, news (FDA shortage list) | obs:H
- c2 (.25) Expansion into new indications succeeds | BREAK: pivotal trials fail or labels denied | lead: metaculus, news -> confirm: sec_edgar, news (FDA) | obs:M
- c3 (.20) No commoditizing competition | BREAK: >=2 credible entrants (oral GLP-1/biosimilar) gain approval + capacity | lead: metaculus, news -> confirm: sec_edgar | obs:M
- c4 (.15) Manufacturing scales | BREAK: repeated production misses / capacity guidance cut | lead: job_postings -> confirm: earnings | obs:M
- c5 (.10) Reimbursement/pricing holds | BREAK: major payer drops coverage or IRA price hit | lead: polymarket/kalshi (policy) -> confirm: news, sec_edgar | obs:M
- unstated: valuation; patent-cliff timeline.
- **Grade:** Falsifiable 5 · Measurable 4 · Monitorable 5 · Coverage 5. **PASS.** Strong alt-data showcase.

## 3. TSLA — story/optionality  *(hard case)*
- needs_user_input: TRUE — no time_horizon given; optionality break conditions need dates.
- c1 (.30) Robotaxi reaches commercial scale | BREAK: commercial launch slips past [HORIZON] or key-state approval denied | lead: metaculus, polymarket, job_postings -> confirm: earnings, news | obs:M
- c2 (.25) FSD achieves real autonomy + adoption | BREAK: no intervention-rate improvement over 2 versions, or take-rate stalls | lead: reddit, hacker_news -> confirm: earnings (deferred rev), news | obs:L fallback: earnings + curated reports
- c3 (.15) Optimus becomes a product | BREAK: production/commercial milestones slip past [HORIZON]; no external orders | lead: metaculus, news, job_postings -> confirm: earnings, news | obs:L
- c4 (.20) Auto business funds the bet | BREAK: auto gross margin ex-credits < 10% for 2Q, or FCF negative 2Q | lead: google_trends, web_traffic -> confirm: earnings, sec_edgar | obs:M
- c5 (.10) Key-person / capital intact | BREAK: CEO departure/major distraction, or dilutive raise | lead: news -> confirm: sec_edgar (8-K, Form 4) | obs:M
- clarifying_questions: "Time horizon? Which leg is the core bet — robotaxi, FSD, or Optimus? What auto-margin floor would worry you?"
- unstated: valuation is almost entirely optionality; execution-timeline risk; brand/political risk.
- **Grade:** Falsifiable 3 (soft without dates) · Measurable 3 · Monitorable 4 · Coverage 4. **CONDITIONAL** — correctly demands user dates. Validates the time_horizon rule.

## 4. COST — defensive compounder
- c1 (.30) Membership loyalty/renewal holds | BREAK: renewal rate < ~90% (US/Can) for 2 periods | lead: google_trends, web_traffic, reddit -> confirm: earnings | obs:M
- c2 (.25) Comparable-sales growth continues | BREAK: negative comps ex-fuel/fx for 2Q | lead: google_trends, web_traffic, app_rankings -> confirm: earnings | obs:M
- c3 (.20) Fee pricing power | BREAK: fee hike triggers renewal decline, or no hike feasible >6 yrs | lead: news -> confirm: earnings | obs:M
- c4 (.15) Margin discipline | BREAK: gross-margin model breaks / SG&A deleverage 2Q | confirm: earnings, sec_edgar | obs:M (no leading) fallback: earnings-only
- c5 (.10) No structural disruption | BREAK: sustained membership/traffic share loss | lead: web_traffic, app_rankings -> confirm: earnings | obs:M
- unstated: premium valuation (high P/E for a retailer).
- **Grade:** Falsifiable 5 · Measurable 4 · Monitorable 4 · Coverage 5. **PASS.**

## 5. CCJ — commodity supply/demand + macro
- c1 (.25) AI power demand drives nuclear buildout | BREAK: major slowdown in nuclear/SMR commitments, or DC power-demand forecasts cut | lead: news, metaculus, job_postings -> confirm: sector_official (EIA), news | obs:M
- c2 (.30) Uranium supply deficit persists | BREAK: large new supply online / inventories rebuild / deficit forecast flips | lead: news -> confirm: sector_official (WNA), sec_edgar | obs:M
- c3 (.25) Uranium price stays elevated | BREAK: spot < [threshold $/lb] sustained | lead: news -> confirm: commodity_price | obs:M  *(needed new registry source — see findings)*
- c4 (.20) Cameco execution | BREAK: production guidance cut / contract book shrinks | lead: job_postings -> confirm: earnings, sec_edgar | obs:M
- unstated: risk-on macro dependence; geopolitical (Kazakhstan supply, enrichment).
- **Grade:** Falsifiable 5 · Measurable 4 · Monitorable 4 (after adding commodity_price) · Coverage 4. **PASS w/ registry fix.**

## 6. Long-duration tech — pure macro
- needs_user_input: TRUE — basket ("growth names") undefined.
- c1 (.35) Rate-cut path continues | BREAK: Fed pauses/hikes, or 10Y yield > [threshold] sustained | lead: kalshi/polymarket (Fed odds) -> confirm: fred | obs:H
- c2 (.25) Inflation stays contained | BREAK: core CPI re-accelerates > [X%] for 2 prints | lead: kalshi (CPI) -> confirm: fred | obs:H
- c3 (.20) Growth-tech fundamentals hold | BREAK: basket revenue growth decelerates / margins compress | lead: job_postings, web_traffic -> confirm: earnings | obs:M
- c4 (.20) No risk-off / liquidity shock | BREAK: credit spreads widen sharply or sustained VIX regime shift | lead: polymarket (recession odds), news -> confirm: fred (spreads) | obs:M
- clarifying_questions: "Which specific tickers are the basket? What 10Y level or Fed action would break the thesis?"
- unstated: valuation sensitivity to duration; which names.
- **Grade:** Falsifiable 5 · Measurable 4 · Monitorable 5 (prediction markets + FRED) · Coverage 4. **CONDITIONAL** — correctly asks for the basket. Macro showcase.

## 7. COIN — crypto/adoption  *(best wedge showcase)*
- c1 (.30) ETF inflows / institutional bid persists | BREAK: net ETF outflows for [N] consecutive weeks | lead: exchange_flows, onchain_smart_money, polymarket -> confirm: news, sec_edgar | obs:H
- c2 (.25) BTC adoption/regime holds | BREAK: BTC < [threshold] or on-chain active addresses decline sustained | lead: exchange_flows, onchain_smart_money, google_trends -> confirm: price_volume, news | obs:H
- c3 (.25) COIN volume/revenue tracks adoption | BREAK: trading volume / MTU declines 2Q, or fee compression | lead: web_traffic, app_rankings, google_trends -> confirm: earnings | obs:H
- c4 (.20) Regulatory environment stays favorable | BREAK: adverse SEC action/legislation; ETF or staking setback | lead: polymarket/kalshi (crypto-policy odds), news -> confirm: sec_edgar, news | obs:H
- unstated: crypto-beta correlation; exchange fee competition; security/hack risk.
- **Grade:** Falsifiable 5 · Measurable 4 · Monitorable 5 · Coverage 5. **PASS.** Cleanest mapping — crypto + prediction markets + app-rank alt-data all fire.

## 8. AAPL — lazy thesis  *(guardrail test)*
- needs_user_input: TRUE.
- c1 (.50) iPhone install base / loyalty stays dominant | BREAK: iPhone installed-base decline or rising switch-away | lead: google_trends, web_traffic -> confirm: earnings | obs:M
- c2 (.50) Services growth continues | BREAK: services revenue growth decelerates 2Q | confirm: earnings | obs:M
- clarifying_questions: "What time horizon? What would actually make you sell? Which matters most — iPhone units, services growth, margins, or buybacks? Any valuation limit?"
- unstated (NON-monitorable): "always bounces back" — a belief, not a falsifiable claim. Flagged, not turned into a claim.
- **Grade:** correctly set needs_user_input, extracted only the 2 defensible implicit claims, refused to fabricate the rest. **PASS (guardrail held).**

---

## Systematic findings
1. **Story/optionality + undefined-basket theses need user input** (TSLA, long-duration tech). The prompt must demand a `time_horizon` and resolve vague baskets before monitoring. The v1 rule fired correctly.
2. **Registry gap: no direct commodity price feed** surfaced on CCJ. → Added `commodity_price` to the registry.
3. **Leading-signal coverage is uneven.** Margin/pricing claims (NVDA c4, COST c4) have weak/no leading indicators — `observability: low/medium`, confirming-only. This is honest, not a bug, but the product must show it ("we can only confirm this late").
4. **Prediction markets + on-chain dominate macro/regulatory/crypto/event claims** and are weak for company-operational claims. Expected; coverage is archetype-dependent.
5. **`weight` per claim is essential** — it lets Thesis Health be a weighted score and tells the alert engine which breaks matter most. Worth keeping as a required field.
6. **Stability risk:** claim wording varies run-to-run; break-condition thresholds (the [X%] placeholders) are where drift will show. Needs the user to confirm thresholds, or the prompt to propose defaults the user edits.

## Prompt changes folded into v1 (already in decomposition.md)
- Require `time_horizon`; trigger clarifying_questions for optionality/macro when absent.
- Hard cap of 5 claims, kept by `weight`.
- `weight` (0–1) required per claim.
- `observability: low` requires a `fallback`.
- Non-falsifiable beliefs go to `unstated_assumptions`, never become claims.

## Open product decision
Low-observability / vague-thesis claims: **block monitoring until the user confirms thresholds**, or
**monitor immediately with a visible "low confidence / confirm-only" badge**? Recommend the latter
(monitor with badge) — never leave a holding unwatched; just be honest about signal quality.
