import { Holding, Thesis } from "./types";

const KEY = "thesis.portfolio.v1";
const HOLDINGS_KEY = "thesis.holdings.v1";

export function loadTheses(): Thesis[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveTheses(theses: Thesis[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(theses));
}

export function loadHoldings(): Holding[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HOLDINGS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveHoldings(holdings: Holding[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(HOLDINGS_KEY, JSON.stringify(holdings));
}
