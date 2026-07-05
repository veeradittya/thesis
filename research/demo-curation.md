# Thesis Demo — Pre-Curated Data (5 assets, pick 3)

Compiled from a deep-research run (June 25, 2026): 30 sources fetched, 111 claims extracted, 109 adversarial 3-vote verifications. All live signals below are dated; **odds and Reddit counts are snapshots that must be re-pinned at demo-record time.** Source-quality and verification notes are inline.

## Recommendation (which 3 to demo)
**NVDA · TSLA · BTC.** These three have the strongest *verified, currently-live* prediction markets AND active Reddit signals — i.e. they best show off the two differentiators (prediction-market + alt-sentiment leading indicators). **LLY and CCJ** are excellent, current theses but have **thin asset-specific prediction-market coverage** (you'd lean on a macro Kalshi/Metaculus market or commission a bespoke one) and **low Reddit chatter** — which is itself a real product insight (they're domain-expert/institutional holds, not meme names), but it weakens the live-signal wow factor in a demo.

### Data caveats (from verification)
- NVDA "4M CUDA developers" is **stale** — Nvidia cited ~6M at GTC (Mar 2026). Use ~6M.
- LLY "$82–85B FY26 guidance" was **misattributed** to the Feb 4 article (that one carried initial $80–83B / $33.50–35.00). Use the **verified Q1-2026 actuals** below; treat the raise as "guidance lifted during 2026 — confirm exact figure live."
- AltIndex NVDA Reddit tuple (455 mentions) renders on their page but **internally conflicts** with their own ticker page (486) — treat mention counts as directional.
- Tesla **launched** unsupervised robotaxi in **Austin** (~mid-June 2026); the live Polymarket market is **California-specific** (no CPUC permit) — keep those two separate.

---

# 1) NVDA — Nvidia  ·  archetype: AI-infrastructure moat
**Current state (verified):** ~$4.2T market cap, forward P/E low-30s, ~75% gross margin. Q1 FY2027 (qtr ended Apr 26, 2026): record revenue **$81.6B (+85% YoY)**, data-center **$75.2B (+92%)**; **stock slid** after the May 20 beat. Q2 FY2027 guide **$91.0B**, assuming **zero China DC compute**. Data center ≈88–92% of revenue. Short interest 1.22% of float, 1.6 days to cover (declining −4%). YTD +12% but −3% trailing month, lagging SMH (+84% YTD).

### Thesis options
- **A. "Sell the shovels" moat** — CUDA lock-in + hyperscaler capex keep Nvidia the default AI compute layer; switching costs are brutal so buyers keep paying up.
- **B. Compute-scarcity pricing power** — H100/H200/B200 stay supply-constrained; allocation itself is the moat, sustaining premium pricing.
- **C. Full-stack platform** — networking + CUDA software + inference make Nvidia more than a chip; the install base compounds (train on it → deploy on it).

### Claims (Thesis A)
- **C1 — Hyperscaler AI capex keeps growing (~$350B/yr combined).** Break: 2 consecutive quarters of declining aggregate hyperscaler capex, OR ≥2 of MSFT/GOOG/AMZN/META cut capex guidance, by mid-2027. *Leading:* job postings (AI-infra roles), Metaculus/Polymarket AI-capex. *Confirming:* hyperscaler earnings, SEC filings. *Now:* DC rev +92% YoY — demand robust.
- **C2 — CUDA ecosystem lock-in holds.** Break: ROCm/Triton/TPU collectively exceed ~25% of CUDA's GitHub/AI-ML activity, OR a tier-1 lab moves primary training off CUDA. *Leading:* GitHub repo/commit/star activity (CUDA vs ROCm/oneAPI/Triton), Hacker News migration sentiment, job postings. *Confirming:* Nvidia investor materials (~6M registered CUDA devs). *Now:* moat intact (~6M devs).
- **C3 — Compute scarcity sustains pricing power.** Break: top-GPU rental rates fall sustained / lead times collapse. *Leading:* GPU rental indices (Ornn), TSMC CoWoS capacity. *Now:* **WEAKENING** — B200 hourly rate fell $6.11 (May 30) → $4.22 (Jun 21), −30% (Ornn). *(This is the best live "money-moment" demo signal.)*
- **C4 — Sentiment / priced-for-perfection.** Break: strong beats stop moving the stock. *Leading:* options/short interest, post-earnings reaction. *Now:* slid on a May-20 beat; lagging the semis complex.

