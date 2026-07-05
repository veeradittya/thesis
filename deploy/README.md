# betathesis.com — deploy runbook

Companion to the deploy plan. Splits the work into **done in this repo (verified locally)**
and **operator steps I can't run** (web consoles + the `anton` server).

## Done in the repo (verified locally)

- **`next.config.ts`** → `output: "standalone"`.
- **`.env.production`** (gitignored, real values) + **`.env.production.example`** (tracked template).
  The plan's env block was missing the entire data/AI layer — this repo's version includes **all**
  keys the app reads: `ODDPOOL`, `GUARDIAN`, `NYT`, `FINNHUB`, `ALPACA_*`, `DARTMOUTH_*`,
  `ANTHROPIC`, `PLAID_*` (+ `FRED` for parity), plus the Auth block with a **fresh production
  `AUTH_SECRET`**. Without these every card is dead in prod.
- **`.gitignore`** hardened: `.env.production` is now ignored (verified with `git check-ignore`) so
  the `git pull` redeploy loop can't leak secrets to the git host. Only `*.example` are tracked.
- **`/api/prediction` and `/api/prediction/radar`** → `force-dynamic` (were `revalidate`, which
  prerendered them at build time → an Oddpool call on every `npm run build`). Their lib functions
  cache internally, so runtime-dynamic is equivalent without the build-time dependency.
- **Artifacts:** `deploy/betathesis.service`, `deploy/cloudflared-config.yml`, `deploy/deploy.sh`
  (the deploy.sh static/public copy has an `rm -rf` fix — the plan's raw `cp -r` nests into
  `static/static` on the 2nd deploy).
- **Verified locally:** `npm run build` succeeds (standalone emitted); the standalone server boots,
  `GET /` → 200, `/api/prices/history` returns data (prod env loads), and `/api/auth/providers`
  reports `signinUrl: https://betathesis.com/...` (AUTH_URL + AUTH_TRUST_HOST correct).

## Operator steps (web consoles + anton — not runnable from here)

Follow the plan phases; notes below are only the deltas/gotchas.

1. **Phases 1–4 (GoDaddy → Cloudflare → M365 → DNS):** exactly per the plan. Keep all M365 records
   **DNS-only (gray cloud)**; `@`/`www` **Proxied (orange)**.
2. **Phase 5 (tunnel on anton):** use `deploy/cloudflared-config.yml` (fill `<UUID>`); place it at
   `~/.cloudflared/config.yml`.
3. **Phase 6 (app on anton):**
   - Get this repo onto anton at `/home/veer/betathesis` (git clone/pull).
   - **`scp` `.env.production` to `/home/veer/betathesis/.env.production`** — it's gitignored, so
     `git pull` will NOT carry it. (Or recreate it there from `.env.production.example`.)
   - First time: `npm ci && npm run build`, then copy assets and install the service:
     ```bash
     cp -r .next/static .next/standalone/.next/static
     cp -r public .next/standalone/public
     sudo cp deploy/betathesis.service /etc/systemd/system/betathesis.service
     sudo systemctl daemon-reload && sudo systemctl enable --now betathesis
     ```
   - Verify node path in the unit: `which node` (the unit assumes `/usr/bin/node`; nvm differs).
   - Thereafter just run `deploy/deploy.sh` (pull → build → copy → restart).
4. **Phase 7 (Google OAuth):** add both `https://betathesis.com/...` and `https://www.betathesis.com/...`
   callback URIs. **Also:** the OAuth consent screen is in "Testing" → only added test users can sign
   in. For a public beta, publish it (Testing → In production) or keep the test-user allowlist.
5. **Phase 8 (verify):** per plan. SSE features (prices/macro/signals) stream through the tunnel;
   keep Cloudflare SSL mode **Full** (not Full-strict) as the plan says.

## One-time vs. redeploy

- **One-time:** DNS/email/tunnel/OAuth setup + the systemd install above.
- **Every update:** `deploy/deploy.sh`.
