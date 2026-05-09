import type {
  AIRecommendation,
  AllocationResult,
  AllocationRule,
  DetectedSalary,
  IncomeTransaction,
  RoundUpStats,
  SavingsActivity,
  SavingsGoal,
} from "./savings.types";

/* ─── Constants ───────────────────────────────────────────────────── */

export const DEFAULT_RULE: AllocationRule = {
  spendingWallet: 60,
  bonusPocket:    20,
  emergencyFund:  10,
  goalSavings:    10,
};

const SALARY_KEYWORDS = [
  "salary", "payroll", "gaji", "monthly pay", "wages",
  "gaji bulanan", "emolumen", "upah", "monthly income",
];

const INCOME_KEYWORDS: Record<string, string[]> = {
  salary: ["salary", "payroll", "gaji", "monthly pay", "wages", "emolumen", "gaji bulanan"],
  allowance: ["allowance", "elaun", "stipend", "scholarship"],
  part_time: ["part-time", "part time", "wages", "freelance", "gig"],
  freelance_income: ["freelance", "project payment", "client payment", "invoice"],
  cash_income: ["cash income", "cash deposit", "cash"],
};

export type IncomeDetectionResult = {
  isIncome: boolean;
  incomeType: "salary" | "allowance" | "part_time" | "freelance_income" | "cash_income";
  detectedCategory: "salary" | "allowance" | "part_time" | "freelance_income" | "cash_income";
  confidence: "high" | "medium" | "low";
  detectionReason: string;
};

/* ─── Mock income transactions ────────────────────────────────────── */

export const MOCK_INCOME_TRANSACTIONS: IncomeTransaction[] = [
  {
    id:          "inc-1",
    amount:      3000,
    description: "Salary Transfer May 2026",
    sender:      "ABC Corporation Sdn Bhd",
    date:        "2026-05-01",
  },
  {
    id:          "inc-2",
    amount:      3000,
    description: "Salary Transfer Apr 2026",
    sender:      "ABC Corporation Sdn Bhd",
    date:        "2026-04-01",
  },
  {
    id:          "inc-3",
    amount:      3000,
    description: "Salary Transfer Mar 2026",
    sender:      "ABC Corporation Sdn Bhd",
    date:        "2026-03-01",
  },
];

/* ─── Mock spending amounts used for round-up calculation ─────────── */

export const MOCK_SPEND_AMOUNTS: number[] = [
  24.50, // food
   7.20, // transport
  15.80, // food
  42.60, // shopping
   8.90, // transport
  35.30, // entertainment
  12.40, // food
  19.75, // shopping
   6.60, // transport
  28.90, // food
  55.30, // bills
  14.10, // food
];

/* ─── Mock savings goals ──────────────────────────────────────────── */

export const MOCK_SAVINGS_GOALS: SavingsGoal[] = [
  {
    id:            "g-1",
    name:          "Emergency Fund (3 months)",
    targetAmount:  9000,
    currentAmount: 300,
    deadline:      "2027-05-01",
  },
  {
    id:            "g-2",
    name:          "Japan Trip 2027",
    targetAmount:  5000,
    currentAmount: 850,
    deadline:      "2027-03-01",
  },
];

/* ─── Mock recent savings activity ───────────────────────────────── */

export const MOCK_SAVINGS_ACTIVITY: SavingsActivity[] = [
  {
    id:     "act-1",
    label:  "Salary auto-allocation",
    pocket: "Bonus Pocket",
    amount: 600,
    date:   "2026-05-01",
    type:   "auto",
  },
  {
    id:     "act-2",
    label:  "Salary auto-allocation",
    pocket: "Emergency Fund",
    amount: 300,
    date:   "2026-05-01",
    type:   "auto",
  },
  {
    id:     "act-3",
    label:  "Salary auto-allocation",
    pocket: "Goal Savings",
    amount: 300,
    date:   "2026-05-01",
    type:   "auto",
  },
  {
    id:     "act-4",
    label:  "Round-up saving",
    pocket: "Bonus Pocket",
    amount: 5.05,
    date:   "2026-05-03",
    type:   "roundup",
  },
  {
    id:     "act-5",
    label:  "Manual income added",
    pocket: "Bonus Pocket",
    amount: 200,
    date:   "2026-04-28",
    type:   "manual",
  },
];

