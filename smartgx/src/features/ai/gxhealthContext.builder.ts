import type { HealthFactor, HealthInput, HealthStatus } from "../health/health.types";
import type { Transaction } from "../../types/transaction";

export interface GxHealthRiskTxnSummary {
  amount: number;
  category: string;
  type: string;
  date: string;
  paymentMethod: string;
  riskLevel: string;
}

export interface GxHealthAiContextPayload {
  currencyNote: string;
  userProfile: {
    employmentStatus?: string;
    monthlyIncomeDeclared: number;
    allocationRuleAccepted: boolean;
  };
  account: {
    mainBalance: number;
    totalSavings: number;
    bonus: number;
    emergency: number;
    goals: number;
  };
  /** Emergency pocket vs spending — for AI alongside Security and Debt */
  emergencyBuffer: {
    emergencyBalanceRm: number;
    estimatedMonthlyExpensesRm: number;
    monthsOfSpendCovered: number;
    targetMonthsRecommended: number;
    /** max(RM500, one month essential spend) */
    emergencyTargetRm: number;
    /** emergencyBalanceRm / emergencyTargetRm */
    adequacyVsOneMonthTarget: number;
  };
  gxHealth: {
    displayScore: number;
    rawScore: number;
    status: HealthStatus;
    previousScore: number | null;
    scoreChange: number | null;
  };
  monthlyOverview: {
    totalIncomeThisMonth: number;
    totalExpensesThisMonth: number;
    netCashflow: number;
    daysRemainingInMonth: number;
    daysPassedInMonth: number;
  };
  spending: {
    byCategory: Record<string, number>;
    top3Categories: Array<{ name: string; amount: number }>;
    topSpendCategoryKey: string;
    topSpendCategoryRatio: number;
    spendTrend: string;
    safeBudget: number;
  };
  savingsBehaviour: {
    savingStreakDays: number;
    roundUpEnabled: boolean;
    roundUpTotal: number;
    latestAutoAllocationAmount: number | null;
    recentManualSaveCount: number;
    monthBonusGoalsContributionsRm: number;
    /** Plain-language separation of Savings vs Emergency scoring (for the model). */
    savingsFactorScopeNote: string;
    allocationRulePercents: {
      spendingWallet: number;
      bonusPocket: number;
      emergencyFund: number;
      goalSavings: number;
    };
  };
  credit: {
    flexiCardUsed: number;
    flexiCardLimit: number;
    flexiCreditUsed: number;
    flexiCreditLimit: number;
    flexiCreditApprovedLimit: number;
    flexiCreditOutstanding: number;
    flexiActiveDrawdowns: number;
    flexiOverdueDrawdowns: number;
    nextRepaymentDate: string | null;
    monthlyRepayment: number;
  };
  security: {
    securityScore: number;
    pinConfigured: boolean;
    deviceSafetyStatus: string;
    scamProtectionSummary: string;
    emergencyLock: boolean;
    transactionAlertsEnabled: boolean;
    deviceTrusted: boolean;
  };
  recentTransactions: GxHealthRiskTxnSummary[];
  riskyTransactions: GxHealthRiskTxnSummary[];
  riskBehaviour: {
    highOrCriticalNudgeNotificationsLast14d: number;
    saveInsteadCountThisMonth: number;
  };
  gamification: {
    activeCampaignsSample: Array<{ id: string; title: string; progress: number; target: number; status: string }>;
  };
  healthFactors: Array<{
    key: string;
    label: string;
    score: number;
    statusLabel: string;
    explanation: string;
  }>;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function daysRemainingInMonth(d: Date): number {
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.max(0, lastDay - d.getDate());
}

function daysPassedInMonth(d: Date): number {
  return d.getDate();
}

const CAT_LABEL: Record<string, string> = {
  food: "Food & Dining",
  transport: "Transport",
  shopping: "Shopping",
  bills: "Bills & Utilities",
  education: "Education",
  entertainment: "Entertainment",
  subscription: "Subscriptions",
  others: "Others",
};

export function buildGxHealthAiContext(params: {
  reference?: Date;
  displayScore: number;
  rawScore: number;
  status: HealthStatus;
  previousScore: number | null;
  scoreChange: number | null;
  input: HealthInput;
  factors: HealthFactor[];
  mainBalance: number;
  savingsBuckets: { bonus: number; emergency: number; goals: number };
  employmentStatus?: string;
  allocationAccepted: boolean;
  monthlyIncomeDeclared: number;
  allocationRulePercents: {
    spendingWallet: number;
    bonusPocket: number;
    emergencyFund: number;
    goalSavings: number;
  };
  monthIncome: number;
  monthExpense: number;
  netCashflow: number;
  categorySpend: Record<string, number>;
  recentTransactions: Transaction[];
  flexiCardUsed: number;
  flexiCardLimit: number;
  flexiCreditUsed: number;
  flexiCreditLimit: number;
  flexiOutstanding: number;
  flexiApprovedLimit: number;
  flexiActiveDrawdowns: number;
  flexiOverdueDrawdowns: number;
  nextRepaymentDate: string | null;
  monthlyRepayment: number;
  securityScore: number;
  pinConfigured: boolean;
  deviceSafetyStatus: string;
  scamProtectionSummary: string;
  emergencyLock: boolean;
  transactionAlertsEnabled: boolean;
  deviceTrusted: boolean;
  savingStreakDays: number;
  roundUpEnabled: boolean;
  roundUpTotal: number;
  latestAutoAllocationAmount: number | null;
  recentManualSaveCount: number;
  notificationsRiskCount14d: number;
  campaigns: GxHealthAiContextPayload["gamification"]["activeCampaignsSample"];
}): GxHealthAiContextPayload {
  const ref = params.reference ?? new Date();
  const cats = params.categorySpend;
  const ranked = Object.entries(cats)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => ({ name: CAT_LABEL[k] ?? k, amount: round2(v) }));

