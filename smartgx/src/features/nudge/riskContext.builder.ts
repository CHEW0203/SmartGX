import { aggregateCategorySpend, aggregateMonthly } from "../transactions/transactions.engine";
import { computeMonthSpendForecast } from "../transactions/transactionForecast";
import type { NudgeMonthSpendProjection, NudgeRiskContext } from "./nudge.types";
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
  emergencyPocketBalance?: number;
  flexiCreditBorrowingOutstanding?: number;
  flexiCreditMonthlyRepayment?: number;
  bonusPocketBalance?: number;
  goalsPocketBalance?: number;
  gxHealthFactorScores?: Partial<
    Record<"savings_rate" | "spending_control" | "emergency_fund" | "debt_risk" | "security", number>
  >;
  transactionDescription?: string;
}

export function buildRiskContext(input: RiskContextInput): NudgeRiskContext {
  const monthly = aggregateMonthly(input.transactions, input.userId);
  const catMap = aggregateCategorySpend(input.transactions, input.userId);
  const category = input.category ?? "others";

  const isFlexi = input.cardType === "flexicard";
  const fc = computeMonthSpendForecast({
    monthToDateIncome: monthly.totalIncome,
    monthToDateExpense: monthly.totalExpense + input.amount,
    mainAccountBalance: isFlexi ? input.mainBalance : Math.max(0, input.mainBalance - input.amount),
    flexiCreditOutstanding: input.flexiCreditBorrowingOutstanding,
    flexiCardUsed: isFlexi ? input.flexiUsed + input.amount : input.flexiUsed,
    upcomingRepayment: input.flexiCreditMonthlyRepayment,
  });
  const monthSpendProjection: NudgeMonthSpendProjection = {
    projectedMonthEndBalance: fc.projectedMonthEndBalance,
    projectedMonthEndExpense: fc.projectedMonthEndExpense,
    projectedNetCashflow: fc.projectedNetCashflow,
    projectedAdditionalExpense: fc.projectedAdditionalExpense,
    daysRemainingInMonth: fc.daysRemainingInMonth,
    cashflowRisk: fc.cashflowRisk,
    debtPressure: fc.debtPressure,
    cashflowRiskMessage: fc.cashflowRiskMessage,
    debtPressureNote: fc.debtPressureNote,
  };

  const topEntry =
    Object.entries(catMap).sort((a, b) => b[1] - a[1])[0] ?? ["others", 0];

  const top3ExpenseCategories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }));

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
    emergencyPocketBalance: input.emergencyPocketBalance,
    flexiCreditBorrowingOutstanding: input.flexiCreditBorrowingOutstanding,
    flexiCreditMonthlyRepayment: input.flexiCreditMonthlyRepayment,
    top3ExpenseCategories: top3ExpenseCategories.length > 0 ? top3ExpenseCategories : undefined,
    bonusPocketBalance: input.bonusPocketBalance,
    goalsPocketBalance: input.goalsPocketBalance,
    gxHealthFactorScores: input.gxHealthFactorScores,
    transactionDescription: input.transactionDescription?.trim() || undefined,
    monthSpendProjection,
  };
}
