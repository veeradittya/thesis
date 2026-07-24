// Server-side Turso (libSQL) access over the HTTP pipeline API — no extra deps, Vercel-safe.
// Holds the app's portfolio (holdings + theses) that the scheduled CMA agent reads, and serves
// the agent's written results (per-holding verdicts + run risk memos) back to the dashboard.

const PIPELINE = (process.env.TURSO_DATABASE_URL || "").replace(/^libsql:\/\//, "https://") + "/v2/pipeline";
const TOKEN = process.env.TURSO_AUTH_TOKEN || "";

type Arg = number | string | null;
function typed(v: Arg) {
  if (v == null) return { type: "null" };
  // Hrana protocol: integers are strings (may be 64-bit), floats are JSON numbers, text is a string.
  if (typeof v === "number") return Number.isInteger(v) ? { type: "integer", value: String(v) } : { type: "float", value: v };
  return { type: "text", value: v };
}

interface Cell {
  value?: string | null;
}

async function pipeline(requests: unknown[]): Promise<Array<{ cols: { name: string }[]; rows: Cell[][] }>> {
  if (!TOKEN || !PIPELINE.startsWith("https://")) throw new Error("Turso is not configured");
  const res = await fetch(PIPELINE, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ requests: [...requests, { type: "close" }] }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Turso ${res.status}`);
  const j = await res.json();
  return (j?.results || []).map((r: { type: string; response?: { result?: { cols: { name: string }[]; rows: Cell[][] } } }) => {
    if (r.type !== "ok") throw new Error("Turso stmt failed: " + JSON.stringify(r));
    return r.response?.result ?? { cols: [], rows: [] };
  });
}

// Run one SELECT/DML and return its rows as objects.
async function query(sql: string, args: Arg[] = []): Promise<Record<string, string | null>[]> {
  const [result] = await pipeline([{ type: "execute", stmt: { sql, args: args.map(typed) } }]);
  const names = result.cols.map((c) => c.name);
  return result.rows.map((row) => Object.fromEntries(row.map((cell, i) => [names[i], cell?.value ?? null])));
}

export interface MonitorResult {
  ticker: string;
  verdict: string; // holds_up | weakening | at_risk | watch
  confidence: number | null;
  rationale: string; // prose with inline [text](url) source links
  signals: string; // JSON string of the concrete evidence
  createdAt: string;
}
export interface MonitorPayload {
  runId: number | null;
  memo: string | null; // portfolio-level risk memo
  finishedAt: string | null;
  results: MonitorResult[];
}

// The latest completed run's memo + per-holding results for a user.
export async function getLatestMonitor(userId: string): Promise<MonitorPayload> {
  const runs = await query("SELECT id, summary, finished_at FROM runs WHERE user_id=? ORDER BY id DESC LIMIT 1", [userId]);
  if (!runs.length) return { runId: null, memo: null, finishedAt: null, results: [] };
  const runId = Number(runs[0].id);
  const rows = await query(
    "SELECT ticker, verdict, confidence, rationale, signals, created_at FROM results WHERE run_id=? ORDER BY ticker",
    [runId],
  );
  return {
    runId,
    memo: runs[0].summary,
    finishedAt: runs[0].finished_at,
    results: rows.map((r) => ({
      ticker: r.ticker || "",
      verdict: r.verdict || "watch",
      confidence: r.confidence != null ? Number(r.confidence) : null,
      rationale: r.rationale || "",
      signals: r.signals || "{}",
      createdAt: r.created_at || "",
    })),
  };
}

// Replace a user's holdings (portfolio + theses) — the source the scheduled agent reads each pass.
export async function syncHoldings(
  userId: string,
  holdings: Array<{ ticker: string; name?: string | null; weight?: number | null; thesis?: string | null }>,
): Promise<number> {
  const requests: unknown[] = [{ type: "execute", stmt: { sql: "DELETE FROM holdings WHERE user_id=?", args: [typed(userId)] } }];
  let n = 0;
  for (const h of holdings) {
    const ticker = (h.ticker || "").trim().toUpperCase();
    if (!ticker) continue;
    n++;
    requests.push({
      type: "execute",
      stmt: {
        sql: "INSERT OR REPLACE INTO holdings (user_id,ticker,name,weight,thesis) VALUES (?,?,?,?,?)",
        args: [typed(userId), typed(ticker), typed(h.name ?? null), typed(h.weight ?? null), typed((h.thesis || "").trim() || null)],
      },
    });
  }
  await pipeline(requests);
  return n;
}
