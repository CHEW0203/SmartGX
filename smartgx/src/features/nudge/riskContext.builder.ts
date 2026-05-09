import { aggregateCategorySpend, aggregateMonthly } from "../transactions/transactions.engine";
import type { NudgeRiskContext } from "./nudge.types";
import type { Transaction } from "../../types/transaction";

interface RiskContextInput {
  actionType: NudgeRiskContext["actionType"];
  amount: number;
  paymentMethod: string;
  cardType?: "debit" | "flexicard";
  merchant?: string;
  category?: Transaction["category"];
  mainBalance: number;
  flexiLimit: number;
  flexiUsed: number;
  gxHealthScore: number;
  monthlyIncome: number;
  transactions: Transaction[];
  userId: string;
  savingsBalance: number;
  hasBudget?: boolean;
  budgetAmount?: number | null;
}

export function buildRiskContext(input: RiskContextInput): NudgeRiskContext {
  const monthly = aggregateMonthly(input.transactions, input.userId);
  const catMap = aggregateCategorySpend(input.transactions, input.userId);
  const category = input.category ?? "others";

  const topEntry =
    Object.entries(catMap).sort((a, b) => b[1] - a[1])[0] ?? ["others", 0];

  return {
    actionType: input.actionType,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    cardType: input.cardType,
    merchant: input.merchant,
    category,
    currentBalance: input.mainBalance,
    availableBalance:
      input.cardType === "flexicard"
        ? Math.max(0, input.flexiLimit - input.flexiUsed)
        : input.mainBalance,
    flexiCardLimit: input.flexiLimit,
    flexiCardUsed: input.flexiUsed,
    flexiCardAvailable: Math.max(0, input.flexiLimit - input.flexiUsed),
    gxHealthScore: input.gxHealthScore,
    monthlyIncome: input.monthlyIncome,
    monthlyExpense: monthly.totalExpense,
    topSpendingCategory: topEntry[0],
    categorySpending: catMap[category],
    savingsBalance: input.savingsBalance,
    recentTransactions: input.transactions.slice(0, 8),
    hasBudget: Boolean(input.hasBudget && (input.budgetAmount ?? 0) > 0),
    budgetAmount: input.budgetAmount ?? null,
  };
}
