"use client";

import { Claim, Thesis } from "@/lib/types";
import { statusColor, statusLabel } from "@/lib/health";
import { labelFor } from "@/lib/signals";

function SignalRow({ s }: { s: Claim["signals"][number] }) {
  const leading = s.type === "leading";
  return (
    <div className="flex items-center gap-2.5 text-[11px]">
      <span
        className="font-mono w-3 shrink-0 text-center"
        style={{ color: leading ? "var(--color-warning)" : "var(--color-text-muted)" }}
        title={leading ? "Leading signal" : "Confirming signal"}
      >
        {leading ? "L" : "C"}
      </span>
      <span className="font-mono text-text shrink-0">{labelFor(s.source_id)}</span>
      <span className="text-text-muted truncate flex-1">{s.what_to_watch}</span>
      <span className="flex items-center gap-1 shrink-0 text-text-muted uppercase tracking-wider text-[10px]">
        <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
        watching
      </span>
    </div>
  );
}

export function ThesisDashboard({
  thesis,
  onCycle,
  onDelete,
}: {
  thesis: Thesis;
  onCycle: (claimId: string) => void;
  onDelete: () => void;
}) {
  const d = thesis.decomposition;
  const allSignals = d.claims.flatMap((c) => c.signals || []);
  const leadingCount = allSignals.filter((s) => s.type === "leading").length;
  const confirmingCount = allSignals.filter((s) => s.type === "confirming").length;
  const stream = [...new Map(allSignals.map((s) => [s.source_id + s.what_to_watch, s])).values()];

  return (
    <div className="flex-1 min-w-0 overflow-y-auto fade-in">
      {/* live signal stream */}
      {stream.length > 0 && (
        <div className="flex items-center h-9 border-b border-border bg-panel/40 overflow-hidden">
          <div className="shrink-0 h-full px-3 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-muted border-r border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" /> live
          </div>
          <div className="relative flex-1 overflow-hidden">
            <div className="signal-scroll flex items-center gap-7 whitespace-nowrap px-4 text-[11px]">
              {[...stream, ...stream].map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-text-muted">
                  <span
                    className="w-1 h-1 rounded-full"
                    style={{ background: s.type === "leading" ? "var(--color-warning)" : "var(--color-text-muted)" }}
                  />
                  <span className="font-mono text-text">{labelFor(s.source_id)}</span>
                  <span className="opacity-70">{s.what_to_watch}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 pt-9 pb-28 space-y-8">
        {/* thesis header — no health score */}
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[20px] text-accent font-medium">{thesis.holdings}</span>
            <span className="text-[10px] uppercase tracking-wider text-text-muted border border-border rounded px-1.5 py-0.5">
              {d.thesis_type}
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" /> monitoring
            </span>
          </div>
          <p className="mt-3 text-[16px] text-text leading-relaxed">{d.thesis_summary}</p>
          <p className="mt-2 text-[12px] text-text-muted font-mono">
            {d.time_horizon ? `${d.time_horizon}  ·  ` : ""}
            {leadingCount} leading · {confirmingCount} confirming signals
          </p>
        </div>

        {/* claims tracked */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">
              Claims tracked ({d.claims.length})
            </span>
            <span className="text-[10px] text-text-muted">click a status to simulate</span>
          </div>
          <div className="space-y-3">
            {d.claims.map((c) => {
              const status = thesis.statuses[c.id] ?? c.status;
              return (
                <div key={c.id} className="border border-border rounded-lg bg-panel px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <button onClick={() => onCycle(c.id)} className="mt-1 shrink-0" title="Cycle status (demo)">
                      <span
                        className="block w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor: statusColor(status),
                          boxShadow: status !== "holding" ? `0 0 8px ${statusColor(status)}` : "none",
                        }}
                      />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[14px] text-text leading-snug">{c.statement}</p>
                        <span
                          className="shrink-0 text-[10px] font-mono uppercase tracking-wider"
                          style={{ color: statusColor(status) }}
                        >
                          {statusLabel(status)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[12px] text-text-muted leading-relaxed">
                        <span className="text-text-muted/60">breaks if </span>
                        {c.break_condition}
                      </p>
                      <div className="mt-3 border-t border-border/50 pt-3 space-y-2">
                        {(c.signals || []).map((s, i) => (
                          <SignalRow key={i} s={s} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* unstated assumptions */}
        {d.unstated_assumptions?.length > 0 && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Unstated assumptions</span>
            <div className="mt-2 space-y-1.5">
              {d.unstated_assumptions.map((a, i) => (
                <div key={i} className="text-[12px] text-text-muted leading-relaxed">
                  <span className="text-warning">⚠ </span>
                  <span className="text-text/90">{a.assumption}</span>. {a.risk_if_wrong}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <p className="text-[11px] text-text-muted max-w-md leading-relaxed">
            Monitoring {d.claims.length} claims across {leadingCount + confirmingCount} signals, around the clock. We
            flag the moment one breaks.
          </p>
          <button onClick={onDelete} className="shrink-0 text-[11px] text-text-muted hover:text-negative transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
