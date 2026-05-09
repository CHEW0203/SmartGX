import type { Transaction } from "../../types/transaction";

export type NudgeActionType =
  | "transfer"
  | "scan_payment"
  | "card_payment"
  | "flexicard_payment"
  | "debit_spending";

export type NudgeRiskLevel = "low" | "medium" | "high" | "critical";

export interface NudgeRiskContext {
  actionType: NudgeActionType;
  amount: number;
  paymentMethod: string;
  cardType?: "debit" | "flexicard";
  merchant?: string;
  category?: Transaction["category"];
  currentBalance: number;
  availableBalance: number;
  flexiCardLimit: number;
  flexiCardUsed: number;
  flexiCardAvailable: number;
  gxHealthScore: number;
  monthlyIncome: number;
  monthlyExpense: number;
  topSpendingCategory: string;
  categorySpending: number;
  savingsBalance: number;
  recentTransactions: Transaction[];
  hasBudget: boolean;
  budgetAmount: number | null;
}

export interface NudgeEvaluation {
  riskLevel: NudgeRiskLevel;
  reasonCodes: string[];
  suggestedAction: string;
  requiresSoftFriction: boolean;
  requiresCountdown: boolean;
  requiresReasonInput: boolean;
  shouldCreateNotification: boolean;
  recommendUseDebitInstead: boolean;
  recommendSaveInstead: boolean;
}

export type NudgeDecision =
  | "continue"
  | "cancel"
  | "save_instead"
  | "use_debit_instead"
  | "review_gxhealth"
  | "try_smaller_amount";

/** Severity tiers returned by critical reason analysis */
export type ReasonRiskDim = "low" | "medium" | "high";

/** Full output from critical reason analysis (local or remote) */
export interface ReasonAnalysisResult {
  necessity: ReasonRiskDim;
  urgency: ReasonRiskDim;
  impulseRisk: ReasonRiskDim;
  fraudRisk: ReasonRiskDim;
  cashflowConcern: ReasonRiskDim;
  recommendation: "allow" | "delay" | "block" | "use_debit" | "save_instead" | "reduce_amount";
  explanation: string;
  saferAlternative: string;
  canContinue: boolean;
}

/** @deprecated use ReasonAnalysisResult.recommendation */
export type CriticalReasonDecision = "allow" | "delay" | "block";
