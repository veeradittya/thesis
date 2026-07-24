# Deploying betathesis.com on Vercel (primary)

Vercel is the **primary** host for `betathesis.com`. The code is already Vercel-native:
`next.config.ts` has no `output` setting, `/api/quote` replaced the WebSocket/SSE price relay
(serverless-safe polling), and `/api/analyze` sets `runtime="nodejs"` + `maxDuration=60`.

🟢 = a Claude session in the repo can do it · 🔴 = you must do it in a web console.

---

## Step 0 — one-time: import the repo 🔴
1. Vercel → **Add New… → Project** → import `github.com/veeradittya/thesis`.
2. Framework preset: **Next.js** (auto-detected). Build/output settings: leave defaults.
3. Don't deploy yet — set the env vars (Step 1) first, or the first build's pages will run
   with missing keys.

## Step 1 — environment variables (Production + Preview) 🔴
Add every key below under **Settings → Environment Variables**. Values are the same as your
local `.env.local` / `.env.production` (both gitignored — copy them across; never commit).

**Data / market APIs**
- `ODDPOOL_API_KEY` — prediction markets (markets, macro, whale, search cards)
- `GUARDIAN_API_KEY`, `NYT_API_KEY` — news card + keyless web-search fallback
- `FINNHUB_API_KEY` — live-price snapshots (`/api/quote`) + symbol search
- `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY` — alt price/news feed
- `FRED_API_KEY` — macro series · `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` — brokerage link

**Thesis Monitor engine** (`/api/analyze`)
- `DARTMOUTH_GATEWAY_BASE`, `DARTMOUTH_API_KEY` — the Claude gateway (Opus). **Required** for the
  monitor to produce verdicts; without them every row degrades to "couldn't complete".
- `DARTMOUTH_MODEL` — sonnet fallback model. Optional: `DARTMOUTH_OPUS_MODEL` (else the code
  defaults to `anthropic.claude-opus-4-8`).
- `TAVILY_API_KEY` — live Tier-A web search for the analyzer. Optional alt: `EXA_API_KEY`.
  With neither set it falls back to a keyless Guardian+NYT search (narrower, still Tier-A).
- `ANTHROPIC_API_KEY` — legacy; the analyzer uses the Dartmouth gateway, not this. Safe to omit.

**Auth (Google sign-in, Auth.js v5)**
- `AUTH_SECRET` — the existing secret.
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — the OAuth client.
- `AUTH_URL` = `https://betathesis.com`  ← **add this for prod** (canonical callback origin)
- `AUTH_TRUST_HOST` = `true`  ← **add this for prod**

## Step 2 — Google OAuth redirect URIs 🔴
In Google Cloud Console → the OAuth client → **Authorized redirect URIs**, ensure both:
- `https://betathesis.com/api/auth/callback/google`  (already added per prior setup)
- `https://<your-vercel-project>.vercel.app/api/auth/callback/google`  (for the Vercel preview/prod URL)

## Step 3 — first deploy 🔴
Trigger a deploy (push to `main`, or **Deploy** in the dashboard). Confirm the build succeeds and
the `*.vercel.app` URL renders the dashboard.

## Step 4 — point betathesis.com at Vercel 🔴
`betathesis.com` currently resolves via the **Cloudflare Tunnel to anton** (see `ANTON-HOSTING.md`).
To make Vercel primary:
1. Vercel → project → **Settings → Domains → Add** `betathesis.com` (and `www` if desired).
2. In the DNS provider (Cloudflare), replace the tunnel's record for the apex with the record
   Vercel shows — typically an **A record → `76.76.21.21`** (apex) and/or **CNAME → `cname.vercel-dns.com`**
   (www). If the apex is a Cloudflare `CNAME`/tunnel record, delete it first. Set the record to
   **DNS-only (grey cloud)** while Vercel issues its cert, then you may re-enable proxy if desired.
3. Wait for Vercel to show the domain as **Valid / certificate issued**.

## Step 5 — retire or keep anton 🟢/🔴
Once the domain serves from Vercel, the anton systemd service + tunnel are redundant. Keep it as a
warm fallback, or stop it (`sudo systemctl stop betathesis` on anton) — your call.

---

## Notes / gotchas
- **`/api/analyze` latency & plan.** Each call is a Claude Opus + web-search loop that takes
  **~22–30s** (measured). `maxDuration=60` covers it on Vercel **Pro** (and on Hobby's 60s cap),
  but a slow research pass could brush the ceiling → the route then returns a graceful "degraded"
  card. If you see frequent degradations, raise the plan/limit or move analysis to a cron (below).
- **Monitor fan-out cost.** The Thesis Monitor auto-analyzes every holding on first open per NY day
  (concurrency 3, cached in `localStorage` per account). The 10-stock demo = ~10 Opus calls per new
  guest per day. To control cost, consider: (a) analyze only holdings that have a written thesis and
  lazy-load the rest, (b) a **nightly cron** that pre-computes verdicts (the analyze lib is already
  factored as `analyzeThesis()` for exactly this), or (c) a manual "Run" button. Ask and I'll wire one.
- **Orphaned routes.** `/api/prices` (SSE) + `src/lib/priceStream.ts` are no longer used by the
  client (LivePrices polls `/api/quote`). Harmless on Vercel; delete later if you want.
- **Secrets never live in git.** `.env.local` / `.env.production` are gitignored; a `git pull` does
  NOT carry them. Provision them in the Vercel dashboard (Step 1).
