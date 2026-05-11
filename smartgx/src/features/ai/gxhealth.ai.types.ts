export type GXHealthActionType = "saving" | "spending" | "credit" | "security" | "cashflow" | "repayment";

export type GXHealthRelatedFactor = "Savings" | "Spending" | "Emergency" | "Debt Risk" | "Security";

export interface GXHealthRecommendedAction {
  title: string;
  reason: string;
  impact: string;
  actionType: GXHealthActionType;
  /** Optional label for UI — which GXHealth pillar this action targets. */
  relatedFactor?: GXHealthRelatedFactor;
  /** Optional extra line from Gemini. */
  suggestedAction?: string;
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
