// Data model for the daily AI thesis-health tracker.
// A "thesis" = a stock/asset the user tracks + WHY they hold it. Each day, on first open,
// Claude Opus judges how that thesis holds up against roughly the last 24h of news.

export type Verdict = "holds_up" | "weakening" | "at_risk";

export interface AnalysisDriver {
  headline: string;
  source: string;
  url: string;
  datetime: number; // unix ms
}

export interface ThesisAnalysis {
  date: string; // "YYYY-MM-DD" in America/New_York — the "analyzed today" key
  verdict: Verdict;
  rationale: string;
  drivers: AnalysisDriver[];
  generatedAt: number; // unix ms
  degraded?: boolean; // produced without a full Opus read (gateway down / no news)
}

export interface Thesis {
  id: string;
  ticker: string;
  name: string;
  thesisText: string;
  horizon: string | null;
  passive?: boolean; // vest-and-rest: tracked, never analyzed
  createdAt: number;
  lastAnalysis: ThesisAnalysis | null; // cached inline (per day)
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  holds_up: "Holds up",
  weakening: "Weakening",
  at_risk: "At risk",
};
