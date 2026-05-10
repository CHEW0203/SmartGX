import type {
  CardCreditSnapshot,
  FlexiDebtSnapshot,
  HealthFactor,
  HealthInput,
  HealthReport,
  HealthStatus,
  HealthTrend,
  SavingsDisciplineSnapshot,
  SecuritySnapshot,
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

function rm(n: number): string {
  const v = Math.max(0, Math.round(n));
  return v >= 1000 ? `RM${v.toLocaleString("en-MY")}` : `RM${v}`;
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

/* ─── Factor 1 — Savings discipline (non-emergency) (weight 28 %) ─ */

/** Savings factor = Bonus + Goals discipline only; Emergency is scored separately. */
function calcSavingsRate(input: HealthInput): HealthFactor {
  const d = input.savingsDiscipline;
  const income = Math.max(d.monthlyIncomeRef, 1);
  const bgBal = d.bonusBalance + d.goalsBalance;

  const balanceRatio = bgBal / Math.max(income * 0.22, 150);
  const flowRatio = d.monthBonusGoalsContributionSum / Math.max(income * 0.05, 40);

  let score = 34;
  score += ratioScore(Math.min(balanceRatio, 1.8), 1, 0) * 0.26;
  score += ratioScore(Math.min(flowRatio, 2), 1, 0) * 0.30;

  if (d.allocationBonusGoalsPercent > 0) score += 7;
  if (d.latestAutoAllocationApplied) score += 9;
  if (d.roundUpEnabled) score += 5;
  if (d.roundUpLifetimeTotal > 0.5) score += 4;
  score += Math.min(12, d.savingStreakDays * 1.4);

  score -= Math.min(
    28,
    d.bonusGoalsWithdrawalCountThisMonth * 8 + (d.bonusGoalsWithdrawalAmountThisMonth / income) * 20
  );

  score = clamp(score);
  const weight = 0.28;

  const flowRm = Math.round(d.monthBonusGoalsContributionSum);
  const bgRm = rm(bgBal);

  let statusLabel: string;
  let behaviorExplanation: string;

  if (score >= 78) {
    statusLabel = "Strong";
    behaviorExplanation = `General saving discipline is strong: Bonus and Goals combined are about ${bgRm}, with around ${rm(flowRm)} flowing into those pockets this month. This factor ignores Emergency on purpose — Emergency is tracked separately.`;
  } else if (score >= 58) {
    statusLabel = "Good";
    behaviorExplanation = `Bonus and Goals discipline is decent (${bgRm} balances; ~${rm(flowRm)} added this month). Topping Bonus/Goals more consistently — and avoiding unnecessary withdrawals from them — will lift this factor. Emergency buffer does not change this score.`;
  } else if (score >= 38) {
    statusLabel = "Watch";
    behaviorExplanation = `Non-emergency savings habits need attention: Bonus + Goals are ${bgRm} with limited monthly contributions to those pockets. Use auto allocation, round-up, and manual saves to Bonus/Goals. Growing Emergency alone will not improve this factor.`;
  } else {
    statusLabel = "Low";
    behaviorExplanation = `Bonus and Goals discipline is weak (${bgRm}; ~${rm(flowRm)} this month). Focus on recurring flows into Bonus/Goals and reduce withdrawals from them. Your Emergency fund is scored under the Emergency factor instead.`;
  }

  return {
    key: "savings_rate",
    label: "Savings",
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
  const weight = 0.24;
  const trendWord = input.recentSpendTrend === "increasing"
    ? "risen"
    : input.recentSpendTrend === "decreasing"
    ? "fallen"
    : "stayed steady";

  const budgetEffective =
    input.safeBudget > 0 ? input.safeBudget : input.monthlyIncome > 0 ? input.monthlyIncome * 0.60 : 0;

  const noSpendYet =
    input.useTransactionSpendingSignals &&
    input.monthlySpend <= 0 &&
    input.monthlyExpenseTransactionCount <= 0;

  if (noSpendYet) {
    const score = 92;
    return {
      key: "spending_control",
      label: "Spending",
      score,
      weight,
      weightedContribution: clamp(score * weight),
      statusLabel: "No Spending Yet",
      behaviorExplanation:
        "No spending recorded yet. SmartGX will start analyzing your spending pattern once transactions appear.",
      statusColor: factorColor(score),
    };
  }

  if (!Number.isFinite(budgetEffective) || budgetEffective <= 0) {
    if (input.monthlySpend <= 0) {
      const score = 88;
      return {
        key: "spending_control",
        label: "Spending",
        score,
        weight,
        weightedContribution: clamp(score * weight),
        statusLabel: "Healthy",
        behaviorExplanation:
          "No spending recorded yet. SmartGX will start analyzing your spending pattern once transactions appear.",
        statusColor: factorColor(score),
      };
    }
    const score = 72;
    return {
      key: "spending_control",
      label: "Spending",
      score,
      weight,
      weightedContribution: clamp(score * weight),
      statusLabel: "Insufficient data",
      behaviorExplanation:
        "SmartGX needs more spending or income data before evaluating your budget pressure.",
      statusColor: factorColor(score),
    };
  }

  const overRatio = input.monthlySpend / budgetEffective;
  if (!Number.isFinite(overRatio)) {
    const score = 72;
    return {
      key: "spending_control",
      label: "Spending",
      score,
      weight,
      weightedContribution: clamp(score * weight),
      statusLabel: "Insufficient data",
      behaviorExplanation:
        "SmartGX needs more spending or income data before evaluating your budget pressure.",
      statusColor: factorColor(score),
    };
  }

  const score = overRatio <= 1.0 ? 100 : clamp(((1.35 - overRatio) / 0.35) * 100);
  const overPct = Math.round((overRatio - 1) * 100);
  const catLine =
    input.monthlySpend > 0 &&
    input.topSpendCategoryRatio > 0 &&
    Number.isFinite(input.topSpendCategoryRatio)
      ? formatCategory(input.topSpendCategory)
      : null;

  let statusLabel: string;
  let behaviorExplanation: string;

  if (overRatio <= 0.85) {
    statusLabel = "On Track";
    behaviorExplanation = catLine
      ? `Your spending has ${trendWord} this week and is comfortably below your safe budget. Your top category is ${catLine}, which is within normal range.`
      : `Your spending has ${trendWord} this week and is comfortably below your safe budget.`;
  } else if (overRatio <= 1.0) {
    statusLabel = "On Track";
    behaviorExplanation = catLine
      ? `Your spending has ${trendWord} and is right at your safe budget limit. Watch your ${catLine} expenses closely — any increase will push you over.`
      : `Your spending has ${trendWord} and is right at your safe budget limit. Watch discretionary expenses closely — any increase will push you over.`;
  } else if (overRatio <= 1.15) {
    statusLabel = "Watch";
    behaviorExplanation = catLine
      ? `Your spending has ${trendWord} and is now ${overPct}% above your safe budget. ${catLine.charAt(0).toUpperCase() + catLine.slice(1)} and lifestyle costs are the main contributors — review your recent transactions.`
      : `Your spending has ${trendWord} and is now ${overPct}% above your safe budget — review your recent transactions.`;
  } else {
    statusLabel = "Over Budget";
    behaviorExplanation = catLine
      ? `Your spending is ${overPct}% over your safe budget. ${catLine.charAt(0).toUpperCase() + catLine.slice(1)} spending is your highest category. This pattern will continue to reduce your GXHealth score if left unchanged.`
      : `Your spending is ${overPct}% over your safe budget. This pattern will continue to reduce your GXHealth score if left unchanged.`;
  }

  return {
    key: "spending_control",
    label: "Spending",
    score,
    weight,
    weightedContribution: clamp(score * weight),
    statusLabel,
    behaviorExplanation,
    statusColor: factorColor(score),
  };
}

/* ─── Factor 3 — Emergency Fund (weight 16 %) ───────────────────── */

function calcEmergencyFund(input: HealthInput): HealthFactor {
  const essentialMonthly = input.monthlySpend > 0 ? input.monthlySpend : input.monthlyIncome * 0.60;
  const emergencyTarget = Math.max(500, essentialMonthly);
  const bal = input.emergencyFundBalance;
  const adequacy = bal / Math.max(emergencyTarget, 1);
  let score = adequacy <= 0 ? 8 : ratioScore(adequacy, 1.35, 0);

  const income = Math.max(input.monthlyIncome, 1);
  const wN = input.emergencyWithdrawalCountThisMonth;
  const wAmt = input.emergencyWithdrawalAmountThisMonth;
  score -= Math.min(22, wN * 7 + (wAmt / income) * 15);
  score = clamp(score);

  const weight = 0.16;
  const monthsCovered = essentialMonthly > 0 ? bal / essentialMonthly : 0;
  const monthsStr = monthsCovered > 0 ? monthsCovered.toFixed(1) : "0";

  let statusLabel: string;
  let behaviorExplanation: string;

  if (adequacy >= 1.15) {
    statusLabel = "Funded";
    behaviorExplanation = `Emergency buffer is about ${rm(bal)} versus a one-month target of ${rm(emergencyTarget)} (from essential spend). That is solid cover (~${monthsStr} months of typical spend). This factor is separate from general Bonus/Goals discipline.`;
  } else if (adequacy >= 0.65) {
    statusLabel = "Building";
    behaviorExplanation = `Emergency pocket is ${rm(bal)} — roughly ${(adequacy * 100).toFixed(0)}% of the ${rm(emergencyTarget)} target. Keep topping Emergency and avoid unnecessary withdrawals to lift this score.`;
  } else if (bal > 0) {
    statusLabel = "Early Stage";
    behaviorExplanation = `Emergency balance is ${rm(bal)}, below the ${rm(emergencyTarget)} safety target. Small, steady adds and auto allocation to Emergency help — Total Savings still includes this pocket, but only this factor scores the buffer.`;
  } else {
    statusLabel = "Not Started";
    behaviorExplanation =
      "No meaningful emergency buffer yet. Target is at least RM500 or one month of essential spending, whichever is higher. Bonus/Goals strength does not replace this pocket.";
  }

  return {
    key: "emergency_fund",
    label: "Emergency",
    score,
    weight,
    weightedContribution: clamp(score * weight),
    statusLabel,
    behaviorExplanation,
    statusColor: factorColor(score),
  };
}

/* ─── Factor 4 — Debt Risk (weight 22 %) ────────────────────────── */

function calcDebtRisk(input: HealthInput): HealthFactor {
  const weight = 0.22;
  const fd = input.flexiDebt;
  const card = input.cardCredit;
  const income = Math.max(0, input.monthlyIncome);
  const main = Math.max(0, input.mainBalance);

  const flexOut = Number.isFinite(fd.outstanding) ? Math.max(0, fd.outstanding) : 0;
  const flexLim = Number.isFinite(fd.approvedLimit) ? Math.max(0, fd.approvedLimit) : 0;
  const cardUsed = Number.isFinite(card.used) ? Math.max(0, card.used) : 0;
  const cardLim = Number.isFinite(card.limit) ? Math.max(0, card.limit) : 0;
  const totalAvail = flexLim + cardLim;
  const totalUsed = flexOut + cardUsed;
  const utilization = totalAvail > 0 ? totalUsed / totalAvail : 0;

  const repayDue = Number.isFinite(fd.monthlyRepaymentDue) ? Math.max(0, fd.monthlyRepaymentDue) : 0;
  const burdenIncome = income > 0 ? repayDue / income : repayDue > 0 ? 0.35 : 0;
  const burdenMain = main > 0 ? Math.min(1.2, repayDue / main) : repayDue > 0 ? 1 : 0;
  const overdue = Math.max(0, Math.floor(fd.overdueCount));
  const drawN = Math.max(0, Math.floor(fd.activeDrawdowns));

  const hasFlexiLine = flexLim > 0 || flexOut > 0 || drawN > 0;
  const hasCard = cardLim > 0 || cardUsed > 0;

  let score: number;
  let statusLabel: string;
  let behaviorExplanation: string;

  if (!hasFlexiLine && !hasCard && flexOut < 0.01 && cardUsed < 0.01) {
    const fallback = ratioScore(1 - input.debtRatio, 0.60, 0);
    score = fallback;
    if (input.debtRatio <= 0.04) {
      statusLabel = "Low";
      behaviorExplanation =
        "No FlexiCredit line is active yet and card use is minimal — debt pressure from this snapshot is low.";
    } else if (input.debtRatio <= 0.15) {
      statusLabel = "Low";
      behaviorExplanation =
        "Debt signals are light. When you use FlexiCredit, keeping utilization and repayment due modest will keep this factor strong.";
    } else if (input.debtRatio <= 0.30) {
      statusLabel = "Medium";
      behaviorExplanation =
        "Overall debt-related exposure relative to income is moderate. Track FlexiCredit drawdowns and repayments as you activate credit.";
    } else {
      statusLabel = "High";
      behaviorExplanation =
        "Debt pressure versus income is elevated in the model. As FlexiCredit data connects, focus on lowering utilization and meeting due dates.";
    }
  } else {
    score = 100;
    score -= utilization * 48;
    score -= Math.min(38, burdenIncome * 85);
    score -= Math.min(22, burdenMain * 28);
    if (overdue > 0) score -= 40;
    if (drawN >= 3) score -= 10;
    score = clamp(score);

    if (overdue > 0) {
      statusLabel = "Critical";
      behaviorExplanation = `FlexiCredit has overdue repayment pressure (${overdue} line(s)). Clear overdue amounts first — this heavily impacts GXHealth.`;
    } else if (flexOut < 0.01 && cardUsed < 0.01 && drawN === 0) {
      statusLabel = "Low";
      behaviorExplanation =
        flexLim > 0
          ? `No FlexiCredit balance outstanding on approved limit ${rm(flexLim)}. Low utilization keeps debt risk contained.`
          : "No meaningful FlexiCredit balance is outstanding — debt pressure is low.";
    } else {
      const utilPct = Math.round(utilization * 100);
      const parts: string[] = [];
      if (flexLim > 0 || flexOut > 0) {
        parts.push(
          `FlexiCredit: ${rm(flexOut)} outstanding${flexLim > 0 ? ` of ${rm(flexLim)} limit` : ""} (~${utilPct}% of combined credit used).`
        );
      }
      if (repayDue > 0) {
        parts.push(
          `Repayment due about ${rm(repayDue)}${fd.nextDueDate ? ` (next ${fd.nextDueDate})` : ""}.`
        );
      }
      if (main > 0 && repayDue > main * 0.85 && repayDue > 0) {
        parts.push(`Main Account (${rm(main)}) is tight versus the monthly due — liquidity risk is higher.`);
      }
      if (burdenIncome > 0.22 && repayDue > 0) {
        parts.push("Repayment takes a large share of income — repeated borrowing may be squeezing cashflow.");
      }
      if (drawN >= 2) {
        parts.push(`${drawN} active drawdowns — consolidation or slowing new draws reduces rollover risk.`);
      }

      if (score >= 75) statusLabel = "Low";
      else if (score >= 55) statusLabel = "Medium";
      else if (score >= 35) statusLabel = "High";
      else statusLabel = "Critical";

      behaviorExplanation =
        parts.length > 0 ? parts.join(" ") : "Monitor FlexiCredit utilization and keep repayments on schedule.";
    }
  }

  return {
    key: "debt_risk",
    label: "Debt Risk",
    score: clamp(score),
    weight,
    weightedContribution: clamp(clamp(score) * weight),
    statusLabel,
    behaviorExplanation,
    statusColor: factorColor(clamp(score)),
  };
}

/* ─── Factor 5 — Security (weight 10 %) — Security Center snapshot ─ */

function calcSecurity(input: HealthInput): HealthFactor {
  const sec = input.security;
  const score = clamp(Number.isFinite(sec.score) ? sec.score : 65);
  const weight = 0.10;

  let statusLabel: string;
  let behaviorExplanation: string;

  const pinLine = sec.pinConfigured ? "6-digit PIN is set." : "6-digit PIN is not set — protect high-risk actions.";
  const safetyWord =
    sec.deviceSafety === "passed"
      ? "Device Safety Check passed."
      : sec.deviceSafety === "risk"
        ? "Device Safety Check flagged risk."
        : sec.deviceSafety === "attention"
          ? "Device Safety Check needs review."
          : "Device Safety Check not completed.";
  const scamLine = `Scam protection: ${sec.scamProtectionSummary}.`;
  const lockLine = sec.emergencyLock ? "Emergency Lock is on (limits access by design)." : "Emergency Lock is off.";

  if (score >= 80) {
    statusLabel = "Strong";
    behaviorExplanation = `Security Score ${score}. ${pinLine} ${safetyWord} ${scamLine} Security supports overall GXHealth.`;
  } else if (score >= 55) {
    statusLabel = "Fair";
    behaviorExplanation = `Security Score ${score}. ${pinLine} ${safetyWord} ${lockLine} Improving Security above 80 strengthens GXHealth.`;
  } else {
    statusLabel = "Weak";
    behaviorExplanation = `Security Score is only ${score}. ${pinLine} ${safetyWord} Complete recommended Security Center actions — this factor pulls GXHealth down when weak.`;
  }

  return {
    key: "security",
    label: "Security",
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
    calcEmergencyFund(input),
    calcDebtRisk(input),
    calcSecurity(input),
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
const EMPTY_FLEXI: FlexiDebtSnapshot = {
  approvedLimit: 0,
  outstanding: 0,
  monthlyRepaymentDue: 0,
  nextDueDate: null,
  overdueCount: 0,
  activeDrawdowns: 0,
};

const EMPTY_CARD: CardCreditSnapshot = { used: 0, limit: 0 };

const DEFAULT_SECURITY: SecuritySnapshot = {
  score: 68,
  pinConfigured: false,
  deviceSafety: "not_run",
  scamProtectionSummary: "Not assessed",
  emergencyLock: false,
};

const EMPTY_SAVINGS_DISCIPLINE: SavingsDisciplineSnapshot = {
  bonusBalance: 0,
  goalsBalance: 0,
  monthlyIncomeRef: 0,
  monthBonusGoalsContributionSum: 0,
  allocationBonusGoalsPercent: 0,
  latestAutoAllocationApplied: false,
  roundUpEnabled: false,
  roundUpLifetimeTotal: 0,
  savingStreakDays: 0,
  bonusGoalsWithdrawalCountThisMonth: 0,
  bonusGoalsWithdrawalAmountThisMonth: 0,
};

export function buildHealthInput(params: {
  monthlyIncome: number;
  monthlySavings?: number;
  safeBudget?: number;
  emergencyFundBalance?: number;
  emergencyWithdrawalCountThisMonth?: number;
  emergencyWithdrawalAmountThisMonth?: number;
  savingsDiscipline?: SavingsDisciplineSnapshot;
  debtRatio?: number;
  mainBalance?: number;
  flexiDebt?: FlexiDebtSnapshot;
  cardCredit?: CardCreditSnapshot;
  security?: SecuritySnapshot;
  transactionSignals?: {
    monthlySpend: number;
    monthlyExpenseTransactionCount: number;
    topSpendCategory: string;
    topSpendCategoryRatio: number;
    recentSpendTrend: "increasing" | "stable" | "decreasing";
  };
}): HealthInput {
  const {
    monthlyIncome,
    transactionSignals,
    monthlySavings,
    safeBudget,
    emergencyFundBalance,
    emergencyWithdrawalCountThisMonth,
    emergencyWithdrawalAmountThisMonth,
    savingsDiscipline,
    debtRatio,
    mainBalance,
    flexiDebt,
    cardCredit,
    security,
  } = params;

  // Allocation-derived values (match dashboard wallet logic)
  const resolvedMonthlySavings = monthlySavings ?? monthlyIncome * 0.30;
  const resolvedSafeBudget = safeBudget ?? monthlyIncome * 0.60;
  const resolvedEmergencyFund = emergencyFundBalance ?? monthlyIncome * 0.10;

  // Use real transaction signals when available; fall back to mock defaults
  const monthlySpend         = transactionSignals?.monthlySpend         ?? monthlyIncome * 0.63;
  const topSpendCategory     = transactionSignals?.topSpendCategory     ?? "food";
  const topSpendCategoryRatio = transactionSignals?.topSpendCategoryRatio ?? 0.38;
  const recentSpendTrend     = transactionSignals?.recentSpendTrend     ?? ("increasing" as const);
  const useTransactionSpendingSignals = transactionSignals != null;
  const monthlyExpenseTransactionCount = transactionSignals?.monthlyExpenseTransactionCount ?? 0;

  const resolvedDebtRatio = Number.isFinite(debtRatio ?? NaN) ? Math.max(0, Math.min(0.95, debtRatio as number)) : 0.05;

  const disc = savingsDiscipline ?? {
    ...EMPTY_SAVINGS_DISCIPLINE,
    monthlyIncomeRef: monthlyIncome,
  };

  return {
    monthlyIncome,
    monthlySavings: resolvedMonthlySavings,
    monthlySpend,
    safeBudget: resolvedSafeBudget,
    emergencyFundBalance: resolvedEmergencyFund,
    emergencyWithdrawalCountThisMonth: emergencyWithdrawalCountThisMonth ?? 0,
    emergencyWithdrawalAmountThisMonth: emergencyWithdrawalAmountThisMonth ?? 0,
    savingsDiscipline: disc,
    debtRatio: resolvedDebtRatio,
    useTransactionSpendingSignals,
    monthlyExpenseTransactionCount,
    topSpendCategory,
    topSpendCategoryRatio,
    recentSpendTrend,
    mainBalance: Number.isFinite(mainBalance ?? NaN) ? Math.max(0, mainBalance as number) : 0,
    flexiDebt: flexiDebt ?? { ...EMPTY_FLEXI },
    cardCredit: cardCredit ?? { ...EMPTY_CARD },
    security: security ?? { ...DEFAULT_SECURITY },
  };
}
