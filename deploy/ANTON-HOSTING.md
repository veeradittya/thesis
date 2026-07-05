# Hosting betathesis.com on `anton` — runbook for the Claude session on that box

You are Claude Code running on **anton** (the self-host box). Goal: serve this Next.js 16 app at
`https://betathesis.com` via a Cloudflare Tunnel, under systemd. Work top to bottom. Steps marked
**🔴 HUMAN** must be done by the user in a web console (you can't) — tell them, then wait. Steps marked
**🟢 YOU** you run yourself. The repo-side prep (standalone build, artifacts, env template) is already
done — see `deploy/README.md`.

Assumes the repo is at `/home/veer/betathesis` and user `veer` with sudo. Node 20+ required.

---

## Step 0 — 🟢 Secrets (`.env.production`) — git did NOT carry this

`.env.production` is gitignored, so it is NOT in the pull. Get it onto this box before building:

- **Preferred:** ask the user to copy it from their Mac:
  `scp .env.production veer@anton:/home/veer/betathesis/.env.production`
- **Or:** `cp .env.production.example .env.production` and have the user paste the real values
  (they're in the Mac repo's `.env.local`).

Then verify it's complete — no blank required values:
```bash
cd /home/veer/betathesis
test -f .env.production && grep -vE '^\s*#|^\s*$' .env.production | grep -E '=\s*$' \
  && echo "!! blank values above — fix before building" || echo "env looks filled"
```
Required keys: `ODDPOOL_API_KEY GUARDIAN_API_KEY NYT_API_KEY FINNHUB_API_KEY ALPACA_API_KEY_ID
ALPACA_API_SECRET_KEY DARTMOUTH_API_KEY DARTMOUTH_GATEWAY_BASE DARTMOUTH_MODEL ANTHROPIC_API_KEY
PLAID_CLIENT_ID PLAID_SECRET PLAID_ENV` plus `AUTH_SECRET AUTH_GOOGLE_ID AUTH_GOOGLE_SECRET`
and `AUTH_URL=https://betathesis.com`, `AUTH_TRUST_HOST=true`, `NODE_ENV=production`.

## Step 1 — 🔴 HUMAN — DNS + email prerequisites (gate everything downstream)

These happen in web consoles (GoDaddy / Cloudflare / M365). Full detail in the deploy plan phases 1–4.
Ask the user to confirm each is done:
1. GoDaddy: domain auto-renew ON; nameservers switched to the two Cloudflare nameservers.
2. Cloudflare: site added on the Free plan, DNS imported, zone status **Active** (nameservers propagated —
   check with `dig NS betathesis.com +short`).
3. M365: domain verified; MX / autodiscover / 2×DKIM / SPF added in Cloudflare, all **DNS-only (gray cloud)**.

Do not proceed to Step 2 until `dig NS betathesis.com +short` shows the Cloudflare nameservers.

## Step 2 — Cloudflare Tunnel (token / dashboard-managed)

**🔴 HUMAN — in the Cloudflare dashboard (one-time):**
1. Dashboard → **Zero Trust** (first time: pick a team name; Free plan — may ask for a card even though $0).
2. **Networks → Tunnels → Create a tunnel → Cloudflared** → name it `betathesis` → Save.
3. On the "Install connector" screen, **copy the token** — the long `eyJ…` string in the shown
   `cloudflared service install eyJ…` command. **This is a secret; hand it to the anton operator
   privately (do NOT commit it).** Don't install from this screen; anton runs it.
4. **Public Hostnames → Add a public hostname** (twice):
   - Subdomain *(blank)*, Domain `betathesis.com`, Type **HTTP**, URL `localhost:3000`.
   - Subdomain `www`, Domain `betathesis.com`, Type **HTTP**, URL `localhost:3000`.
   These auto-create the proxied CNAMEs in DNS. Delete any leftover placeholder A record for `@`.

**🟢 YOU — on anton (the token is passed in; no `tunnel login`, no config.yml):**
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb && cloudflared --version
sudo cloudflared service install <TOKEN>     # installs + starts the systemd connector with the token baked in
systemctl status cloudflared --no-pager | head -5
```
Verify the tunnel shows **Healthy** in the dashboard (Networks → Tunnels). It serves 200s once the app
is up on `localhost:3000` (Step 3). Nothing to give anton for the tunnel except **`<TOKEN>`** + sudo.

## Step 3 — 🟢 Build & run the app

```bash
cd /home/veer/betathesis
node -v                      # must be >= 20
npm ci
npm run build                # emits .next/standalone/server.js
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```
Install the systemd unit — **first verify the node path** (`which node`); if it isn't `/usr/bin/node`,
edit `ExecStart` in the unit accordingly:
```bash
which node
sudo cp deploy/betathesis.service /etc/systemd/system/betathesis.service
sudo systemctl daemon-reload
sudo systemctl enable --now betathesis
systemctl status betathesis --no-pager | head -8
curl -I http://localhost:3000     # expect HTTP 200
journalctl -u betathesis -n 30 --no-pager
```

## Step 4 — 🔴 HUMAN — Google OAuth

In Google Cloud Console → APIs & Services → Credentials → the OAuth client, add redirect URIs:
`https://betathesis.com/api/auth/callback/google` and `https://www.betathesis.com/api/auth/callback/google`.
Also publish the OAuth consent screen (it's in "Testing" → only test users can sign in). Same client id as
dev, so no new secret. (Details/caveats: see [[thesis-auth]] equivalent in the deploy notes.)

## Step 5 — 🟢/🔴 Verify end to end

```bash
curl -I https://betathesis.com          # valid Cloudflare cert, 200
curl -I https://www.betathesis.com
```
Then (🔴 HUMAN): sign in with Google in a browser (should set the JWT cookie), and send test emails both
directions to confirm M365 mail flow + DKIM/DMARC. Keep Cloudflare SSL mode **Full** (not Full-strict).

## Redeploy (every future update)

```bash
./deploy/deploy.sh    # git pull → npm ci → build → copy assets → restart betathesis
```

## If something breaks
- Sign-in fails → confirm `AUTH_TRUST_HOST=true` reached the service: `systemctl show betathesis -p Environment`.
- Site unreachable → `cloudflared tunnel info betathesis`; `journalctl -u cloudflared -f`.
- Email fails after ~1h → `mxtoolbox.com/MXLookup.aspx?domain=betathesis.com`; confirm M365 records are DNS-only.
