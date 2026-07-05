# Thesis — betathesis.com

A B2C prediction-market portfolio dashboard: a movable-card canvas over the Oddpool prediction-market
API (Kalshi + Polymarket), Guardian/NYT news, Finnhub live prices, and a Dartmouth-hosted Claude for
AI features. Single page (`src/components/MonacoHome.tsx`) rendered at `/`.

**Stack:** Next.js 16 (App Router / Turbopack) · React 19 · TypeScript · Tailwind v4 · Auth.js v5
(Google sign-in, JWT, no DB — state cached in the browser via localStorage).

## Run
- Dev: `npm run dev` (port 3000).
- Prod build: `npm run build` → standalone server at `.next/standalone/server.js` (`output: "standalone"`).
- Typecheck: `npx tsc --noEmit`.

## Env / secrets
All API keys are **server-side only** (used in `src/lib/*` and `src/app/api/*`; never in the client bundle).
They live in `.env.local` (dev) and `.env.production` (prod) — **both gitignored, never commit them**.
The complete required-key list with placeholders is in `.env.production.example`.

## 🚀 Deploying / hosting this site
Self-hosted at `https://betathesis.com` on the box **anton** via a Cloudflare Tunnel + systemd.
**If you are the Claude session on anton (or hosting this site): read and follow
[`deploy/ANTON-HOSTING.md`](deploy/ANTON-HOSTING.md)** — a step-by-step runbook (marks which steps you
run vs. which the human must do in a web console). Overview + what's already prepped: `deploy/README.md`.
Note: `.env.production` is gitignored, so `git pull` does NOT bring the secrets — provision it per Step 0
of that runbook (scp from the Mac, or paste values into `.env.production.example`).

## Conventions
- Cards are movable/resizable (`src/components/ui/useMovableCard.ts`), dark "Monaco.com" aesthetic,
  built from the literal card shell (see any `*Card.tsx`). Layout/open-cards/ledger persist to localStorage.
- Data flow: client card → `/api/*` route → `src/lib/<source>.ts` (holds the key) → third-party API.
- Verify UI changes by driving the app, not by asking the user to check.
