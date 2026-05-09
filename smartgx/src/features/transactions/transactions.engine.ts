import type { Transaction, TransactionCategory, TransactionRiskLabel } from "../../types/transaction";
import { transactionOccurredMs, visibleHistoryTransactions } from "../../lib/transactionTime";
import {
  enrichTransactionInsightWithGemini,
  generateTransactionInsight,
  type TransactionInsightContext,
  type TransactionInsightRecentTxn,
} from "../ai/transactionInsight.ai";
import { computeMonthSpendForecast } from "./transactionForecast";

/* ─── Month scope (today in device local TZ, echoed as UTC month bucket) ───────────────── */

export function currentReportingMonthPrefix(reference = new Date()): string {
  return reference.toISOString().slice(0, 7);
}

function weekBoundaries(monthPrefix: string) {
  return { WEEK1_END: `${monthPrefix}-07`, WEEK2_END: `${monthPrefix}-15` };
}

/* ─── Public types ────────────────────────────────────────────────── */

export interface MonthlyAggregation {
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  count: number;
  incomeCount: number;
  expenseCount: number;
}

export type CategorySpendMap = Record<TransactionCategory, number>;

export interface BehaviourFlag {
  key: string;
  label: string;
  severity: "info" | "watch" | "risk";
  detail: string;
}

