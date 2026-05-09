import type {
  HealthFactor,
  HealthInput,
  HealthReport,
  HealthStatus,
  HealthTrend,
} from "./health.types";

/* ─── Helpers ─────────────────────────────────────────────────────── */

function clamp(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)));
}

function ratioScore(ratio: number, goodAt: number, badAt = 0): number {
  if (ratio >= goodAt) return 100;
  if (ratio <= badAt) return 0;
  return clamp(((ratio - badAt) / (goodAt - badAt)) * 100);
}

function statusFromScore(score: number): HealthStatus {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Healthy";
  if (score >= 45) return "Watch";
  return "Risk";
}

function overallStatusColor(status: HealthStatus): string {
  switch (status) {
    case "Excellent": return "#22C55E";
    case "Healthy":   return "#4ADE80";
    case "Watch":     return "#F59E0B";
    case "Risk":      return "#EF4444";
  }
}

function factorColor(score: number): string {
  if (score >= 75) return "#22C55E";
  if (score >= 55) return "#4ADE80";
  if (score >= 35) return "#F59E0B";
  return "#EF4444";
}

function formatCategory(raw: string): string {
  const map: Record<string, string> = {
    food:          "food and dining",
    transport:     "transport",
    shopping:      "shopping",
    entertainment: "entertainment",
    bills:         "bills and utilities",
    education:     "education",
  };
  return map[raw] ?? raw;
}

/* ─── Factor 1 — Savings Rate (weight 35 %) ─────────────────────── */

function calcSavingsRate(input: HealthInput): HealthFactor {
  const ratio = input.monthlyIncome > 0 ? input.monthlySavings / input.monthlyIncome : 0;
  const pct   = Math.round(ratio * 100);
  const score = ratioScore(ratio, 0.20, 0);
  const weight = 0.35;

  let statusLabel: string;
  let behaviorExplanation: string;

  if (ratio >= 0.25) {
    statusLabel = "Strong";
    behaviorExplanation = `You are saving ${pct}% of your monthly income — well above the recommended 20%. Your auto-allocation is working effectively.`;
  } else if (ratio >= 0.18) {
    statusLabel = "Good";
    behaviorExplanation = `Your savings rate of ${pct}% is close to the recommended target. A small increase of RM${Math.round(input.monthlyIncome * 0.02)} would push you into the strong zone.`;
  } else if (ratio >= 0.08) {
    statusLabel = "Watch";
    behaviorExplanation = `Saving ${pct}% of your income is below the recommended 20%. This is reducing your GXHealth score and limiting your financial progress.`;
  } else {
    statusLabel = "Low";
    behaviorExplanation = `Your savings are critically low at ${pct}% of income. Without regular savings, your financial health is at risk of declining further.`;
  }

  return {
    key: "savings_rate",
    label: "Savings Rate",
    score,
    weight,
    weightedContribution: clamp(score * weight),
    statusLabel,
    behaviorExplanation,
    statusColor: factorColor(score),
  };
}

/* ─── Factor 2 — Spending Control (weight 30 %) ─────────────────── */

