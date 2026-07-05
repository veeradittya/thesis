"use client";

import { Thesis } from "@/lib/types";
import { labelFor } from "@/lib/signals";
import { statusColor, statusLabel } from "@/lib/health";

export function InboxPage({ theses }: { theses: Thesis[] }) {
  const monitors = theses.flatMap((t) =>
    t.decomposition.claims.map((c) => ({
      key: `${t.id}_${c.id}`,
      ticker: t.holdings,
      claim: c,
      status: t.statuses[c.id] ?? c.status,
    })),
  );

  return (
    <div className="flex-1 overflow-y-auto fade-in">
      <div className="mx-auto max-w-3xl px-6 py-8 pb-28">
        <header className="border-b border-border pb-5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-accent">Inbox</h1>
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" /> {monitors.length} armed
            </span>
          </div>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-text-muted">
            Live monitoring goes live soon. These are the alerts we have armed from your theses. The moment a break
            condition trips on a leading signal, it lands here and pings you.
          </p>
        </header>

        {monitors.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-[13px] text-text-muted">Nothing armed yet.</p>
            <p className="mt-1 text-[12px] text-text-muted/70">
              Add a thesis and we will start watching its break conditions for you.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-2.5">
            {monitors.map((m) => {
              const leading = (m.claim.signals || []).filter((s) => s.type === "leading");
              return (
                <div key={m.key} className="rounded-lg border border-border bg-panel px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: statusColor(m.status),
                        boxShadow: m.status !== "holding" ? `0 0 8px ${statusColor(m.status)}` : "none",
                      }}
                    />
                    <span className="font-mono text-[13px] font-medium text-accent">{m.ticker}</span>
                    <span className="text-[11px] text-text-muted">monitor armed</span>
                    <span
                      className="ml-auto font-mono text-[10px] uppercase tracking-wider"
                      style={{ color: statusColor(m.status) }}
                    >
                      {statusLabel(m.status)}
                    </span>
                  </div>

                  <p className="mt-2 text-[13px] leading-snug text-text">{m.claim.statement}</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted">
                    <span className="text-warning">alerts if </span>
                    {m.claim.break_condition}
                  </p>

                  {leading.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {leading.map((s, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[10px] text-text-muted"
                        >
                          <span className="h-1 w-1 rounded-full bg-warning" />
                          <span className="font-mono">{labelFor(s.source_id)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