export interface TransactionHealthSignals {
  monthlySpend: number;
  topSpendCategory: string;
  topSpendCategoryRatio: number;
  recentSpendTrend: "increasing" | "stable" | "decreasing";
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function filterForMonth(txns: Transaction[], userId: string, ref = new Date()): Transaction[] {
  const month = currentReportingMonthPrefix(ref);
  const ymd = ref.toISOString().slice(0, 10);
  return visibleHistoryTransactions(txns).filter(
    (t) => t.userId === userId && t.transactionDate.startsWith(month) && t.transactionDate <= ymd
  );
}

function expenses(txns: Transaction[]): Transaction[] {
  return txns.filter((t) => t.type === "expense");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatCategoryName(cat: TransactionCategory): string {
  const map: Record<TransactionCategory, string> = {
    food:          "Food & Dining",
    transport:     "Transport",
    shopping:      "Shopping",
    bills:         "Bills & Utilities",
    education:     "Education",
    entertainment: "Entertainment",
    subscription:  "Subscriptions",
    others:        "Others",
  };
  return map[cat] ?? cat;
}

/* ─── Aggregation ─────────────────────────────────────────────────── */

export function aggregateMonthly(
  txns: Transaction[],
  userId: string
): MonthlyAggregation {
  const monthTxns = filterForMonth(txns, userId);
  let totalIncome = 0;
  let totalExpense = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const t of monthTxns) {
    if (t.type === "income") {
      totalIncome += t.amount;
      incomeCount++;
    } else if (t.type === "expense" || t.type === "repayment") {
      totalExpense += t.amount;
      expenseCount++;
    }
  }

  return {
    totalIncome:  round2(totalIncome),
    totalExpense: round2(totalExpense),
    netCashflow:  round2(totalIncome - totalExpense),
    count:        monthTxns.length,
    incomeCount,
    expenseCount,
  };
}

export function aggregateCategorySpend(
  txns: Transaction[],
  userId: string
): CategorySpendMap {
  const result: CategorySpendMap = {
    food: 0, transport: 0, shopping: 0, bills: 0,
    education: 0, entertainment: 0, subscription: 0, others: 0,
  };

  for (const t of expenses(filterForMonth(txns, userId))) {
    result[t.category] = round2(result[t.category] + t.amount);
  }

  return result;
}

/* ─── Risk label ──────────────────────────────────────────────────── */

export function getTransactionRiskLabel(t: Transaction): TransactionRiskLabel {
  if (t.riskLevel === "high" || t.isSuspicious) return "Risk";
  if (t.riskLevel === "medium") return "Watch";
  return "Low";
}

/* ─── Top category ────────────────────────────────────────────────── */

function getTopCategory(
  categoryMap: CategorySpendMap,
  totalExpense: number
): { category: TransactionCategory; amount: number; ratio: number } {
  let topCategory: TransactionCategory = "others";
  let topAmount = 0;

  const keys = Object.keys(categoryMap) as TransactionCategory[];
  for (const cat of keys) {
    if (categoryMap[cat] > topAmount) {
      topAmount = categoryMap[cat];
      topCategory = cat;
    }
  }

  return {
    category: topCategory,
    amount:   round2(topAmount),
    ratio:    totalExpense > 0 ? round2(topAmount / totalExpense) : 0,
  };
}

/* ─── Spending trend ──────────────────────────────────────────────── */

function getSpendingTrend(
  txns: Transaction[],
  userId: string
): "increasing" | "stable" | "decreasing" {
  const monthPrefix = currentReportingMonthPrefix();
  const { WEEK1_END, WEEK2_END } = weekBoundaries(monthPrefix);
  const monthExpenses = expenses(filterForMonth(txns, userId));

  const week1Total = monthExpenses
    .filter((t) => t.transactionDate <= WEEK1_END)
    .reduce((sum, t) => sum + t.amount, 0);

  const week2Total = monthExpenses
    .filter((t) => t.transactionDate > WEEK1_END && t.transactionDate <= WEEK2_END)
    .reduce((sum, t) => sum + t.amount, 0);

  if (week1Total === 0 && week2Total === 0) return "stable";
  if (week1Total === 0) return "increasing";
  if (week2Total === 0) return "stable";

  const ratio = week2Total / week1Total;
  if (ratio > 1.12) return "increasing";
  if (ratio < 0.88) return "decreasing";
  return "stable";
}

/* ─── Behaviour detection (internal + exported for future use) ────── */

export function detectBehaviours(
  txns: Transaction[],
  monthlyIncome: number,
  userId: string
): BehaviourFlag[] {
  const flags: BehaviourFlag[] = [];
  const safeBudget     = monthlyIncome > 0 ? monthlyIncome * 0.60 : 0;
  const monthExpenses  = expenses(filterForMonth(txns, userId));
  const categoryMap    = aggregateCategorySpend(txns, userId);
  const { totalExpense } = aggregateMonthly(txns, userId);

  const subscriptions = monthExpenses.filter((t) => t.isSubscription);
  if (monthlyIncome <= 0) {
    if (subscriptions.length >= 3) {
      const subTotal = round2(subscriptions.reduce((s, t) => s + t.amount, 0));
      flags.push({
        key: "recurring_subscriptions_no_income",
        label: `${subscriptions.length} active subscriptions`,
        severity: "info",
        detail: `You have ${subscriptions.length} recurring subscriptions totalling RM${subTotal}/month. Add income when you can so SmartGX can size safe spend.`,
      });
    }
    return flags;
  }

  if (subscriptions.length >= 3) {
    const subTotal = round2(subscriptions.reduce((s, t) => s + t.amount, 0));
    flags.push({
      key: "recurring_subscriptions",
      label: `${subscriptions.length} active subscriptions`,
      severity: subTotal > safeBudget * 0.08 ? "watch" : "info",
      detail: `You have ${subscriptions.length} recurring subscriptions totalling RM${subTotal}/month.`,
    });
  }

  if (categoryMap.food > safeBudget * 0.20) {
    flags.push({
      key: "high_food",
      label: "High food spending",
      severity: categoryMap.food > safeBudget * 0.30 ? "risk" : "watch",
      detail: `Food and dining at RM${categoryMap.food.toFixed(0)} is above your recommended allocation.`,
    });
  }

  if (categoryMap.shopping > safeBudget * 0.18) {
    flags.push({
      key: "high_shopping",
      label: "High shopping spend",
      severity: categoryMap.shopping > safeBudget * 0.28 ? "risk" : "watch",
      detail: `Shopping at RM${categoryMap.shopping.toFixed(0)} this month is elevated.`,
    });
  }

  const largeThreshold = safeBudget * 0.12;
  const largeTxns = monthExpenses.filter(
    (t) => t.amount >= largeThreshold && t.category !== "bills"
  );
  if (largeTxns.length > 0) {
    const largest = largeTxns.reduce((a, b) => (a.amount > b.amount ? a : b));
    flags.push({
      key: "large_transaction",
      label: "Large single purchase",
      severity: "watch",
      detail: `${largest.merchant} (RM${largest.amount.toFixed(0)}) on ${largest.transactionDate} is a large non-bill expense.`,
    });
  }

  if (totalExpense > safeBudget * 0.85) {
    const pct = Math.round((totalExpense / safeBudget) * 100);
    flags.push({
      key: "near_limit",
      label: "Approaching spend limit",
      severity: totalExpense > safeBudget ? "risk" : "watch",
      detail: `Your spending is at ${pct}% of the safe spending range.`,
    });
  }

  return flags;
}

/* ─── AI insight (deep, natural language, no labels) ─────────────── */

export interface TransactionInsightBuildOpts {
  mainBalance: number;
  totalSavings: number;
  gxHealthScore: number;
  flexiCreditOutstanding: number;
  flexiCardUsed: number;
  flexiCardLimit: number;
  upcomingRepayment: number;
}

function txnToInsightRecent(t: Transaction): TransactionInsightRecentTxn {
  return {
    amount: t.amount,
    category: formatCategoryName(t.category),
    type: t.type,
    date: t.transactionDate,
    paymentMethod: t.paymentMethod,
    merchant: t.merchant,
  };
}

export function buildTransactionInsightContext(
  txns: Transaction[],
  userId: string,
  monthlyBudget: number | null,
  opts: TransactionInsightBuildOpts
): TransactionInsightContext | null {
  const ref = new Date();
  const monthTxns = filterForMonth(txns, userId, ref);
  const summary = aggregateMonthly(txns, userId);
  const categories = aggregateCategorySpend(txns, userId);
  const monthExpenses = expenses(filterForMonth(txns, userId, ref));

  if (summary.count === 0) return null;

  const rankedCats = (Object.keys(categories) as TransactionCategory[])
    .filter((cat) => categories[cat] > 0 && cat !== "others")
    .sort((a, b) => categories[b] - categories[a]);

  const topCat: TransactionCategory = rankedCats[0] ?? "others";
  const subscriptions = monthExpenses.filter((t) => t.isSubscription);
  const subTotal = round2(subscriptions.reduce((s, t) => s + t.amount, 0));
  const budgetStatus =
    monthlyBudget == null
      ? "no_budget"
      : summary.totalExpense > monthlyBudget
        ? "over_budget"
        : "within_budget";
  const incomeCategories = monthTxns
    .filter((t) => t.type === "income")
    .reduce<Record<string, number>>((acc, t) => {
      const k = t.incomeType ?? "others";
      acc[k] = round2((acc[k] ?? 0) + t.amount);
      return acc;
    }, {});

  const top3ExpenseCategories = rankedCats.slice(0, 3).map((cat) => ({
    label: formatCategoryName(cat),
    amount: categories[cat],
  }));

  const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const daysRemainingInMonth = Math.max(0, lastDay - ref.getDate());

  const forecast = computeMonthSpendForecast({
    reference: ref,
    monthToDateIncome: summary.totalIncome,
    monthToDateExpense: summary.totalExpense,
    mainAccountBalance: opts.mainBalance,
    flexiCreditOutstanding: opts.flexiCreditOutstanding,
    flexiCardUsed: opts.flexiCardUsed,
    upcomingRepayment: opts.upcomingRepayment,
  });

  const sortedMonth = [...monthTxns].sort(
    (a, b) => transactionOccurredMs(b) - transactionOccurredMs(a)
  );
  const recentTransactions = sortedMonth.slice(0, 10).map(txnToInsightRecent);

  const largeThreshold = Math.max(120, summary.totalExpense * 0.12);
  const largeTransactions = monthExpenses
    .filter((t) => t.amount >= largeThreshold)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(txnToInsightRecent);

  return {
    totalIncome: summary.totalIncome,
    totalExpense: summary.totalExpense,
    netCashflow: summary.netCashflow,
    expenseCategories: categories,
    incomeCategories,
    topSpendingCategory: formatCategoryName(topCat),
    recurringSubscriptions: subscriptions.length,
    recurringSubscriptionTotal: subTotal,
    recent7DaySpend: week2TotalSpend(monthExpenses),
    budgetStatus,
    hasCreditSpending:
      monthExpenses.some(
        (t) =>
          t.note?.toLowerCase().includes("future money") ||
          t.type === "credit_drawdown"
      ) ||
      opts.flexiCardUsed > 0 ||
      opts.flexiCreditOutstanding > 0,
    mainAccountBalance: opts.mainBalance,
    totalSavings: opts.totalSavings,
    gxHealthScore: opts.gxHealthScore,
    forecast,
    top3ExpenseCategories,
    recentTransactions,
    largeTransactions,
    flexiCreditOutstanding: opts.flexiCreditOutstanding,
    flexiCardUsed: opts.flexiCardUsed,
    flexiCardLimit: opts.flexiCardLimit,
    upcomingRepayment: opts.upcomingRepayment,
    daysRemainingInMonth,
  };
}


/**
 * Generate a detailed, natural-language spending insight.
 * Pass `monthlyBudget` if the user has set one; pass `null` for no budget.
 */
export function generateAIInsight(
  txns: Transaction[],
  monthlyIncome: number,
  userId: string,
  monthlyBudget: number | null = null,
  insightOpts: TransactionInsightBuildOpts
): string {
  void monthlyIncome;
  const ctx = buildTransactionInsightContext(txns, userId, monthlyBudget, insightOpts);
  if (!ctx) {
    return "No transactions recorded for this month yet. Once you start spending, SmartGX will provide personalised insights here.";
  }
  const insight = generateTransactionInsight(ctx);
  return insight.displayBody;
}

/** Same as generateAIInsight but may refine copy via SmartGX AI proxy when configured. */
export async function generateAIInsightAsync(
  txns: Transaction[],
  monthlyIncome: number,
  userId: string,
  monthlyBudget: number | null = null,
  insightOpts: TransactionInsightBuildOpts
): Promise<string> {
  void monthlyIncome;
  const ctx = buildTransactionInsightContext(txns, userId, monthlyBudget, insightOpts);
  if (!ctx) {
    return "No transactions recorded for this month yet. Once you start spending, SmartGX will provide personalised insights here.";
  }
  const insight = await enrichTransactionInsightWithGemini(ctx);
  return insight.displayBody;
}

function week2TotalSpend(monthExpenses: Transaction[]): number {
  const mp = currentReportingMonthPrefix();
  const { WEEK1_END, WEEK2_END } = weekBoundaries(mp);
  return round2(
    monthExpenses
      .filter((t) => t.transactionDate > WEEK1_END && t.transactionDate <= WEEK2_END)
      .reduce((sum, t) => sum + t.amount, 0)
  );
}

/* ─── GXHealth signal builder ─────────────────────────────────────── */

export function buildTransactionHealthSignals(
  txns: Transaction[],
  monthlyIncome: number,
  userId: string
): TransactionHealthSignals {
  const { totalExpense } = aggregateMonthly(txns, userId);
  const categoryMap      = aggregateCategorySpend(txns, userId);
  const { category: topCat, ratio: topRatio } = getTopCategory(categoryMap, totalExpense);
  const trend = getSpendingTrend(txns, userId);

  return {
    monthlySpend:           totalExpense,
    topSpendCategory:       topCat,
    topSpendCategoryRatio:  topRatio,
    recentSpendTrend:       trend,
  };
}