function calcSpendingControl(input: HealthInput): HealthFactor {
  const budget    = input.safeBudget > 0 ? input.safeBudget : input.monthlyIncome * 0.60;
  const overRatio = input.monthlySpend / budget;
  const score     = overRatio <= 1.0 ? 100 : clamp(((1.35 - overRatio) / 0.35) * 100);
  const weight    = 0.30;
  const overPct   = Math.round((overRatio - 1) * 100);
  const catName   = formatCategory(input.topSpendCategory);
  const trendWord = input.recentSpendTrend === "increasing"
    ? "risen"
    : input.recentSpendTrend === "decreasing"
    ? "fallen"
    : "stayed steady";

  let statusLabel: string;
  let behaviorExplanation: string;

  if (overRatio <= 0.85) {
    statusLabel = "On Track";
    behaviorExplanation = `Your spending has ${trendWord} this week and is comfortably below your safe budget. Your top category is ${catName}, which is within normal range.`;
  } else if (overRatio <= 1.0) {
    statusLabel = "On Track";
    behaviorExplanation = `Your spending has ${trendWord} and is right at your safe budget limit. Watch your ${catName} expenses closely — any increase will push you over.`;
  } else if (overRatio <= 1.15) {
    statusLabel = "Watch";
    behaviorExplanation = `Your spending has ${trendWord} and is now ${overPct}% above your safe budget. ${catName.charAt(0).toUpperCase() + catName.slice(1)} and lifestyle costs are the main contributors — review your recent transactions.`;
  } else {
    statusLabel = "Over Budget";
    behaviorExplanation = `Your spending is ${overPct}% over your safe budget. ${catName.charAt(0).toUpperCase() + catName.slice(1)} spending is your highest category. This pattern will continue to reduce your GXHealth score if left unchanged.`;
  }

  return {
    key: "spending_control",
    label: "Spending Control",
    score,
    weight,
    weightedContribution: clamp(score * weight),
    statusLabel,
    behaviorExplanation,
    statusColor: factorColor(score),
  };
}

/* ─── Factor 3 — Debt Risk (weight 25 %) ────────────────────────── */

function calcDebtRisk(input: HealthInput): HealthFactor {
  const score  = ratioScore(1 - input.debtRatio, 0.60, 0);
  const weight = 0.25;

  let statusLabel: string;
  let behaviorExplanation: string;

  if (input.debtRatio <= 0.04) {
    statusLabel = "Low";
    behaviorExplanation = "You are not relying on credit or future money for daily expenses. This is one of the strongest signals of financial stability.";
  } else if (input.debtRatio <= 0.12) {
    statusLabel = "Low";
    behaviorExplanation = "Your debt exposure is manageable. A small portion of your income goes toward credit obligations, which is within healthy limits.";
  } else if (input.debtRatio <= 0.25) {
    statusLabel = "Moderate";
    behaviorExplanation = "A moderate portion of your income is going toward debt or credit-based spending. Repeated future-money use may gradually reduce your cashflow margin.";
  } else if (input.debtRatio <= 0.40) {
    statusLabel = "High";
    behaviorExplanation = "Your debt risk is high. A significant share of your income is committed to credit obligations or risky spending, which is compressing your safe cashflow.";
  } else {
    statusLabel = "High Risk";
    behaviorExplanation = "Your debt exposure is at a critical level. Relying on future money for regular expenses is unsustainable and will continue to damage your GXHealth score.";
  }

  return {
    key: "debt_risk",
    label: "Debt Risk",
    score,
    weight,
    weightedContribution: clamp(score * weight),
    statusLabel,
    behaviorExplanation,
    statusColor: factorColor(score),
  };
}

/* ─── Factor 4 — Emergency Fund (weight 10 %) ───────────────────── */

function calcEmergencyFund(input: HealthInput): HealthFactor {
  const monthlyExpense = input.monthlySpend > 0 ? input.monthlySpend : input.monthlyIncome * 0.60;
  const monthsCovered  = monthlyExpense > 0 ? input.emergencyFundBalance / monthlyExpense : 0;
  const score          = monthsCovered <= 0 ? 10 : clamp(ratioScore(monthsCovered, 3, 0));
  const weight         = 0.10;
  const monthsStr      = monthsCovered > 0 ? monthsCovered.toFixed(1) : "0";

  let statusLabel: string;
  let behaviorExplanation: string;

  if (monthsCovered >= 3) {
    statusLabel = "Funded";
    behaviorExplanation = `Your emergency fund covers ${monthsStr} months of expenses — at or above the recommended safety level. This is a strong foundation.`;
  } else if (monthsCovered >= 1.5) {
    statusLabel = "Building";
    behaviorExplanation = `Your emergency fund covers ~${monthsStr} months of expenses. You are on the right track — reaching 3 months will significantly improve your resilience.`;
  } else if (monthsCovered > 0) {
    statusLabel = "Early Stage";
    behaviorExplanation = `Your emergency fund currently covers ~${monthsStr} months of expenses — well below the 3-month safety buffer. Growing this fund is a priority for your financial health.`;
  } else {
    statusLabel = "Not Started";
    behaviorExplanation = "You do not yet have a dedicated emergency fund. Even small, consistent contributions each month will protect your finances from unexpected events.";
  }

  return {
    key: "emergency_fund",
    label: "Emergency Fund",
    score,
    weight,
    weightedContribution: clamp(score * weight),
    statusLabel,
    behaviorExplanation,
    statusColor: factorColor(score),
  };
}