/* ─── Salary detection ────────────────────────────────────────────── */

export function detectSalary(transactions: IncomeTransaction[]): DetectedSalary | null {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  for (const tx of sorted) {
    const haystack = `${tx.description} ${tx.sender}`.toLowerCase();
    const isSalary = SALARY_KEYWORDS.some((kw) => haystack.includes(kw));
    if (isSalary && tx.amount >= 500) {
      return {
        amount:     tx.amount,
        source:     tx.sender,
        receivedOn: tx.date,
        confidence: tx.amount >= 1500 ? "high" : "medium",
      };
    }
  }
  return null;
}

/**
 * Detect income based on amount + type + source + description.
 * Used by the Dashboard income received flow.
 */
export function detectIncome(params: {
  amount: number;
  incomeType: "salary" | "allowance" | "part_time" | "freelance_income" | "cash_income";
  source: string;
  description: string;
}): IncomeDetectionResult {
  const amount = params.amount;
  const incomeType = params.incomeType;
  const source = params.source.trim();
  const description = params.description.trim();
  const haystack = `${source} ${description}`.toLowerCase();

  const keywords = INCOME_KEYWORDS[incomeType] ?? [];
  const keywordHit = keywords.find((kw) => haystack.includes(kw));
  const employerLike = /(sdn bhd|bhd|enterprise|holdings|technolog|tech|payroll)/i.test(source);
  const eduLike = /(utm|university|college|scholarship|allowance)/i.test(source);

  let confidence: IncomeDetectionResult["confidence"] = "low";
  let detectionReason = "Income details provided by user.";

  if (amount <= 0) {
    return {
      isIncome: false,
      incomeType,
      detectedCategory: incomeType,
      confidence: "low",
      detectionReason: "Invalid income amount.",
    };
  }

  if (keywordHit) {
    confidence = "high";
    detectionReason = `Detected keyword \"${keywordHit}\" in description/source.`;
  } else if (incomeType === "salary" && employerLike) {
    confidence = "high";
    detectionReason = "Employer-like source detected.";
  } else if (incomeType === "allowance" && eduLike) {
    confidence = "high";
    detectionReason = "Allowance-like source detected.";
  } else if (amount >= 1500 && incomeType === "salary") {
    confidence = "medium";
    detectionReason = "Amount matches common salary pattern.";
  } else if (amount >= 500) {
    confidence = "medium";
    detectionReason = "Amount is consistent with income event.";
  }

  return {
    isIncome: true,
    incomeType,
    detectedCategory: incomeType,
    confidence,
    detectionReason,
  };
}

/* ─── Allocation calculation ─────────────────────────────────────── */

export function calcAllocation(income: number, rule: AllocationRule): AllocationResult {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    income,
    spendingWallet: round2(income * rule.spendingWallet / 100),
    bonusPocket:    round2(income * rule.bonusPocket    / 100),
    emergencyFund:  round2(income * rule.emergencyFund  / 100),
    goalSavings:    round2(income * rule.goalSavings    / 100),
  };
}

export function ruleTotal(rule: AllocationRule): number {
  return rule.spendingWallet + rule.bonusPocket + rule.emergencyFund + rule.goalSavings;
}

/* ─── Round-up saving ────────────────────────────────────────────── */

export function calcRoundUp(amounts: number[]): RoundUpStats {
  let totalSaved       = 0;
  let transactionCount = 0;

  for (const amt of amounts) {
    const diff = parseFloat((Math.ceil(amt) - amt).toFixed(2));
    if (diff > 0 && diff < 1) {
      totalSaved += diff;
      transactionCount++;
    }
  }

  return {
    totalSaved:       parseFloat(totalSaved.toFixed(2)),
    transactionCount,
  };
}

/* ─── AI allocation recommendation ──────────────────────────────── */

