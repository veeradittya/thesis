#!/usr/bin/env bash
# betathesis.com redeploy — run on anton from the repo root (/home/veer/betathesis).
# Standalone output does NOT include static assets or public/, so we copy them in after build.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> git pull"
git pull

echo "==> npm ci"
npm ci

echo "==> next build (standalone)"
npm run build

echo "==> copy static + public into standalone"
# rm -rf first, else `cp -r src dest` nests into dest/src on repeat deploys.
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

echo "==> restart service"
sudo systemctl restart betathesis
sudo systemctl --no-pager status betathesis | head -n 5

echo "==> done. Tail logs with: journalctl -u betathesis -f"
