import type { Transaction } from "../../types/transaction";

export type NudgeActionType =
  | "transfer"
  | "scan_payment"
  | "card_payment"
  | "flexicard_payment"
  | "debit_spending";

export type NudgeRiskLevel = "low" | "medium" | "high" | "critical";

/** Modelled month-end view after treating this payment as committed (debit reduces Main, flexi increases card used). */
export interface NudgeMonthSpendProjection {
  projectedMonthEndBalance: number;
  projectedMonthEndExpense: number;
  projectedNetCashflow: number;
  projectedAdditionalExpense: number;
  daysRemainingInMonth: number;
  cashflowRisk: string;
  debtPressure: string;
  cashflowRiskMessage: string;
  debtPressureNote: string;
}

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
  /** Emergency pocket balance for AI nudge context (RM). */
  emergencyPocketBalance?: number;
  /** FlexiCredit borrowing outstanding, not TapPay card spend (RM). */
  flexiCreditBorrowingOutstanding?: number;
  flexiCreditMonthlyRepayment?: number;
  /** Top categories this month for richer AI copy. */
  top3ExpenseCategories?: Array<{ category: string; amount: number }>;
  bonusPocketBalance?: number;
  goalsPocketBalance?: number;
  /** GXHealth factor raw scores (0–100) keyed by factor id from HealthReport. */
  gxHealthFactorScores?: Partial<
    Record<"savings_rate" | "spending_control" | "emergency_fund" | "debt_risk" | "security", number>
  >;
  /** User-entered reference / note for transfers, if any. */
  transactionDescription?: string;
  /** Pace-based month-end projection including this payment in month-to-date spend. */
  monthSpendProjection?: NudgeMonthSpendProjection;
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