  const recent = [...params.recentTransactions]
    .filter((t) => {
      const d = t.transactionDate;
      return d <= ref.toISOString().slice(0, 10);
    })
    .slice(0, 10)
    .map(
      (t): GxHealthRiskTxnSummary => ({
        amount: t.amount,
        category: CAT_LABEL[t.category] ?? t.category,
        type: t.type,
        date: t.transactionDate,
        paymentMethod: t.paymentMethod,
        riskLevel: t.riskLevel,
      })
    );

  const risky = params.recentTransactions
    .filter((t) => t.riskLevel === "high" || t.riskLevel === "critical" || t.isSuspicious)
    .slice(0, 5)
    .map(
      (t): GxHealthRiskTxnSummary => ({
        amount: t.amount,
        category: CAT_LABEL[t.category] ?? t.category,
        type: t.type,
        date: t.transactionDate,
        paymentMethod: t.paymentMethod,
        riskLevel: t.riskLevel,
      })
    );

  const saveInsteadMonth = params.recentTransactions.filter(
    (t) => t.sourceAction === "save_instead" && t.transactionDate.startsWith(ref.toISOString().slice(0, 7))
  ).length;

  const totalSavings =
    round2(params.savingsBuckets.bonus + params.savingsBuckets.emergency + params.savingsBuckets.goals);

  const monthlyExpEst = Math.max(
    round2(params.input.monthlySpend),
    round2(params.input.monthlyIncome * 0.6)
  );
  const emergBal = round2(params.savingsBuckets.emergency);
  const monthsCov = monthlyExpEst > 0 ? round2(emergBal / monthlyExpEst) : 0;
  const emergTarget = Math.max(500, monthlyExpEst);
  const adequacyVsTarget = emergTarget > 0 ? round2(emergBal / emergTarget) : 0;

