# Plays page — build handoff

Everything a fresh Claude Code session needs to build the **Plays** page of Thesis. Read this top-to-bottom once; it captures the stack, design language, the movable-card architecture, every data pipeline, secrets, and the exact conventions/gotchas that already cost debugging time.

> Working dir: `/Users/veeradittya/Desktop/Thesis` · not a git repo yet · macOS · Node/Next dev on **:3000**.
> Comm style the user expects: **very succinct.** Do not mention today's date to the user.

---

## 0. What "Plays" is (the one open decision)

The top nav is **Portfolio · Plays** (`src/components/MonacoHome.tsx`, the `<nav>` around line 328). **`Portfolio` is the current dashboard; `Plays` is a placeholder button with no `onClick` yet.** Nothing is built behind it — that's the job.

There is **no committed spec** for Plays. Before building, get the user to pin it down. Given the product (below), the likely readings, in rough order:

1. **Actionable prediction-market plays** — curated, rankable "bets" derived from the portfolio + live Oddpool signals (e.g. "NVDA stays #1 by mkcap → YES 59%, whales bullish, thesis-aligned"). Natural fit with the existing Oddpool pipeline and the movable-card canvas.
2. **Thesis decomposition workspace** — the *original* product mechanic (decompose a plain-English thesis into falsifiable claims + break conditions, monitor each). A lot of this already exists as **legacy** components (`ThesisForm`, `ThesisOnboarding`, `ThesisDashboard`, `/api/decompose`, `/api/thesis-ideas`) from the pre-Monaco design — could be revived and re-skinned into "Plays."
3. **Saved/active positions** — what the user has acted on (watchlist of markets/events they've committed to), a tracker.

**Ask which one** (or what blend) before writing code. The rest of this doc is interpretation-agnostic: it gives you the shell, patterns, and data to build any of them fast.

---

## 1. Product context (why this app exists)

**Thesis** — "the WHOOP for your portfolio." A B2C dashboard that watches the world and tells a retail investor when their investment thesis breaks. Core mechanic (original vision): decompose a thesis into 3–5 falsifiable claims each with a "kill switch" break condition, monitor via **leading** signals (prediction markets, social, search) + **confirming** sources (filings, earnings, price), and alert on state change (Holding → Weakening → Broken).

The build has since pivoted the **homepage** into a **Monaco.com-styled** movable-card canvas over the **Oddpool** prediction-market API + Guardian news. That canvas IS the Portfolio page. Plays is the second surface. Full product memory: `~/.claude/projects/-Users-veeradittya-Desktop-Thesis/memory/thesis-project-overview.md`.

---

## 2. Stack & libraries (exact)

- **Next.js 16.2.1** (App Router, Turbopack) · **React 19.2.4** · **TypeScript 5** · **Tailwind v4** (`@import "tailwindcss"` in `globals.css`; PostCSS via `@tailwindcss/postcss`; **no `tailwind.config.js`** — theme is CSS-first via `@theme inline`).
- **motion** `^12` (the Framer-Motion successor; import from `"motion/react"`) — used by the recreated Aceternity UI bits.
- **lucide-react** `^1.21` — icons (though most card icons are hand-inlined SVGs).
- **clsx** + **tailwind-merge** → the `cn()` helper in `src/lib/utils.ts`. Use `cn(...)` for all conditional classes.
- **xlsx** `^0.18` — portfolio parsing (`src/lib/parsePortfolio.ts`), dynamically imported to keep it out of the initial bundle.
- **ws** `^8` — server-side Finnhub websocket (`src/lib/priceStream.ts`).
- **@anthropic-ai/sdk** `^0.105` — used as the *fallback* LLM path only; the **primary** LLM path is the Dartmouth gateway via plain `fetch` (see §7).
- **plaid** + **react-plaid-link** — sandbox brokerage linking (`ConnectBrokerage`), mostly dormant.

Run: `npm run dev`. Preview tooling: `.claude/launch.json` defines server **`thesis-dev`** (`npm run dev`, port 3000, `autoPort`). Use `preview_start`/`preview_*` tools, not raw Bash, to drive the browser.

---

## 3. Design language (Monaco.com aesthetic)

The homepage is styled to **monaco.com**: true-black canvas, Inter with tight tracking, near-white text, hairline borders, floating liquid-glass nav, a white pill CTA.

### Fonts (wired in `src/app/layout.tsx`)
- `--font-inter` (Inter) — **sans, the default** (`font-sans`).
- `--font-geist-mono` (Geist Mono) — `font-mono` (used for terminal/tabular bits).
- `--font-serif` (EB Garamond) — the **THESIS** wordmark only (all-caps, `letter-spacing:0.05em`).
- `<html>` has `.dark` always on. App is dark-only in practice.

### Color tokens (`src/app/globals.css`)
shadcn **radix-rhea** preset: **stone neutrals + emerald primary**, `0.625rem` radius, oklch tokens, mapped onto app token names so utilities like `bg-panel`, `text-text-muted`, `border-border`, `text-crimson` (→ emerald), `text-positive`, `text-negative` all resolve. The `--color-*` → `var(--token)` mapping lives in the `@theme inline` block. **`crimson` is a legacy name that now resolves to the emerald primary** — don't be fooled by the name.

But note: the **Monaco cards mostly hardcode near-black hex + white-alpha borders** rather than the token utilities (the tokens matter more for the legacy shadcn components). The canonical Monaco card look is a literal recipe (below), not `bg-panel`.

### Canonical movable-card shell (copy this for any Plays card)
From `SignalSearchCard.tsx` — the current reference card:
```tsx
<div
  onPointerDown={raise}
  style={style}                                   // from useMovableCard → {left,top,width,height,zIndex}
  className="fade-in absolute flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06]
             bg-[#0e0e0e] font-sans tracking-[-0.01em] shadow-[0_24px_70px_rgba(0,0,0,0.6)]"
>
  {/* header = the drag handle */}
  <div {...dragHandle} className="shrink-0 cursor-move touch-none select-none border-b border-white/[0.06] px-5 pt-4 pb-3">
    <p className="text-[10px] uppercase tracking-wider text-[#8a8a8a]">SECTION · LABEL</p>
    <p className="mt-1 text-[12.5px] leading-snug text-white/90">Title</p>
    {/* close button: onPointerDown={e=>e.stopPropagation()} so it doesn't start a drag */}
  </div>

  {/* body — scrolls, hides scrollbar */}
  <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2"> … </div>

  {/* resize corner, bottom-right */}
  <div {...resizeHandle} className="absolute bottom-0 right-0 z-20 flex h-7 w-7 cursor-nwse-resize touch-none items-end justify-end p-1.5 text-white/40 hover:text-white/80">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M11 4L4 11M11 8L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
  </div>
</div>
```

### Recurring style values (keep consistent)
- Card bg `#0e0e0e`; borders `border-white/[0.06]`; radius `rounded-[20px]` (cards), `rounded-lg` (rows), `rounded-md` (chips).
- Muted text `#8a8a8a` / `#666`; body text `text-white/90`; kickers `text-[10px] uppercase tracking-wider text-[#8a8a8a]`.
- **Search/list row idiom** (matched across SearchCard, SignalSearchCard): one line = `venue 9px uppercase` · `title 10px` · `volume 10px tabular` · `YES% 10px semibold emerald` (or `N mkts`). YES% is always emerald (`text-emerald-400`).
- Money/pct formatters (`fmtUSD`, `pct`) are duplicated per-card by design (keeps client cards from importing server-only libs). `fmtUSD`: `$1.9B / $177K / $656`. `pct`: `Math.round(x*100)%`.
- Hover: `hover:bg-white/[0.04]`. Fade-in on mount: the `fade-in` class (keyframes in globals.css). Terminal/log style: `font-mono text-[10.5px] bg-black/50 border-white/[0.08]`, green `›`/`$` markers, `animate-pulse` cursor block.
- The nav pill: fixed, `top-6`, `rounded-[16px]`, `backgroundColor:#3a3a3a66`, `backdropFilter: blur(24px)`, `pointer-events-none` wrapper with `pointer-events-auto` inner.

---

## 4. The movable-card canvas architecture (the core pattern)

The Portfolio page is a **scrollable canvas of movable/resizable cards**. Plays will almost certainly reuse this. Three primitives:

### `useMovableCard(id, def, opts?)` — `src/components/ui/useMovableCard.ts`
- `def = {x,y,w,h}`, `opts = {minW?,minH?}` (defaults 340/220).
- Returns `{ box, z, raise, style, dragHandle, resizeHandle }`.
- `style` is inline `{left,top,width,height,zIndex}` — spread onto the card root.
- Persists position/size to `localStorage["thesis.layout." + id]` on drag/resize release; restores on mount. **`id` must be unique & stable per card** (e.g. `` `play:${playId}` ``).
- Shared `zTop` counter → `raise()` (called on `onPointerDown`) brings a card to front.
- `dragHandle` goes on the header; `resizeHandle` on the corner. Buttons inside the header must `onPointerDown={e=>e.stopPropagation()}`.

### `ui/card.tsx` — shadcn Card primitive
`Card / CardHeader / CardTitle / CardDescription / CardAction / CardContent / CardFooter`, themed to tokens (`bg-panel`, `border-border`). Used by legacy/shadcn-flavored surfaces. The Monaco movable cards generally **don't** use it (they use the literal shell in §3) — but it's the right base if a Plays surface is a static shadcn-style panel rather than a floating card.

### `usePollingActive(ref)` — `src/components/ui/usePollingActive.ts`
Returns a `boolean` ref that's true only when the tab is visible AND the card is on-screen (IntersectionObserver + visibilitychange). **Pattern:** do the initial fetch unconditionally, then gate the recurring `setInterval` on `activeRef.current`. Keeps the Oddpool free-tier budget in check without tearing down effects (which would drop an in-flight initial fetch).
```ts
const rootRef = useRef<HTMLDivElement>(null);
const active = usePollingActive(rootRef);
useEffect(() => { load(); const id = setInterval(() => { if (active.current) load(); }, 6000); return () => clearInterval(id); }, []);
```

### Where cards mount + how new ones spawn — `MonacoHome.tsx`
The canvas renders only when `ledger` is set. Adding a Plays card type means adding it here, following the exact established pattern:
- **State:** `const [openX, setOpenX] = useState<Array<T & {_x,_y}>>([])`.
- **Open fn:** dedup by id, `findEmptySpot(w,h)` for a non-overlapping position, append `{...item,_x,_y}`.
- **Close fn:** filter it out.
- **Render:** `{openX.map(o => <XCard key={o.id} … x={o._x} y={o._y} onClose={()=>closeX(o.id)} />)}` inside the `<div ref={canvasRef}>`.
- **Spawn trigger:** either a right-click menu item (see `menuItems` + `onCanvasContextMenu`, uses `ContextMenu` from `src/components/ContextMenu.tsx`, `MenuItem = {label, onClick?, children?, disabled?, hint?}`) or a button/nav click.
- **findEmptySpot(w,h):** scans a `CANVAS_W×CANVAS_H` (2000×1500) grid for a gap among existing `.fade-in.absolute` cards; falls back to `{80,140}`.

### Dynamic canvas sizing (already handled — don't re-solve)
A `MutationObserver` on `canvasRef` (deps `[ledger]`) keeps **+400px (`CANVAS_MARGIN`) of free space** beyond the right-most and bottom-most card, growing/shrinking `canvasSize`. **Gotcha that already bit us:** it uses `setTimeout(recompute,32)` **not `requestAnimationFrame`** — rAF does not fire in the headless preview, so the canvas would get stuck at the floor. Keep setTimeout.

### Persistence of *which* cards are open (macro-card pattern)
Beyond per-card layout, MonacoHome persists the open **set** so cards survive reload until manually closed:
- Restore-on-mount effect reads `thesis.markets.open`, `thesis.events.open`, `thesis.signals.open`, `thesis.search.open`, `thesis.macro.open`, then sets `hydrated=true`.
- Write-on-change effects are **gated on `hydrated`** so the initial empty state doesn't clobber saved cards.
- **For Plays:** add `thesis.plays.open` (array of ids/stubs) + its own hydrate/persist pair, same shape. Results that cost an LLM call should also cache under their own key (see SignalSearchCard: `thesis.signals.result.<id>`) so reopen/reload doesn't re-spend.

---

## 5. How to add the Plays page (mechanics)

Right now `Portfolio` just scrolls the canvas to top; `Plays` does nothing. Two viable approaches — **confirm with the user, but default to (A):**

**(A) In-place view switch inside MonacoHome (recommended — keeps the single-page shell & nav pill).**
Add `const [view, setView] = useState<"portfolio"|"plays">("portfolio")`. Wire `onClick={()=>setView("portfolio"/"plays")}` on the two nav buttons; show an active state (e.g. drop the `opacity-80`, full opacity when active). Then in `<main>`, render the existing canvas when `view==="portfolio"` and a **Plays surface** when `view==="plays"`. Plays can be its own canvas (`ref`, `findEmptySpot`, its own card set) or a static composed layout. Persist the last view in `localStorage` if desired.

**(B) A real route `/plays`.** Add `src/app/plays/page.tsx`. But the nav pill, ledger seeding, and canvas plumbing all live in `MonacoHome`; a second route means duplicating or extracting that shell. Only do this if Plays is meaningfully different from the canvas. (There is currently **no** file-routing for sub-pages — `/` is the only page; `/portfolio` 404s.)

**Legacy note:** `NewsPage.tsx`, `InboxPage.tsx`, `ThesisDashboard.tsx`, `ui/sidebar.tsx`, `Header.tsx`, `floating-dock.tsx` are **orphaned** from the pre-Monaco sidebar app shell — not mounted anywhere now. They're a source of ready-made markup (esp. `ThesisDashboard`/`InboxPage` for a claims/monitors view) if Plays revives that direction, but nothing renders them today.

---

## 6. Data pipelines

All third-party keys are **server-side only** (`.env.local`); the browser never sees them. Client cards call our own `/api/*` routes. Pattern: `src/lib/<source>.ts` (server client) → `src/app/api/<source>/route.ts` (thin wrapper) → client card `fetch("/api/…")`.

### Oddpool — prediction markets (Kalshi + Polymarket) — PRIMARY data source
- Client: `src/lib/oddpool.ts`. Base `https://api.oddpool.com`, header **`X-API-Key: $ODDPOOL_API_KEY`**.
- **Free tier: rate-limited (~1k req/mo, bursty 429s).** `oddpoolGet` uses Next data cache (`next:{revalidate:300}`) + one 1.2s backoff-retry on 429; `oddpoolGetFresh` is `no-store` for whale/dynamic data. **Respect the budget** — cache, and gate polling with `usePollingActive`.
- Key functions (all server-side): `getPortfolioMarkets()`, `getPortfolioPredictionRadar()`, `getMarketDetail(id, …, range)`, `getEventDetail(eventId, exchange, range)`, `getWhaleFeed()`, `getMarketWhales(marketId, eventTicker, exchange)`, `getEventWhales(eventTicker, exchange)`, `searchMarkets(q, limit)`, **`searchEventsFull(params)`** / **`searchMarketsFull(params)`** (full search; require `q` OR `series_id`, else 400; `status`/`limit`/`last` filters). Types: `MarketLite`, `EventResult`, `MarketResult`, `MarketDetail`, `ChartRange = "24h"|"3d"|"7d"|"30d"`, whale types.
- OHLCV time-bucket floor is **6h** (so a 24H chart ≈ 4 points).
- Whale tracking **writes to the user's own Oddpool Pro account** (authorized): browsing auto-tracks; capped + auto-pruned (LRU 40, untrack via `DELETE /whales/user/events/by-ticker/{exchange}/{ticker}`). If Plays surfaces whale data, reuse `noteBrowseTrack`/`oddpoolDelete` in `oddpool.ts`.
- Existing routes: `/api/oddpool/search`, `/api/oddpool/event`, `/api/oddpool/event/whale`, `/api/prediction/*`, `/api/whales/*`, `/api/macro/*`.
- Reference cards: `PortfolioMarketsCard`, `MarketDetailCard`, `EventDetailCard`, `WhaleCard`, `SearchCard`, `PredictionChart` (charts: 24H/3D/7D/30D toggle, labeled/ticked axes, hover tooltips).

### Guardian — news
- `src/lib/guardian.ts`. `getNews(query)` → `NewsPayload {items: NewsItem[]}`; `getArticle(id)` → `Article {paragraphs[], …}`; `getLiveUpdates(id)`; `isLiveBlog(title)`. `NewsItem = {id,title,trailText,section,url,published,byline,image,imageAlt,takeaway?}`. Key `$GUARDIAN_API_KEY`. Route `/api/guardian` (+ `/api/news` aggregates Alpaca/Benzinga + Finnhub + NYT + Guardian for the legacy News page). REST only (no websocket) — poll.
- Reference: `NewsAlertCard`, `ArticleCard`.

### Finnhub — live prices (websocket → SSE relay)
- `src/lib/priceStream.ts` holds **one shared** Finnhub WS (free tier allows one), ref-counts symbol subs across SSE clients. `src/lib/prices.ts` `getQuotes(symbols)` for REST quotes; `src/lib/priceStream.ts` `subscribe(symbols, onTrade)`. Key `$FINNHUB_API_KEY`. Routes `/api/prices`, `/api/prices/history`. Also powers `/api/symbol-search` (ticker verify).
- Client consumes via SSE. Reference: `LivePricesCard`, `ChartCard`.

### Dartmouth Claude gateway — LLM (see §7). Used by `signalLink.ts`, `chatAgent.ts`, `/api/decompose`, `/api/thesis-ideas`, `/api/copilot`, `/api/chat`.

### Macro signals — `src/lib/macroFeed.ts` (`getMacroEvents`, `getMacroCatalog`, `subscribeDist`, volumes). Cards `MacroSignalsCard`, `MacroEventCard`. Routes `/api/macro/*`.

### Others (wired, mostly dormant): **Plaid** sandbox (`src/lib/plaid.ts`, `/api/plaid/*`, `ConnectBrokerage`) · **FRED / NYT / Alpaca** keys present for the (unbuilt) confirming-signal engine and the `/api/news` aggregator.

### Portfolio ledger
`src/lib/parsePortfolio.ts` parses an `.xlsx` → `ParsedPortfolio {portfolioName, holdings: ParsedHolding[]}` (`{ticker,name,weight,…}`). Dev seeds `public/panagora.xlsx` (PanAgora 13F top-10) automatically so the canvas is always populated. This `ledger` is the shared context for news queries, price assets, and the chat copilot — **Plays likely keys off the same `ledger.holdings`.**

---

## 7. LLM usage (Dartmouth gateway) — read before any AI feature

- **Primary path** = Dartmouth's **OpenAI-compatible** gateway. Endpoint **`${DARTMOUTH_GATEWAY_BASE}/v1/chat/completions`** (note the `/v1/` — `DARTMOUTH_GATEWAY_BASE` already includes `/api`, so the full URL is `https://chat.dartmouth.edu/api/v1/chat/completions`). Header `Authorization: Bearer $DARTMOUTH_API_KEY`. Body is OpenAI shape: `{model: $DARTMOUTH_MODEL, messages:[{role,content}], temperature, max_tokens}`. Model = `anthropic.claude-sonnet-4-5-20250929`.
- **The Anthropic-direct SDK path is a fallback only — that account is out of credits.** Don't rely on it.
- **Budget is small (~$2). Credits were topped up 2026-07-03 and verified live.** Keep prompts token-lean; cache results client-side; don't spin the LLM on every render.
- The gateway has **no structured-output / tool-calling** — you must parse JSON out of free text. Reuse the robust extractor pattern (strip ```` ```json ```` fences, slice first `{`…last `}`, `JSON.parse`; for arrays that can truncate at `max_tokens`, regex-salvage complete `{…}` objects). See `extractJson` in `/api/thesis-ideas/route.ts` and `parseLooseJSON`/`salvageSignals` in `src/lib/signalLink.ts`.
- **Streaming logs to a card:** the pattern is built and validated in **`src/lib/signalLink.ts` + `/api/signals/route.ts` + `SignalSearchCard.tsx`** — thread an `onLog(line)` callback through the pipeline, have the route return an SSE `ReadableStream` (`data:{type:"log",line}` per stage then `data:{type:"result",…}`, headers `text/event-stream` + `Cache-Control: no-cache, no-transform`), and read it client-side (`res.body.getReader()`, split on `\n\n`, strip `data:`) into a mono terminal box. **Copy this for any long-running Plays AI step.** (The `no-transform` header matters — without it the dev proxy buffers and logs arrive all at once.)
- Chat over the portfolio: `src/lib/chatAgent.ts` `runChat(history, portfolio?)`; card `OddpoolChatCard` ("Ask the markets"); routes `/api/chat`, `/api/copilot`.

---

## 8. Secrets

The real API keys are NOT in this doc (it's git-tracked). They live in **`.env.local`** (dev) and
**`.env.production`** (prod), both **gitignored**. The full list of required keys, with placeholders
and comments, is in **`.env.production.example`** — see also `deploy/README.md`.

Keys the app reads: `ODDPOOL_API_KEY`, `GUARDIAN_API_KEY`, `NYT_API_KEY`, `FINNHUB_API_KEY`,
`ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY`, `DARTMOUTH_API_KEY`/`_GATEWAY_BASE`/`_MODEL`,
`ANTHROPIC_API_KEY`, `PLAID_CLIENT_ID`/`_SECRET`/`_ENV`, and the Auth block
(`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`).

**Never** let any of these reach the client bundle — keep all usage inside `src/lib/*` (server) and
`src/app/api/*` route handlers. Client cards call `/api/*` only.

---

## 9. Conventions & gotchas (already paid for in debugging)

- **cn():** `import { cn } from "@/lib/utils"` for conditional classes.
- **Client vs server split:** client cards duplicate small formatters (`fmtUSD`, `pct`, `venueLabel`) instead of importing from `oddpool.ts`, so server-only modules (with API keys) never get pulled into the browser bundle. Keep doing this.
- **React duplicate keys:** when a card flips modes (e.g. events↔markets) or merges result sets, tag results with their mode and dedup by a composite key; markets can share an `event_id`. Render only items matching the current mode. (See SearchCard's `data={mode,items}` guard.)
- **Polling throttle:** initial fetch unconditional; interval gated on `usePollingActive` ref. Don't tear down the effect on active-flip or you drop the in-flight initial load.
- **Canvas resize uses `setTimeout`, not rAF** (rAF doesn't fire in headless preview). See §4.
- **Layout blowout:** any `whitespace-nowrap` marquee needs `min-w-0` on its flex ancestors or it can blow the layout to ~16000px wide (a real bug we hit with `.signal-scroll`).
- **Preview console buffer is cumulative across reloads** — restart the preview server for a clean read.
- **Whale POSTs modify the user's own Oddpool Pro account** — that's authorized, but be aware they're real writes; cap+prune is already in place.
- **Don't mention today's date to the user.** Convert any relative dates to absolute when writing memory.
- **tsc** is the check: `npx tsc --noEmit`. No test suite. Verify UI changes by driving the `preview_*` tools (reload, snapshot, screenshot), not by asking the user to look.

---

## 10. File map (what to reuse)

| Need | Look at |
|---|---|
| Movable-card shell + drag/resize | `SignalSearchCard.tsx`, `ui/useMovableCard.ts` |
| Fetch-list card with row idiom | `SearchCard.tsx`, `PortfolioMarketsCard.tsx` |
| Detail card w/ chart + whales | `EventDetailCard.tsx`, `MarketDetailCard.tsx`, `PredictionChart.tsx` |
| Long AI job w/ streamed terminal logs | `signalLink.ts` + `api/signals/route.ts` + `SignalSearchCard.tsx` |
| LLM call (gateway + JSON parse) | `api/thesis-ideas/route.ts`, `signalLink.ts`, `chatAgent.ts` |
| Right-click spawn menu | `MonacoHome.tsx` (`menuItems`, `onCanvasContextMenu`), `ContextMenu.tsx` |
| Open-set persistence (hydrate/persist) | `MonacoHome.tsx` lines ~203–224 |
| Live prices SSE | `priceStream.ts`, `LivePricesCard.tsx` |
| Portfolio ledger shape | `parsePortfolio.ts`, `LedgerCard.tsx` |
| Legacy claims/monitors markup (if reviving) | `ThesisDashboard.tsx`, `InboxPage.tsx`, `api/decompose/route.ts` |
| shadcn primitives | `ui/card.tsx`, `ui/badge.tsx` |

**First step in the new session: confirm what "Plays" should be (§0), then pick approach A/B (§5) and build cards with the §3/§4 patterns.**
