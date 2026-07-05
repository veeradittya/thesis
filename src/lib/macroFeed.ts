// Server-only Oddpool MACRO feed. Two pieces:
//   1. getMacroEvents() — discover the soonest upcoming macro releases via the REST catalog
//      (/feeds/catalog + /feeds/event-types), enriched with human labels.
//   2. subscribeDist() — a single shared WebSocket that streams cross-venue probability
//      distributions for those events, fanned out to all SSE clients (ref-counted, mirrors
//      priceStream.ts). The API key never leaves the server: WS auth is a message, REST uses
//      the X-API-Key header.

import WebSocket from "ws";

const BASE = "https://api.oddpool.com";
const WS_URL = "wss://feeds.oddpool.com/ws";

function apiKey(): string {
  const k = process.env.ODDPOOL_API_KEY;
  if (!k) throw new Error("ODDPOOL_API_KEY is not set");
  return k;
}

// ── Types shared over the wire (client redeclares these) ─────────────────────
export interface MacroOutcome {
  outcome: string;
  label: string;
  prob: number | null;
  kalshiProb: number | null;
  polyProb: number | null;
  kalshiDepthUsd: number;
  polyDepthUsd: number;
  depthUsd: number;
}
export interface MacroDist {
  eventKey: string;
  seq: number;
  publishedTs: number;
  outcomes: MacroOutcome[];
}
export interface MacroEvent {
  eventKey: string;
  title: string;
  type: string;
  category: string | null;
  label: string | null; // event-type human label (e.g. "FOMC Rate Decision")
  agency: string | null;
  description: string | null; // plain-English explanation of the release
  sourceUrl: string | null; // official release page
  venues: string[];
  releaseAt: string; // ISO
}

// ── Catalog: the next few upcoming macro releases ────────────────────────────
interface CatEvent {
  event_key: string;
  title: string;
  type: string;
  release_at: string;
  status: string;
  venues: string[];
  outcomes: number;
}
interface EventTypeInfo { label?: string; agency?: string; category?: string; description?: string; release_url?: string }

let catalogCache: { at: number; data: MacroEvent[] } | null = null; // full upcoming list
const CATALOG_TTL = 10 * 60 * 1000;
const MAX_EVENTS = 8; // default set shown on the card; Pro allows 10 subscribed events total

async function fetchMacroCatalog(): Promise<MacroEvent[]> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL) return catalogCache.data;

  const headers = { "X-API-Key": apiKey(), Accept: "application/json" };
  const [catRes, typesRes] = await Promise.all([
    fetch(`${BASE}/feeds/catalog?feed=macro&status=active`, { headers, cache: "no-store" }),
    fetch(`${BASE}/feeds/event-types`, { headers, cache: "no-store" }),
  ]);
  if (!catRes.ok) throw new Error(`Oddpool catalog ${catRes.status}`);
  const catJson = await catRes.json();
  const types: Record<string, EventTypeInfo> = typesRes.ok ? (await typesRes.json())?.event_types || {} : {};
  const raw: CatEvent[] = catJson?.feeds?.macro?.events || [];

  const now = Date.now();
  const data = raw
    .filter((e) => e.release_at && Date.parse(e.release_at) > now - 6 * 3600_000) // upcoming, or released <6h ago
    .sort((a, b) => Date.parse(a.release_at) - Date.parse(b.release_at))
    .map((e) => ({
      eventKey: e.event_key,
      title: e.title,
      type: e.type,
      category: types[e.type]?.category || null,
      label: types[e.type]?.label || null,
      agency: types[e.type]?.agency || null,
      description: types[e.type]?.description || null,
      sourceUrl: types[e.type]?.release_url || null,
      venues: e.venues || [],
      releaseAt: e.release_at,
    }));

  catalogCache = { at: now, data };
  return data;
}

// The default Macro Signals set (soonest N upcoming releases) — drives /api/macro.
export async function getMacroEvents(): Promise<MacroEvent[]> {
  return (await fetchMacroCatalog()).slice(0, MAX_EVENTS);
}
// Full upcoming macro catalog — powers the "Add Signal" picker.
export async function getMacroCatalog(): Promise<MacroEvent[]> {
  return fetchMacroCatalog();
}

// ── Shared distribution websocket (ref-counted across SSE clients) ───────────
type OnDist = (dist: MacroDist) => void;
interface Sub { keys: Set<string>; onDist: OnDist }

const subs = new Set<Sub>();
const keyCount = new Map<string, number>();
const latest = new Map<string, MacroDist>();
let ws: WebSocket | null = null;
let authed = false;
let connecting = false;

