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

/* ─── AI Analysis narrative ───────────────────────────────────────── */

function buildAIAnalysis(
  factors: HealthFactor[],
  input: HealthInput,
  status: HealthStatus
): string {
  const savingsF  = factors.find((f) => f.key === "savings_rate")!;
  const spendingF = factors.find((f) => f.key === "spending_control")!;
  const debtF     = factors.find((f) => f.key === "debt_risk")!;
  const emergencyF = factors.find((f) => f.key === "emergency_fund")!;

  const savingsRate  = input.monthlyIncome > 0 ? input.monthlySavings / input.monthlyIncome : 0;
  const overRatio    = input.safeBudget > 0 ? input.monthlySpend / input.safeBudget : 1;
  const catName      = formatCategory(input.topSpendCategory);
  const trendPhrase  = input.recentSpendTrend === "increasing"
    ? "has increased over the past week"
    : input.recentSpendTrend === "decreasing"
    ? "has decreased over the past week"
    : "has remained stable this week";

  const savingsPct  = Math.round(savingsRate * 100);
  const overPct     = Math.round((overRatio - 1) * 100);

  // Build spending sentence
  const spendingSentence = overRatio > 1.0
    ? `Your ${catName} and discretionary spending ${trendPhrase}, pushing your monthly spend ${overPct}% above your safe cashflow budget.`
    : `Your spending ${trendPhrase} and remains within your safe budget — ${catName} is your highest category.`;

  // Build savings sentence
  const savingsSentence = savingsRate >= 0.20
    ? `Your saving consistency is strong, with ${savingsPct}% of your income being allocated to savings.`
    : savingsRate >= 0.10
    ? `You are currently saving ${savingsPct}% of your income, which is below the recommended 20% threshold.`
    : `Your savings rate of ${savingsPct}% is significantly below the recommended level, which is a key drag on your overall score.`;

  // Build debt sentence
  const debtSentence = input.debtRatio > 0.15
    ? `Your debt or future-money reliance is adding pressure to your monthly cashflow and contributing to a lower GXHealth score.`
    : `Your debt exposure is low, which is a positive signal for your financial stability.`;

  // Build emergency sentence
  const emergencySentence = emergencyF.score < 35
    ? `Your emergency fund is in its early stages — building this buffer will meaningfully improve your financial resilience.`
    : emergencyF.score < 65
    ? `Your emergency fund is growing but has not yet reached the recommended 3-month safety level.`
    : `Your emergency fund provides a solid safety net against unexpected expenses.`;

  // Compose final narrative based on status
  if (status === "Excellent") {
    return `Your financial health is in excellent condition. ${savingsSentence} ${spendingSentence} ${emergencySentence} Continue your current habits and consider gradually increasing your savings target.`;
  }
  if (status === "Healthy") {
    if (spendingF.score < 70 && spendingF.score < savingsF.score) {
      return `Your financial health is stable with good underlying habits. ${spendingSentence} ${savingsSentence} Reducing non-essential ${catName} spending would improve your GXHealth score faster than any other single change.`;
    }
    if (emergencyF.score < 40) {
      return `Your financial health is stable. ${savingsSentence} ${spendingSentence} ${emergencySentence} A consistent monthly top-up to your emergency fund would strengthen your overall health score.`;
    }
    return `Your financial health is in good shape. ${savingsSentence} ${spendingSentence} ${debtSentence} Continue building your positive habits to reach Excellent status.`;
  }
  if (status === "Watch") {
    if (spendingF.score <= savingsF.score && spendingF.score <= debtF.score) {
      return `Your financial health is under watch and requires attention. ${spendingSentence} ${savingsSentence} Reducing non-essential spending is the fastest lever to improve your score right now.`;
    }
    if (savingsF.score < 50) {
      return `Your financial health is under watch. ${savingsSentence} ${spendingSentence} ${debtSentence} Setting up a fixed automatic saving each month would be the most impactful change you can make.`;
    }
    return `Your financial health needs attention. ${spendingSentence} ${savingsSentence} ${debtSentence} Focus on controlling your top spending category and building your savings buffer.`;
  }
  // Risk
  return `Your current financial patterns carry elevated risk. ${spendingSentence} ${savingsSentence} ${debtSentence} ${emergencySentence} Immediate changes to your spending and saving behaviour are recommended to prevent further decline.`;
}

/* ─── Behaviour-driven suggestions ───────────────────────────────── */

