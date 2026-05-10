export type IncomeType = "salary" | "allowance" | "part_time" | "freelance_income" | "cash_income";

export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  salary:      "Salary",
  allowance:   "Allowance",
  part_time:   "Part-time",
  freelance_income: "Freelance Income",
  cash_income: "Cash Income",
};

/** Wallet split percentages — must total 100 */
export interface AllocationRule {
  spendingWallet: number;
  bonusPocket:    number;
  emergencyFund:  number;
  goalSavings:    number;
}

/** Calculated RM result from applying a rule to an income amount */
export interface AllocationResult {
  income:         number;
  spendingWallet: number;
  bonusPocket:    number;
  emergencyFund:  number;
  goalSavings:    number;
}

/** An income event that may be identified as salary */
export interface IncomeTransaction {
  id:          string;
  amount:      number;
  description: string;
  sender:      string;
  date:        string;
}

/** Result of the salary detection pass */
export interface DetectedSalary {
  amount:     number;
  source:     string;
  receivedOn: string;
  confidence: "high" | "medium";
}

/** A user-entered income record */
export interface ManualIncome {
  id:                 string;
  amount:             number;
  incomeType:         IncomeType;
  description:        string;
  date:               string;
  allocationApplied:  boolean;
}

/** Round-up statistics derived from spending transactions */
export interface RoundUpStats {
  totalSaved:        number;
  transactionCount:  number;
}

/** AI-generated allocation recommendation */
export interface AIRecommendation {
  rule:    AllocationRule;
  insight: string;
  changes: string[];
}

/** A single item in the recent savings activity feed */
export interface SavingsActivity {
  id:     string;
  label:  string;
  pocket: string;
  amount: number;
  date:   string;
  occurredAt?: string;
  type:
    | "auto"
    | "manual"
    | "roundup"
    | "goal"
    | "withdrawal"
    | "challenge_reward"
    | "streak_reward"
    | "campaign_reward"
    | "bonus_credit";
}

/** One savings goal record */
export interface SavingsGoal {
  id:            string;
  name:          string;
  targetAmount:  number;
  currentAmount: number;
  deadline:      string;
}
