import type { GXHealthStructuredAnalysis } from "../ai/gxhealth.ai.types";

export type HealthStatus = "Excellent" | "Healthy" | "Watch" | "Risk";

export type HealthTrend = "improving" | "stable" | "declining";

/** Real FlexiCredit + repayment signals for Debt Risk (safe numeric defaults). */
export interface FlexiDebtSnapshot {
  approvedLimit: number;
  outstanding: number;
  monthlyRepaymentDue: number;
  nextDueDate: string | null;
  overdueCount: number;
  activeDrawdowns: number;
}

export interface CardCreditSnapshot {
  used: number;
  limit: number;
}

export interface SecuritySnapshot {
  score: number;
  pinConfigured: boolean;
  deviceSafety: "passed" | "pending" | "attention" | "risk" | "not_run";
  scamProtectionSummary: string;
  emergencyLock: boolean;
}

/** Inputs for the Savings GXHealth factor (non-emergency discipline only). */
export interface SavingsDisciplineSnapshot {
  bonusBalance: number;
  goalsBalance: number;
  monthlyIncomeRef: number;
  monthBonusGoalsContributionSum: number;
  allocationBonusGoalsPercent: number;
  latestAutoAllocationApplied: boolean;
  roundUpEnabled: boolean;
  roundUpLifetimeTotal: number;
  savingStreakDays: number;
  bonusGoalsWithdrawalCountThisMonth: number;
  bonusGoalsWithdrawalAmountThisMonth: number;
}

export interface HealthInput {
  monthlyIncome: number;
  /** Snapshot of total pocket savings (Bonus+Emergency+Goals); not used for Savings factor scoring. */
  monthlySavings: number;
  monthlySpend: number;
  safeBudget: number;
  emergencyFundBalance: number;
  /** Withdrawals from Emergency in the current calendar month (from activity log). */
  emergencyWithdrawalCountThisMonth: number;
  emergencyWithdrawalAmountThisMonth: number;
  savingsDiscipline: SavingsDisciplineSnapshot;
  /** Legacy blend when Flexi snapshot is empty; kept for safe fallbacks */
  debtRatio: number;
  /** True when monthlySpend / expense counts come from `buildTransactionHealthSignals` (not model defaults). */
  useTransactionSpendingSignals: boolean;
  /** Expense-type transactions in the current reporting month. */
  monthlyExpenseTransactionCount: number;
  topSpendCategory: string;
  topSpendCategoryRatio: number;
  recentSpendTrend: "increasing" | "stable" | "decreasing";
  mainBalance: number;
  flexiDebt: FlexiDebtSnapshot;
  cardCredit: CardCreditSnapshot;
  security: SecuritySnapshot;
}

export interface HealthFactor {
  key: "savings_rate" | "spending_control" | "emergency_fund" | "debt_risk" | "security";
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
  /** Structured GXHealth AI sections when available (GXHealth screen) */
  gxHealthAiStructured?: GXHealthStructuredAnalysis | null;
  /** Longer combined narrative for multiline displays */
  gxHealthAiBody?: string;
}