function buildSuggestions(factors: HealthFactor[], input: HealthInput): string[] {
  const suggestions: string[] = [];

  const savingsF   = factors.find((f) => f.key === "savings_rate")!;
  const spendingF  = factors.find((f) => f.key === "spending_control")!;
  const debtF      = factors.find((f) => f.key === "debt_risk")!;
  const emergencyF = factors.find((f) => f.key === "emergency_fund")!;

  const catName  = formatCategory(input.topSpendCategory);
  const savingsRate = input.monthlyIncome > 0 ? input.monthlySavings / input.monthlyIncome : 0;
  const overRatio   = input.safeBudget > 0 ? input.monthlySpend / input.safeBudget : 1;

  // Spending is the worst factor — spend-specific action
  if (spendingF.score < 65) {
    if (input.topSpendCategoryRatio > 0.30) {
      const dailyCap = Math.round((input.safeBudget * input.topSpendCategoryRatio * 0.80) / 30);
      suggestions.push(
        `Limit your daily ${catName} spending to RM${dailyCap} for the next week to bring your cashflow back within your safe budget.`
      );
    } else {
      const cutRM = Math.round((input.monthlySpend - input.safeBudget) * 0.5 / 10) * 10;
      suggestions.push(
        `Your spending is above your safe budget. Cutting discretionary expenses by RM${cutRM} this month would put you back on track.`
      );
    }
  }

  // Savings are weak
  if (savingsF.score < 65) {
    const targetSavings = Math.round(input.monthlyIncome * 0.20);
    const gap = Math.max(0, targetSavings - input.monthlySavings);
    const bumpRM = Math.round(gap / 10) * 10 || 50;
    suggestions.push(
      `Move RM${bumpRM} into your Savings Pocket today to recover your savings momentum and close the gap to your 20% target.`
    );
  }

  // Debt risk is elevated
  if (debtF.score < 65) {
    if (input.debtRatio > 0.25) {
      suggestions.push(
        `Avoid future-money spending this week and use only your Spending Wallet. Reducing credit reliance will immediately lower your debt risk score.`
      );
    } else {
      suggestions.push(
        `You have some future-money or credit usage this period. Try to keep this week's transactions within your available balance only.`
      );
    }
  }

  // Emergency fund is weak
  if (emergencyF.score < 50) {
    const monthlyExpense = input.monthlySpend;
    const targetFund = monthlyExpense * 3;
    const gap = Math.max(0, targetFund - input.emergencyFundBalance);
    const monthlyContrib = Math.round(Math.min(gap / 12, input.monthlyIncome * 0.05) / 10) * 10 || 30;
    suggestions.push(
      `Add RM${monthlyContrib} to your Emergency Pocket each month. Building to a 3-month safety buffer will protect your GXHealth score.`
    );
  }

  // Spending is increasing trend — proactive warning
  if (input.recentSpendTrend === "increasing" && spendingF.score >= 65) {
    suggestions.push(
      `Your spending trend is rising this week. Review your ${catName} transactions now before it crosses your safe budget threshold.`
    );
  }

  // Score is already good — reinforce positive behaviour
  if (suggestions.length === 0) {
    suggestions.push(
      `Maintain your current allocation and continue your saving streak — you are ahead of most users in your profile.`
    );
    suggestions.push(
      `Consider increasing your savings target by RM${Math.round(input.monthlyIncome * 0.03 / 10) * 10} to build toward financial independence faster.`
    );
  }

  return suggestions.slice(0, 4);
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
    aiAnalysis:  buildAIAnalysis(factors, input, status),
    suggestions: buildSuggestions(factors, input),
    trend:       deriveTrend(score, input.recentSpendTrend),
  };
}

/**
 * Build a HealthInput from the user's financial profile plus mock
 * behavioural signals.  When real transaction data is wired up, replace
 * the mock signals with live values — the engine logic stays untouched.
 */
export function buildHealthInput(params: {
  monthlyIncome: number;
}): HealthInput {
  const { monthlyIncome } = params;

  // Allocation-derived values (match dashboard wallet logic)
  const monthlySavings       = monthlyIncome * 0.30;
  const monthlySpend         = monthlyIncome * 0.63; // slightly over the 60 % safe budget
  const safeBudget           = monthlyIncome * 0.60;
  const emergencyFundBalance = monthlyIncome * 0.10; // ~0.16 months of expenses

  // Mock behavioural signals — replace with real transaction aggregation later
  const debtRatio             = 0.05;       // 5 % income to debt/credit risk
  const topSpendCategory      = "food";     // highest category by transaction volume
  const topSpendCategoryRatio = 0.38;       // food = 38 % of total spend
  const recentSpendTrend      = "increasing" as const; // week-on-week spend went up

  return {
    monthlyIncome,
    monthlySavings,
    monthlySpend,
    safeBudget,
    emergencyFundBalance,
    debtRatio,
    topSpendCategory,
    topSpendCategoryRatio,
    recentSpendTrend,
  };
}
