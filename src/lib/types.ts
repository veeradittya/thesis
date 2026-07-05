export type ClaimStatus = "holding" | "weakening" | "broken";
export type SignalType = "leading" | "confirming";
export type Observability = "high" | "medium" | "low";
export type Confidence = "high" | "medium" | "low";

export interface Signal {
  source_id: string;
  type: SignalType;
  what_to_watch: string;
  direction: string;
  threshold: string;
}

export interface Claim {
  id: string;
  statement: string;
  why_it_matters: string;
  break_condition: string;
  weight: number;
  signals: Signal[];
  observability: Observability;
  fallback: string;
  confidence: Confidence;
  status: ClaimStatus;
}

export interface UnstatedAssumption {
  assumption: string;
  risk_if_wrong: string;
  monitorable: boolean;
}

export interface Decomposition {
  thesis_summary: string;
  thesis_type: string;
  time_horizon: string | null;
  needs_user_input: boolean;
  clarifying_questions: string[];
  claims: Claim[];
  unstated_assumptions: UnstatedAssumption[];
}

export interface Holding {
  ticker: string;
  name: string;
  quantity: number;
  value: number;
  costBasis: number;
  institution: string;
}

export interface Thesis {
  id: string;
  holdings: string;
  thesisText: string;
  timeHorizon: string;
  decomposition: Decomposition;
  statuses: Record<string, ClaimStatus>;
  createdAt: number;
}