  return {
    currencyNote:
      "All amounts are Malaysian Ringgit (RM). Never use $, USD, or dollars in your reply.",
    userProfile: {
      employmentStatus: params.employmentStatus,
      monthlyIncomeDeclared: round2(params.monthlyIncomeDeclared),
      allocationRuleAccepted: params.allocationAccepted,
    },
    account: {
      mainBalance: round2(params.mainBalance),
      totalSavings,
      bonus: round2(params.savingsBuckets.bonus),
      emergency: emergBal,
      goals: round2(params.savingsBuckets.goals),
    },
    emergencyBuffer: {
      emergencyBalanceRm: emergBal,
      estimatedMonthlyExpensesRm: monthlyExpEst,
      monthsOfSpendCovered: monthsCov,
      targetMonthsRecommended: 3,
      emergencyTargetRm: round2(emergTarget),
      adequacyVsOneMonthTarget: adequacyVsTarget,
    },
    gxHealth: {
      displayScore: Math.round(params.displayScore),
      rawScore: Math.round(params.rawScore),
      status: params.status,
      previousScore: params.previousScore != null ? Math.round(params.previousScore) : null,
      scoreChange: params.scoreChange != null ? Math.round(params.scoreChange) : null,
    },
    monthlyOverview: {
      totalIncomeThisMonth: round2(params.monthIncome),
      totalExpensesThisMonth: round2(params.monthExpense),
      netCashflow: round2(params.netCashflow),
      daysRemainingInMonth: daysRemainingInMonth(ref),
      daysPassedInMonth: daysPassedInMonth(ref),
    },
    spending: {
      byCategory: Object.fromEntries(Object.entries(cats).map(([k, v]) => [CAT_LABEL[k] ?? k, round2(v)])),
      top3Categories: ranked,
      topSpendCategoryKey: params.input.topSpendCategory,
      topSpendCategoryRatio: round2(params.input.topSpendCategoryRatio),
      spendTrend: params.input.recentSpendTrend,
      safeBudget: round2(params.input.safeBudget),
    },
    savingsBehaviour: {
      savingStreakDays: params.savingStreakDays,
      roundUpEnabled: params.roundUpEnabled,
      roundUpTotal: round2(params.roundUpTotal),
      latestAutoAllocationAmount:
        params.latestAutoAllocationAmount != null ? round2(params.latestAutoAllocationAmount) : null,
      recentManualSaveCount: params.recentManualSaveCount,
      monthBonusGoalsContributionsRm: round2(params.input.savingsDiscipline.monthBonusGoalsContributionSum),
      savingsFactorScopeNote:
        "GXHealth 'Savings' measures general (non-emergency) saving discipline: Bonus + Goals balances and flows, allocation to Bonus/Goals, round-up, streak, and withdrawals from Bonus/Goals. 'Emergency' measures emergency buffer strength vs target max(RM500, one month essential spend). Total Savings = Bonus + Emergency + Goals for balances, but Emergency is not double-counted inside the Savings factor score.",
      allocationRulePercents: { ...params.allocationRulePercents },
    },
    credit: {
      flexiCardUsed: round2(params.flexiCardUsed),
      flexiCardLimit: round2(params.flexiCardLimit),
      flexiCreditUsed: round2(params.flexiCreditUsed),
      flexiCreditLimit: round2(params.flexiCreditLimit),
      flexiCreditApprovedLimit: round2(params.flexiApprovedLimit),
      flexiCreditOutstanding: round2(params.flexiOutstanding),
      flexiActiveDrawdowns: params.flexiActiveDrawdowns,
      flexiOverdueDrawdowns: params.flexiOverdueDrawdowns,
      nextRepaymentDate: params.nextRepaymentDate,
      monthlyRepayment: round2(params.monthlyRepayment),
    },
    security: {
      securityScore: Math.round(params.securityScore),
      pinConfigured: params.pinConfigured,
      deviceSafetyStatus: params.deviceSafetyStatus,
      scamProtectionSummary: params.scamProtectionSummary,
      emergencyLock: params.emergencyLock,
      transactionAlertsEnabled: params.transactionAlertsEnabled,
      deviceTrusted: params.deviceTrusted,
    },
    recentTransactions: recent,
    riskyTransactions: risky,
    riskBehaviour: {
      highOrCriticalNudgeNotificationsLast14d: params.notificationsRiskCount14d,
      saveInsteadCountThisMonth: saveInsteadMonth,
    },
    gamification: {
      activeCampaignsSample: params.campaigns.slice(0, 4),
    },
    healthFactors: params.factors.map((f) => ({
      key: f.key,
      label: f.label,
      score: Math.round(f.score),
      statusLabel: f.statusLabel,
      explanation: f.behaviorExplanation,
    })),
  };
}
