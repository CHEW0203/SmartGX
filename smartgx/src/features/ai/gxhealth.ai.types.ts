export type GXHealthActionType = "saving" | "spending" | "credit" | "security" | "cashflow" | "repayment";

export interface GXHealthRecommendedAction {
  title: string;
  reason: string;
  impact: string;
  actionType: GXHealthActionType;
}

export interface GXHealthStructuredAnalysis {
  summary: string;
  scoreExplanation: string;
  positiveSignals: string[];
  riskSignals: string[];
  recommendedActions: GXHealthRecommendedAction[];
  priorityAction: string;
  confidence: "low" | "medium" | "high";
}
