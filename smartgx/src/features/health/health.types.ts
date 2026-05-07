export type HealthStatus = "Excellent" | "Healthy" | "Watch" | "Risk";

export type HealthTrend = "improving" | "stable" | "declining";

export interface HealthInput {
  monthlyIncome: number;
  monthlySavings: number;
  monthlySpend: number;
  safeBudget: number;
  emergencyFundBalance: number;
  debtRatio: number;             // 0.0–1.0: income fraction going to debt/risky spend
  topSpendCategory: string;      // e.g. "food", "entertainment", "transport"
  topSpendCategoryRatio: number; // share of total spend in that category (0.0–1.0)
  recentSpendTrend: "increasing" | "stable" | "decreasing"; // week-on-week direction
}

export interface HealthFactor {
  key: "savings_rate" | "spending_control" | "debt_risk" | "emergency_fund";
  label: string;
  score: number;                 // 0–100 raw factor score
  weight: number;                // 0.0–1.0
  weightedContribution: number;  // score × weight (portion of overall 100)
  statusLabel: string;           // human-readable status e.g. "Strong", "Watch", "Building"
  behaviorExplanation: string;   // 1-2 sentence behaviour-specific context
  statusColor: string;
}

export interface HealthReport {
  score: number;
  status: HealthStatus;
  statusColor: string;
  factors: HealthFactor[];
  aiAnalysis: string;    // AI-style behavioural narrative
  suggestions: string[]; // behaviour-driven recommended actions
  trend: HealthTrend;
}