function normalize(data: {
  event_key?: string; seq?: number; published_ts?: number;
  outcomes?: Array<{ outcome?: string; label?: string; prob?: number; kalshi_prob?: number | null; poly_prob?: number | null; kalshi_depth_usd?: number; poly_depth_usd?: number }>;
}): MacroDist {
  const outcomes: MacroOutcome[] = (data.outcomes || [])
    .map((o) => ({
      outcome: o.outcome || "",
      label: o.label || o.outcome || "",
      prob: o.prob ?? null,
      kalshiProb: o.kalshi_prob ?? null,
      polyProb: o.poly_prob ?? null,
      kalshiDepthUsd: o.kalshi_depth_usd || 0,
      polyDepthUsd: o.poly_depth_usd || 0,
      depthUsd: (o.kalshi_depth_usd || 0) + (o.poly_depth_usd || 0),
    }))
    .sort((a, b) => (b.prob ?? 0) - (a.prob ?? 0));
  return { eventKey: data.event_key || "", seq: data.seq ?? 0, publishedTs: data.published_ts ?? 0, outcomes };
}

function ensureWs() {
  if (connecting) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  connecting = true;
  authed = false;
  const sock = new WebSocket(WS_URL);
  ws = sock;

  sock.on("open", () => {
    connecting = false;
    sock.send(JSON.stringify({ action: "auth", api_key: apiKey() }));
  });
  sock.on("message", (buf: Buffer) => {
    let m: { channel?: string; data?: unknown; type?: string; status?: string };
    try { m = JSON.parse(buf.toString()); } catch { return; }
    // Control frames (auth ack / subscribe ack) have no channel/data pair.
    if (!m.channel || !m.data) {
      if (m.type === "auth" && m.status === "ok") {
        authed = true;
        const chans = [...keyCount.keys()].flatMap((k) => [`dist:${k}`, `snapshot:${k}`]);
        if (chans.length) sock.send(JSON.stringify({ action: "subscribe", channels: chans }));
      }
      return;
    }
    if (!m.channel.startsWith("dist:") && !m.channel.startsWith("snapshot:")) return;
    // `snapshot` carries the same per-outcome fields (under `outcomes` or `distribution`) — it
    // arrives on a ~60s cadence even for quiet events, so it seeds markets that never tick.
    const data = m.data as Parameters<typeof normalize>[0] & { distribution?: Parameters<typeof normalize>[0]["outcomes"] };
    const dist = normalize({ ...data, outcomes: data.outcomes?.length ? data.outcomes : data.distribution || [] });
    if (!dist.eventKey || !dist.outcomes.some((o) => o.prob != null)) return; // ignore empty (no-quote) frames
    latest.set(dist.eventKey, dist);
    for (const sub of subs) if (sub.keys.has(dist.eventKey)) sub.onDist(dist);
  });
  sock.on("close", () => {
    connecting = false;
    authed = false;
    if (ws === sock) ws = null;
    if (keyCount.size > 0) setTimeout(ensureWs, 1500); // reconnect while clients remain
  });
  sock.on("error", () => { try { sock.close(); } catch {} });
}

function wsSend(action: "subscribe" | "unsubscribe", keys: string[]) {
  if (ws && ws.readyState === WebSocket.OPEN && authed && keys.length) {
    ws.send(JSON.stringify({ action, channels: keys.flatMap((k) => [`dist:${k}`, `snapshot:${k}`]) }));
  }
}

// Register a client; returns an unsubscribe fn to call when the SSE connection closes.
export function subscribeDist(keys: string[], onDist: OnDist): () => void {
  const sub: Sub = { keys: new Set(keys), onDist };
  subs.add(sub);
  const added: string[] = [];
  for (const k of sub.keys) {
    const c = (keyCount.get(k) || 0) + 1;
    keyCount.set(k, c);
    if (c === 1) added.push(k);
  }
  ensureWs();
  wsSend("subscribe", added); // if not yet authed, the open handler subscribes everything

  return () => {
    if (!subs.has(sub)) return;
    subs.delete(sub);
    const dropped: string[] = [];
    for (const k of sub.keys) {
      const c = (keyCount.get(k) || 1) - 1;
      if (c <= 0) { keyCount.delete(k); dropped.push(k); }
      else keyCount.set(k, c);
    }
    wsSend("unsubscribe", dropped);
    if (subs.size === 0 && ws) { try { ws.close(); } catch {} ws = null; }
  };
}

// Last-known distribution for warm-seeding a newly connected client.
export function getLatest(keys: string[]): MacroDist[] {
  return keys.map((k) => latest.get(k)).filter((d): d is MacroDist => !!d);
}

