import { Claim, ClaimStatus } from "./types";

const STATUS_VALUE: Record<ClaimStatus, number> = {
  holding: 1,
  weakening: 0.5,
  broken: 0,
};

/** Weighted Thesis Health, 0–100. All-holding = 100. */
export function thesisHealth(claims: Claim[], statuses: Record<string, ClaimStatus>): number {
  if (!claims.length) return 100;
  const totalWeight = claims.reduce((s, c) => s + (c.weight || 0), 0) || claims.length;
  let score = 0;
  for (const c of claims) {
    const st = statuses[c.id] ?? c.status ?? "holding";
    const w = c.weight || 1 / claims.length;
    score += (w / totalWeight) * STATUS_VALUE[st];
  }
  return Math.round(score * 100);
}

export function healthColor(score: number): string {
  if (score >= 75) return "var(--color-positive)";
  if (score >= 45) return "var(--color-warning)";
  return "var(--color-negative)";
}

export function statusColor(s: ClaimStatus): string {
  if (s === "holding") return "var(--color-positive)";
  if (s === "weakening") return "var(--color-warning)";
  return "var(--color-negative)";
}

export function statusLabel(s: ClaimStatus): string {
  return s.toUpperCase();
}

const CYCLE: ClaimStatus[] = ["holding", "weakening", "broken"];
export function nextStatus(s: ClaimStatus): ClaimStatus {
  return CYCLE[(CYCLE.indexOf(s) + 1) % CYCLE.length];
}