export function getAIRecommendation(params: {
  currentRule:      AllocationRule;
  monthlyIncome:    number;
  monthlySpend:     number;
  emergencyBalance: number;
  debtRatio:        number;
}): AIRecommendation {
  const { currentRule, monthlyIncome, monthlySpend, emergencyBalance, debtRatio } = params;

  const safeBudget      = monthlyIncome * 0.60;
  const isOverspending  = monthlySpend > safeBudget;
  const spendOverPct    = safeBudget > 0 ? Math.round(((monthlySpend - safeBudget) / safeBudget) * 100) : 0;
  const emergencyMonths = monthlySpend > 0 ? emergencyBalance / monthlySpend : 0;
  const isEmergencyWeak = emergencyMonths < 1.5;
  const isHighDebt      = debtRatio > 0.15;
  const isSavingsWeak   = currentRule.bonusPocket < 15;

  // Derive recommended rule
  let rule: AllocationRule = { ...currentRule };
  let insight: string;
  const changes: string[] = [];

  if (isOverspending && isEmergencyWeak) {
    rule = { spendingWallet: 55, bonusPocket: 20, emergencyFund: 15, goalSavings: 10 };
    insight =
      `Your discretionary spending is ${spendOverPct}% above your safe budget, and your emergency fund ` +
      `covers less than ${emergencyMonths.toFixed(1)} month of expenses. SmartGX recommends tightening your ` +
      `Spending Wallet and directing more toward your Emergency Fund this month to stabilise your cashflow.`;
    changes.push(`Reduce Spending Wallet from ${currentRule.spendingWallet}% → 55%`);
    changes.push(`Increase Emergency Fund from ${currentRule.emergencyFund}% → 15%`);

  } else if (isHighDebt) {
    rule = { spendingWallet: 55, bonusPocket: 15, emergencyFund: 20, goalSavings: 10 };
    insight =
      "Your debt or credit usage is above the safe threshold. SmartGX recommends a conservative spending " +
      "allocation and a stronger Emergency Fund buffer to avoid cashflow pressure next month.";
    changes.push(`Reduce Spending Wallet → 55%`);
    changes.push(`Increase Emergency Fund → 20%`);

  } else if (isEmergencyWeak) {
    const newEmergency    = Math.min(currentRule.emergencyFund + 5, 20);
    const newSpending     = Math.max(currentRule.spendingWallet - 5, 50);
    rule = { ...currentRule, emergencyFund: newEmergency, spendingWallet: newSpending };
    insight =
      `Your emergency fund is still thin at ~${emergencyMonths.toFixed(1)} months of expenses — below the ` +
      `recommended 3-month buffer. SmartGX suggests redirecting 5% from your Spending Wallet into Emergency ` +
      `Fund until your buffer reaches a safer level.`;
    changes.push(`Increase Emergency Fund from ${currentRule.emergencyFund}% → ${newEmergency}%`);
    changes.push(`Reduce Spending Wallet from ${currentRule.spendingWallet}% → ${newSpending}%`);

  } else if (isSavingsWeak) {
    const newBonus    = Math.min(currentRule.bonusPocket + 5, 30);
    const newSpending = Math.max(currentRule.spendingWallet - 5, 50);
    rule = { ...currentRule, bonusPocket: newBonus, spendingWallet: newSpending };
    insight =
      "Your Bonus Pocket allocation is lower than optimal for your income level. SmartGX recommends " +
      "increasing your saving rate slightly so your wealth buffer grows faster over the coming months.";
    changes.push(`Increase Bonus Pocket from ${currentRule.bonusPocket}% → ${newBonus}%`);
    changes.push(`Reduce Spending Wallet from ${currentRule.spendingWallet}% → ${newSpending}%`);

  } else {
    insight =
      "Your current allocation is well-balanced for your income level. Keep your saving habit consistent. " +
      "Once your emergency fund reaches 2 months, consider shifting 5% from Emergency Fund to Goal Savings.";
    changes.push("Current allocation is near-optimal — no major changes needed");
  }

  return { rule, insight, changes };
}