// ── Per-outcome traded volume (REST — not on the live feed) ──────────────────
// Volume lives only in Oddpool's REST market data, keyed by venue market IDs. We resolve the
// venue event whose price ladder *fingerprints* the live feed mids (reliable even for recurring
// monthly events with look-alike months), then map each outcome's strike → traded volume (USD).
const KEYWORD_BY_TYPE: Record<string, string> = {
  employment: "ADP",
  unemployment: "unemployment rate",
  jobless: "jobless claims",
  cpi: "CPI",
  pce: "PCE",
  nfp: "nonfarm payrolls",
  gdp: "GDP",
  fomc: "fed",
  rates: "fed funds",
};
const parseNum = (t: string | null | undefined): number | null => {
  const m = (t || "").match(/-?[\d,]+(?:\.\d+)?/);
  return m ? parseFloat(m[0].replace(/,/g, "")) : null;
};
const kalshiStrike = (id: string): number | null => {
  const m = (id || "").match(/-T?(-?\d+(?:\.\d+)?)$/);
  return m ? parseFloat(m[1]) : null;
};
interface RestMarket { market_id: string; exchange: string; question: string; volume: number | null; last_yes_price: string | null }
interface RestEvent { event_id: string; exchange: string; title: string; total_volume: number | null; market_count: number }
// Polymarket questions embed a year ("…June 2026… be 4.3%?"), so parse the % value or the value
// after a comparator — never the leading year — so the strike matches the feed outcome.
const polyStrike = (q: string | null | undefined): number | null => {
  const s = q || "";
  let m = s.match(/(-?[\d,]+(?:\.\d+)?)\s*%/);
  if (m) return parseFloat(m[1].replace(/,/g, ""));
  m = s.match(/\b(?:be|above|below|least|over|under|reach|hit)\s+\$?(-?[\d,]+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1].replace(/,/g, "")) : null;
};
const marketStrike = (m: RestMarket): number | null => (m.exchange === "kalshi" ? kalshiStrike(m.market_id) : polyStrike(m.question));

async function opGet<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(BASE + path, { headers: { "X-API-Key": apiKey(), Accept: "application/json" }, cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

const volCache = new Map<string, { at: number; data: Record<string, number> }>();
const VOL_TTL = 5 * 60 * 1000;

export async function getMacroEventVolumes(key: string): Promise<Record<string, number>> {
  const hit = volCache.get(key);
  if (hit && Date.now() - hit.at < VOL_TTL) return hit.data;

  const out: Record<string, number> = {};
  try {
    const ev = (await getMacroEvents()).find((e) => e.eventKey === key);
    const dist = getLatest([key])[0];
    const kw = ev && KEYWORD_BY_TYPE[ev.type];
    if (ev && dist && kw) {
      const feedMid = new Map<number, number>();
      for (const o of dist.outcomes) {
        const s = parseNum(o.label);
        if (s != null && o.prob != null) feedMid.set(s, o.prob);
      }
      const need = Math.max(2, Math.ceil(feedMid.size / 2));
      const evsRaw = await opGet<RestEvent[] | { events: RestEvent[] }>(`/search/events?q=${encodeURIComponent(kw)}`);
      const evList: RestEvent[] = Array.isArray(evsRaw) ? evsRaw : evsRaw?.events || [];

      for (const venue of ev.venues) {
        const cands = evList.filter((e) => e.exchange === venue).slice(0, 8);
        const scored: Array<{ markets: RestMarket[]; matched: number; dist: number }> = [];
        for (const c of cands) {
          const mkRaw = await opGet<RestMarket[] | { markets: RestMarket[] }>(`/search/events/${encodeURIComponent(c.event_id)}/markets`);
          const arr: RestMarket[] = Array.isArray(mkRaw) ? mkRaw : mkRaw?.markets || [];
          let matched = 0;
          let dist = 0;
          for (const m of arr) {
            const s = marketStrike(m);
            if (s != null && feedMid.has(s)) {
              const y = parseFloat(m.last_yes_price || "");
              if (!isNaN(y)) {
                matched++;
                dist += Math.abs(y - (feedMid.get(s) as number));
              }
            }
          }
          if (matched >= need) scored.push({ markets: arr, matched, dist });
        }
        scored.sort((a, b) => a.dist - b.dist);
        const win = scored[0];
        // Accept only a CLEAR fingerprint winner (or the sole candidate) — never guess a month.
        if (win && (scored.length === 1 || win.dist < scored[1].dist * 0.9)) {
          for (const m of win.markets) {
            const s = marketStrike(m);
            if (s != null) out[String(s)] = (out[String(s)] || 0) + (m.volume || 0);
          }
        }
      }
    }
  } catch {
    /* best-effort — no volume rather than wrong volume */
  }
  volCache.set(key, { at: Date.now(), data: out });
  return out;
}

// Total traded volume (USD) per current macro event — for the Macro Signals list. Only resolves
// events that have a live dist (needed to fingerprint the venue event); skips the rest.
export async function getAllMacroVolumes(): Promise<Record<string, number>> {
  const events = await getMacroEvents();
  const out: Record<string, number> = {};
  for (const e of events) {
    if (!getLatest([e.eventKey]).length) continue;
    const vols = await getMacroEventVolumes(e.eventKey);
    const total = Object.values(vols).reduce((s, v) => s + v, 0);
    if (total > 0) out[e.eventKey] = total;
  }
  return out;
}