### Prediction-market leading indicators (VERIFIED LIVE)
- **Polymarket — "AI bubble burst by…?"** (https://polymarket.com/event/ai-bubble-burst-by). "By Dec 31, 2026" outcome ≈ **19–20% Yes** (one-in-five) as of Jun 25, 2026; ~$2.9M volume; launched Nov 19, 2025. Explicit resolution = ≥3 of 6 events in 90 days (incl. **NVDA −50% from ATH**, semis ETF −40%, H100 rental ≤$1) → a ready-made monitorable break condition. *3-vote verified.*
- **Kalshi — Nvidia B200 Q2-2026 compute-price contract** (Ornn index; resolves ~Jun 30) — traders pessimistic price exceeds May's high (covered by CNBC, Jun 22). *Verified.*

### Alt-sentiment (Reddit)
- **r/wallstreetbets** — NVDA actively discussed (≈ rank #5–6, ~455 mentions, +54% 24h, bullish; AltIndex/Ape Wisdom). *Leading signal:* WSB mention-velocity spike + sentiment flip. *(Counts are directional — AltIndex internal inconsistency noted.)*

### Curated news (top-tier first)
- **CNBC — May 20, 2026:** "Data center revenue nearly doubles, report is strong but stock slides." https://www.cnbc.com/2026/05/20/nvidia-nvda-earnings-report-q1-2027.html
- **CNBC — Jun 22, 2026:** "Nvidia's stock struggles as Kalshi traders bet chip prices are coming down." https://www.cnbc.com/amp/2026/06/22/nvidias-stock-struggles-as-kalshi-traders-bet-chip-prices-are-coming-down.html
- **SEC EDGAR — May 2026:** NVDA Form 8-K, Q1 FY2027 press release (primary). https://www.sec.gov/Archives/edgar/data/0001045810/000104581026000051/q1fy27pr.htm
- **MarketBeat — Jun 2026:** NVDA short interest 1.22% float, 1.6 days to cover. https://www.marketbeat.com/stocks/NASDAQ/NVDA/short-interest/
- *(For a polished feed, pull the WSJ/Bloomberg/Reuters versions of the May-20 earnings and Jun-22 chip-price stories.)*

---

# 2) TSLA — Tesla  ·  archetype: autonomy story / optionality
**Current state (verified):** ~$399 (Jun 12, 2026); **P/S 15.3x** vs ~1.3x peers (fair ~3.4x). **Austin unsupervised robotaxi launched** (~mid-June 2026); fresh FSD approvals in Belgium & Denmark. **California: NO CPUC autonomous permit** — operates under a TCP (limo) permit with human drivers; regulator says Tesla is "not operating an autonomous vehicle service." FY2025: deliveries −9% YoY, net income −47%. Energy: record Q4 14.2 GWh (+25% rev).

### Thesis options
- **A. Robotaxi/autonomy optionality** — driverless scales from pilots to a network; this is what justifies the valuation.
- **B. Energy-storage compounder** — Megapack/energy becomes a high-margin growth engine independent of autos.
- **C. AI + Optimus + FSD licensing** — FSD licensing and humanoid robots open new TAMs.

### Claims (Thesis A)
- **C1 — Driverless robotaxi scales beyond a geofenced pilot.** Break: no paid driverless service in California by [date] / Austin stays safety-driver-gated. *Leading:* Polymarket CA-robotaxi market, CPUC permit filings, DMV AV disengagement reports. *Confirming:* Tesla earnings robotaxi metrics. *Now:* **WEAKENING on CA** (no permit; Polymarket ~5–13%); Austin launched.
- **C2 — FSD regulatory expansion + take-rate.** Break: approvals stall / take-rate flat. *Leading:* regulatory approvals (EU expanding), FSD subscription attach. *Now:* Belgium/Denmark added.
- **C3 — Deliveries stabilize.** Break: third consecutive annual delivery decline. *Leading:* Polymarket deliveries market. *Confirming:* quarterly delivery reports. *Now:* FY25 −9%; market bearish (78.5% < 350k in Q1).
- **C4 — Valuation justified by optionality.** Break: P/S compresses toward peers as milestones slip. *Now:* 15.3x — richly priced.

### Prediction-market leading indicators (VERIFIED LIVE)
- **Polymarket — "Will Tesla launch robotaxis in California by June 30?"** (https://polymarket.com/event/will-tesla-launch-robotaxis-in-california-by-june-30). **Yes ≈ 13¢ (May 15) → ~5%** later; ~$105k volume; resolves Jun 30, 2026. Driven by a concrete regulatory break condition (no CPUC AV permit filed). *3-vote verified.*
- **Polymarket — Tesla < 350k deliveries (Q1 2026): ~78.5%** and **Optimus ships to consumers by mid-year: ~5%** (per 24/7 Wall St, Mar 13 — re-pull live).

### Alt-sentiment (Reddit)
- **r/stocks · r/wallstreetbets · r/investing** — **bearish**: aggregate Tesla sentiment **28/100**, bearish 30+ days (24/7 Wall St, Mar 13). WSB mentions **low** (#33, ~26, −59% 24h). *Leading signal:* sentiment-score flip or WSB mention surge; **r/teslainvestorsclub** for the bull side.

### Curated news
- **Yahoo Finance — Jun 12, 2026:** "Robotaxi progress puts lofty valuation in the spotlight." https://finance.yahoo.com/markets/stocks/articles/tesla-tsla-stock-robotaxi-progress-110947811.html
- **24/7 Wall St — Mar 13, 2026:** "Reddit has turned bearish on Tesla — and the crowd might be right." https://247wallst.com/investing/2026/03/13/reddit-has-turned-bearish-on-tesla-and-the-crowd-might-actually-be-right-this-time/
- **Electrek / Reuters (via Polymarket research):** California regulator confirms Tesla "not operating an autonomous vehicle service."
- *(Pull WSJ/Bloomberg versions of the robotaxi-launch and deliveries stories for the feed.)*

---

# 3) BTC — Bitcoin  ·  archetype: crypto adoption / macro hedge
**Current state (verified):** ~**$62,651** (Jun 24, 2026); **−18% MoM, −41% YoY**; ATH **$126,198** (Oct 6, 2025) → ~50% below. **Record spot-ETF outflows**: 13 straight days mid-May→Jun 3, ~**$4.3–4.4B** (longest since Jan-2024 launch); streak broke Jun 5 (+$3.05M, IBIT +$47.7M). IBIT −$2.7B/5wks (still +$62B since launch). Aggregate ETF AUM **$104B → $80B**; ~1.277M BTC held. Realized price ~$54k. Standard Chartered cut 2026 target to **$100k** (from $300k→$150k), flags $50k capitulation.

### Thesis options
- **A. Institutional adoption / ETF demand** — spot ETFs structurally absorb supply ("digital gold").
- **B. Macro debasement hedge** — Bitcoin benefits from fiscal/monetary excess and rate-cut liquidity.
- **C. Scarcity/halving supply cycle** — post-halving supply squeeze drives the next leg.

### Claims (Thesis A)
- **C1 — Net spot-ETF flows stay positive over time.** Break: outflow streak > ~10 days or > ~$3B in a month. *Leading:* daily spot-BTC-ETF net flows (IBIT etc.). *Confirming:* ETF AUM, total BTC held. *Now:* **WEAKENING** — record 13-day, ~$4.3B outflow; AUM −$24B (streak just broke). Strong live "break" demo.
- **C2 — Macro liquidity tailwind (rate cuts).** Break: Fed stays hawkish (no 2026 cuts). *Leading:* **Kalshi rate-cut market** (see below). *Now:* market prices **zero 2026 cuts at ~79%** — headwind to the liquidity thesis.
- **C3 — Price holds key support.** Break: sustained < $60k, or < $54k realized price. *Now:* $62.6k; $66–65k support already broken; realized $54k looming.
- **C4 — "Diamond hands" institutional conviction.** Break: a major treasury holder sells materially. *Now:* Strategy sold a token 32 BTC (<0.004%), shares −6% — sentiment fragile.

### Prediction-market leading indicators (VERIFIED LIVE)
- **Polymarket — "What price will Bitcoin hit in 2026?"** (https://polymarket.com/event/what-price-will-bitcoin-hit-before-2027) — price-bucket term structure; re-pull bucket odds live.
- **Kalshi — "Number of rate cuts in 2026?"** (https://kalshi.com/markets/kxratecutcount/number-of-rate-cuts/kxratecutcount-26dec31). **0 cuts ≈ 79%**, 1 cut ≈ 19%, 2 cuts ≈ 3%; deep liquidity (OI ~547k, vol ~1.4M). *Primary-source (Kalshi API) verified; last-price stamped 2026-04-09 → refresh.* A macro liquidity leading indicator for BTC (and LLY/CCJ valuation).

### Alt-sentiment (Reddit)
- BTC is **not** in equity Reddit trackers (WSB/AltIndex track stock tickers). Use **r/Bitcoin · r/CryptoCurrency** post volume + Fear & Greed. *Leading signal:* capitulation/▼-sentiment spikes during outflow streaks. *(Gap flag: needs a crypto-sub sentiment source, not WSB.)*

### Curated news
- **Investing.com — Jun 3, 2026:** "Bitcoin falls as record ETF outflows and Strategy sale hit sentiment." https://www.investing.com/analysis/bitcoin-falls-as-record-etf-outflows-and-strategy-sale-hit-sentiment-200681446
- **IG — May 27, 2026:** "Bitcoin outlook 2026: ETF outflows, institutional demand & geopolitics" (Std Chartered $100k). https://www.ig.com/en/news-and-trade-ideas/bitcoin-outlook-2026--etf-outflows--institutional-demand-and-geo-260527
- **Fortune — Jun 24, 2026:** Bitcoin price $62,651; −41% YoY. https://fortune.com/article/price-of-bitcoin-06-24-2026/
- *(For top-tier: pull Bloomberg/WSJ on the ETF-outflow streak and Std Chartered target cut.)*

---

# 4) LLY — Eli Lilly  ·  archetype: GLP-1 secular demand (healthcare)
**Current state (verified):** Q1 2026 revenue **$19.8B (+56% YoY)**, adj EPS **$8.55 (+156%)**. Tirzepatide = **$12.8B** (~65% of revenue): Mounjaro $8.7B (+125%), Zepbound $4.1B (+79%). GLP-1 share **60.1% vs Novo 39.4%**; Novo guides −4% to −12% 2026. Oral pill **Foundayo (orforglipron)** FDA-approved Apr 1, 2026; EU/UK launch H2-2026/early-2027 (telehealth/cash-pay first; "most-favoured-nation" pricing headwind). **Foundayo lagging Novo's oral**: ~16k vs ~146k scripts (wk ending May 22). FY2026 guidance was lifted during 2026 (confirm exact figure live; initial was $80–83B / $33.50–35.00).

### Thesis options
- **A. GLP-1 demand dominance** — Lilly is the share leader in a still-undersupplied obesity/diabetes TAM.
- **B. Oral GLP-1 + international unlock** — Foundayo (a pill) + ex-US expansion widens the funnel beyond injectables.
- **C. Pipeline diversification** — vaccines/infectious-disease M&A ($3.8B) reduces single-franchise risk.

### Claims (Thesis A)
- **C1 — Tirzepatide revenue keeps compounding.** Break: Mounjaro+Zepbound combined growth decelerates / 2 quarters miss. *Leading:* IQVIA prescription tracker, search/web demand. *Confirming:* quarterly product revenue. *Now:* +125%/+79% — accelerating.
- **C2 — Lilly holds/extends GLP-1 share vs Novo.** Break: combined share < 50%. *Leading:* weekly Rx share. *Confirming:* earnings. *Now:* 60.1%, Novo guiding down — strong.
- **C3 — Foundayo wins the oral market.** Break: weekly Rx-share gap to Novo's oral fails to close by YE-2026. *Leading:* FiercePharma "Oral GLP-1 Tracker." *Now:* **WEAKENING** (16k vs 146k).
- **C4 — International expansion executes.** Break: no EU/UK marketing authorization or telehealth stalls by Q1-2027. *Leading:* EMA/MHRA approvals, telehealth volume. *Now:* launch planned H2-26; MFN pricing risk.

### Prediction-market leading indicator (GAP — flag)
- No live **asset-specific** market found. Use **Metaculus** FDA-approval / drug-sales questions, or the **Kalshi rate-cut** market (valuation proxy). *Recommend commissioning a bespoke market ("Will Lilly's GLP-1 share stay > 50% through 2026?") for the demo.*

### Alt-sentiment (Reddit) — thin
- LLY **not** in WSB/equity-tracker top-20/100 → low retail chatter. Occasional r/stocks. *This thinness is itself signal:* LLY is a domain-expert/institutional hold, not a meme. *Leading proxy:* r/stocks + medical/biotech subs (r/biotech) thread volume.

### Curated news
- **CNBC — Feb 4, 2026:** "Eli Lilly's GLP-1 growth only getting started as Novo braces for a 2026 decline." https://www.cnbc.com/2026/02/04/eli-lilly-novo-nordisk-earnings-glp1-market.html
- **Seeking Alpha — Jun 23, 2026:** "Eli Lilly eyeing European launch of obesity pill." https://seekingalpha.com/news/4606275-eli-lilly-eyeing-european-launch-obesity-pill
- **Reuters (Jun 23, 2026, via FiercePharma/IBTimes):** EU obesity-pill go-to-market via telehealth/cash-pay; MFN pricing.
- *(WSJ/FT/Bloomberg carry the earnings + EU-launch stories — pull for the feed.)*

---

# 5) CCJ — Cameco / uranium  ·  archetype: commodity + AI-power
**Current state (verified):** Uranium spot **~$85.65/lb** (Jun 24, +9.95% YoY), range-bound ~$85 since April; long-term contracts approaching $100. Structural gap: **3.1B lbs uncontracted through 2045** (1.3B lbs no identified supply); ~190M-lb demand vs ~180M supply (2025–26). Cameco raised Cigar Lake stake to **57.4%** ($115.75M, closes Q3-2026); 2026 output 17.5–18M lbs; mine life extended to 2036; 49% of **Westinghouse** (~$10–12B). 70% of contracts market-linked (floors mid-$70s, ceilings to $150). **Meta and Microsoft both signed nuclear-capacity deals for AI data centers.**

### Thesis options
- **A. Uranium supply deficit / price squeeze** — structural undersupply forces utilities to contract at higher prices.
- **B. AI-power → nuclear renaissance** — hyperscaler datacenter power demand drives a nuclear buildout (the cross-narrative).
- **C. Cameco vertical integration** — fuel services + Westinghouse make it a full nuclear-fuel-cycle play, not just a miner.

### Claims (Thesis A/B)
- **C1 — Structural supply deficit persists.** Break: new supply (Kazatomprom ramp, restarts) closes the gap / spot < $70 sustained. *Leading:* uranium spot (Trading Economics/UxC), utility contracting volume, mine-restart news. *Confirming:* Cameco production & contract book. *Now:* ~$85, deficit intact but range-bound (muted utility buying = watch item).
- **C2 — AI-datacenter power demand drives nuclear.** Break: hyperscaler nuclear deals stall / SMR timelines slip. *Leading:* hyperscaler nuclear PPAs (Meta/MSFT done), SMR permits, datacenter-power job postings. *Now:* bullish (Meta+MSFT signed).
- **C3 — Cameco realizes higher prices.** Break: realized price stalls (market-linked floors cap upside capture). *Leading:* contract structure, spot. *Confirming:* Cameco earnings realized price. *Now:* 70% market-linked, floors mid-$70s.
- **C4 — Cameco execution.** Break: production misses 17.5–18M lbs / Cigar Lake deal falls through. *Now:* stake raised, life to 2036, deal closes Q3-26 — on track.

### Prediction-market leading indicator (GAP — flag)
- No live **asset-specific** market found. Use **Metaculus** nuclear/SMR-deployment questions; **Kalshi rate-cut** as a financing/valuation proxy. *Recommend a bespoke market ("Uranium spot > $100/lb by [date]?") for the demo.*

### Alt-sentiment (Reddit)
- **r/UraniumSqueeze** — passionate, dedicated community; Finimize noted "uranium stocks at a 7-year high as Reddit takes notice." CCJ not in WSB top-100. *Leading signal:* r/UraniumSqueeze post/comment volume + spot-price threads (a genuine retail-flow tell for this sector).

### Curated news
- **The Globe and Mail — Jun 2, 2026:** "Cameco raises Cigar Lake stake in $115.75M deal." https://www.theglobeandmail.com/investing/markets/stocks/CCJ/pressreleases/2269317/cameco-raises-cigar-lake-stake-in-11575-million-deal-to-extend-uranium-growth/
- **Trading Economics — Jun 24, 2026:** Uranium ~$85/lb; Meta & Microsoft sign nuclear capacity for AI datacenters. https://tradingeconomics.com/commodity/uranium
- **Finimize:** "Uranium stocks climb to seven-year high as Reddit takes notice — Cameco." https://finimize.com/content/cameco-uranium-stocks-climb-seven-year-high-reddit-takes-notice
- *(Reuters/Bloomberg/FT carry the Cameco deal + hyperscaler-nuclear stories — pull for the feed.)*

---

## Cross-asset live signals worth reusing
- **Kalshi "Number of rate cuts in 2026?"** (0 cuts ≈ 79%) — a macro liquidity leading indicator that touches BTC, LLY, CCJ, and TSLA-demand theses.
- **Polymarket "Largest company end of December 2026?"** and **"AI bubble burst by…?"** — AI-complex barometers usable across NVDA (and indirectly TSLA).
- **Reddit mention-velocity (Ape Wisdom / AltIndex)** works well for NVDA/TSLA; crypto and uranium need their native subs (r/Bitcoin, r/UraniumSqueeze).