/* ─── Trend derivation ───────────────────────────────────────────── */

function deriveTrend(score: number, spendTrend: "increasing" | "stable" | "decreasing"): HealthTrend {
  if (score >= 72 && spendTrend !== "increasing") return "improving";
  if (score < 50 || spendTrend === "increasing") return "declining";
  return "stable";
}

/* ─── Public API ─────────────────────────────────────────────────── */

export function computeHealthReport(input: HealthInput): HealthReport {
  const factors: HealthFactor[] = [
    calcSavingsRate(input),
    calcSpendingControl(input),
    calcDebtRisk(input),
    calcEmergencyFund(input),
  ];

  const rawScore = factors.reduce((sum, f) => sum + f.weightedContribution, 0);
  const score    = clamp(rawScore);
  const status   = statusFromScore(score);
  const color    = overallStatusColor(status);
  return {
    score,
    status,
    statusColor: color,
    factors,
    aiAnalysis:  "",
    suggestions: [],
    trend:       deriveTrend(score, input.recentSpendTrend),
  };
}

/**
 * Build a HealthInput from the user's financial profile.
 *
 * Pass `transactionSignals` (from `buildTransactionHealthSignals`) to use
 * real transaction data for spending signals.  When omitted, conservative
 * mock defaults are used so existing screens continue to work without
 * requiring a transaction store.
 */
export function buildHealthInput(params: {
  monthlyIncome: number;
  monthlySavings?: number;
  safeBudget?: number;
  emergencyFundBalance?: number;
  debtRatio?: number;
  transactionSignals?: {
    monthlySpend: number;
    topSpendCategory: string;
    topSpendCategoryRatio: number;
    recentSpendTrend: "increasing" | "stable" | "decreasing";
  };
}): HealthInput {
  const { monthlyIncome, transactionSignals, monthlySavings, safeBudget, emergencyFundBalance, debtRatio } = params;

  // Allocation-derived values (match dashboard wallet logic)
  const resolvedMonthlySavings = monthlySavings ?? monthlyIncome * 0.30;
  const resolvedSafeBudget = safeBudget ?? monthlyIncome * 0.60;
  const resolvedEmergencyFund = emergencyFundBalance ?? monthlyIncome * 0.10;

  // Use real transaction signals when available; fall back to mock defaults
  const monthlySpend         = transactionSignals?.monthlySpend         ?? monthlyIncome * 0.63;
  const topSpendCategory     = transactionSignals?.topSpendCategory     ?? "food";
  const topSpendCategoryRatio = transactionSignals?.topSpendCategoryRatio ?? 0.38;
  const recentSpendTrend     = transactionSignals?.recentSpendTrend     ?? ("increasing" as const);

  const resolvedDebtRatio = debtRatio ?? 0.05;

  return {
    monthlyIncome,
    monthlySavings: resolvedMonthlySavings,
    monthlySpend,
    safeBudget: resolvedSafeBudget,
    emergencyFundBalance: resolvedEmergencyFund,
    debtRatio: resolvedDebtRatio,
    topSpendCategory,
    topSpendCategoryRatio,
    recentSpendTrend,
  };
}
