// Single shared Finnhub trade websocket, fanned out to all SSE clients. Finnhub free
// tier allows one WS connection, so we ref-count symbol subscriptions across clients
// rather than opening a socket per request. Server-only (the token never leaves here).

import WebSocket from "ws";

type OnTrade = (symbol: string, price: number, ts: number) => void;
interface Sub {
  symbols: Set<string>;
  onTrade: OnTrade;
}

const subs = new Set<Sub>();
const symCount = new Map<string, number>();
let ws: WebSocket | null = null;
let connecting = false;

function ensureWs() {
  if (connecting) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return;

  connecting = true;
  const sock = new WebSocket(`wss://ws.finnhub.io?token=${token}`);
  ws = sock;

  sock.on("open", () => {
    connecting = false;
    for (const s of symCount.keys()) sock.send(JSON.stringify({ type: "subscribe", symbol: s }));
  });
  sock.on("message", (buf: Buffer) => {
    try {
      const m = JSON.parse(buf.toString());
      if (m.type !== "trade" || !Array.isArray(m.data)) return;
      // Keep only the latest trade per symbol in this batch (ticks arrive bundled).
      const latest = new Map<string, { p: number; t: number }>();
      for (const t of m.data) latest.set(t.s, { p: t.p, t: t.t });
      for (const [sym, t] of latest) {
        for (const sub of subs) if (sub.symbols.has(sym)) sub.onTrade(sym, t.p, t.t);
      }
    } catch {
      /* ignore malformed frame */
    }
  });
  sock.on("close", () => {
    connecting = false;
    if (ws === sock) ws = null;
    if (symCount.size > 0) setTimeout(ensureWs, 1500); // reconnect while clients remain
  });
  sock.on("error", () => {
    try { sock.close(); } catch {}
  });
}

function sendSub(action: "subscribe" | "unsubscribe", symbol: string) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: action, symbol }));
}

// Register a client; returns an unsubscribe fn to call when the SSE connection closes.
export function subscribe(symbols: string[], onTrade: OnTrade): () => void {
  const sub: Sub = { symbols: new Set(symbols), onTrade };
  subs.add(sub);
  for (const s of sub.symbols) {
    const c = (symCount.get(s) || 0) + 1;
    symCount.set(s, c);
    if (c === 1) sendSub("subscribe", s);
  }
  ensureWs();

  return () => {
    if (!subs.has(sub)) return;
    subs.delete(sub);
    for (const s of sub.symbols) {
      const c = (symCount.get(s) || 1) - 1;
      if (c <= 0) {
        symCount.delete(s);
        sendSub("unsubscribe", s);
      } else {
        symCount.set(s, c);
      }
    }
    if (subs.size === 0 && ws) {
      try { ws.close(); } catch {}
      ws = null;
    }
  };
}
