"use client";
// localStorage-backed store for theses (v1: no database). Keyed by account scope so a
// signed-in user's theses persist per-account and a guest's stay browser-local + ephemeral.
// Daily analysis is cached inline on each thesis (`lastAnalysis`), so one atomic key holds
// everything and "analyzed today?" is a plain string compare — no join, no timestamps.

import type { Thesis, ThesisAnalysis } from "@/lib/thesis";

export type Scope = string; // "guest" | `u.${userId}`
const key = (scope: Scope) => `thesisv2.${scope}.theses`;

// Stable calendar day in US market time — the "analyzed today" key. Using America/New_York
// (not the browser tz) so a late-night PT open and an early ET open agree on "today".
export function todayStr(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now); // YYYY-MM-DD
}

// Needs a fresh Opus read: active theses whose cached analysis isn't from today.
export function isStale(t: Thesis): boolean {
  return !t.passive && t.lastAnalysis?.date !== todayStr();
}

export function loadTheses(scope: Scope): Thesis[] {
  if (typeof window === "undefined") return [];
  try {
    const arr = JSON.parse(localStorage.getItem(key(scope)) || "[]");
    return Array.isArray(arr) ? (arr as Thesis[]) : [];
  } catch {
    return [];
  }
}

export function saveTheses(scope: Scope, theses: Thesis[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(scope), JSON.stringify(theses));
  } catch {}
}

export function newThesis(input: {
  ticker: string;
  name?: string;
  thesisText?: string;
  horizon?: string | null;
  passive?: boolean;
}): Thesis {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `t_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  return {
    id,
    ticker: input.ticker.trim().toUpperCase(),
    name: (input.name || input.ticker).trim(),
    thesisText: (input.thesisText || "").trim(),
    horizon: input.horizon ?? null,
    passive: input.passive || false,
    createdAt: Date.now(),
    lastAnalysis: null,
  };
}

export function upsertThesis(scope: Scope, t: Thesis): Thesis[] {
  const list = loadTheses(scope);
  const i = list.findIndex((x) => x.id === t.id);
  if (i >= 0) list[i] = t;
  else list.push(t);
  saveTheses(scope, list);
  return list;
}

export function removeThesis(scope: Scope, id: string): Thesis[] {
  const list = loadTheses(scope).filter((t) => t.id !== id);
  saveTheses(scope, list);
  return list;
}

export function setAnalysis(scope: Scope, id: string, analysis: ThesisAnalysis): Thesis[] {
  const list = loadTheses(scope);
  const t = list.find((x) => x.id === id);
  if (t) t.lastAnalysis = analysis;
  saveTheses(scope, list);
  return list;
}

// On first sign-in, promote a guest's locally-built theses into the account — only if the
// account has none yet — then clear the guest bucket. Mirrors the ledger seed-on-first-signin.
export function promoteGuestTheses(userId: string): void {
  if (typeof window === "undefined") return;
  const guest = loadTheses("guest");
  if (!guest.length) return;
  if (!loadTheses(`u.${userId}`).length) saveTheses(`u.${userId}`, guest);
  saveTheses("guest", []);
}
