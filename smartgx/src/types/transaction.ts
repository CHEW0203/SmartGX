import type { RiskLevel } from "./risk";

export type TransactionCategory =
  | "food"
  | "transport"
  | "shopping"
  | "bills"
  | "education"
  | "entertainment"
  | "subscription"
  | "others";

export type TransactionType = "income" | "expense" | "credit_drawdown" | "repayment" | "saving_withdrawal";

export type TransactionRiskLabel = "Low" | "Watch" | "Risk";

export interface Transaction {
  id: string;
  userId: string;
  merchant: string;
  category: TransactionCategory;
  amount: number;
  type: TransactionType;
  paymentMethod: "gx_card" | "online_transfer" | "auto_debit";
  transactionDate: string; // ISO date string YYYY-MM-DD
  riskLevel: RiskLevel;
  isSuspicious: boolean;
  isSubscription?: boolean;
  note?: string;
  /** Activity/source event type for dashboard labelling */
  /** Set for TapPay on My Card — drives daily debit limit totals. */
  tapPaySource?: "debit" | "flexicard";
  sourceAction?:
    | "receive_income"
    | "auto_allocation"
    | "transfer"
    | "scan_payment"
    | "tappay"
    | "manual_save"
    | "round_up_saving"
    | "add_money"
    | "card_control"
    | "save_instead"
    | "saving_withdrawal";
  /** ISO timestamp for strict ordering */
  occurredAt?: string;

  /** Income-specific metadata (optional) */
  incomeType?:
    | "salary"
    | "allowance"
    | "part_time"
    | "freelance_income"
    | "cash_income"
    | "transfer_in"
    | "refund"
    | "cashback"
    | "unknown";
  incomeSource?: string;
  incomeDescription?: string;
  incomeConfidence?: "high" | "medium" | "low";
  classificationReason?: string;

  /** Auto allocation metadata (optional) */
  allocationApplied?: boolean;
  allocationBreakdown?: {
    spendingWallet: number;
    bonus: number;
    emergency: number;
    goals: number;
    ruleUsed: { spendingWallet: number; bonus: number; emergency: number; goals: number };
  };
}
