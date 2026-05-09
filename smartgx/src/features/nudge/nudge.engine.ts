import type { NudgeEvaluation, NudgeRiskContext, NudgeRiskLevel } from "./nudge.types";

function nextRisk(current: NudgeRiskLevel, target: NudgeRiskLevel): NudgeRiskLevel {
  const rank: Record<NudgeRiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  return rank[target] > rank[current] ? target : current;
}

export function evaluateNudgeRisk(context: NudgeRiskContext): NudgeEvaluation {
  let riskLevel: NudgeRiskLevel = "low";
  const reasonCodes: string[] = [];

  const amountVsAvailable =
    context.availableBalance > 0 ? context.amount / context.availableBalance : 1;
  const remainingAfter = context.availableBalance - context.amount;
  const incomeRatio =
    context.monthlyIncome > 0 ? context.monthlyExpense / context.monthlyIncome : 1;

  const flexiAction =
    context.cardType === "flexicard" ||
    context.actionType === "flexicard_payment";

  if (flexiAction) {
    riskLevel = nextRisk(riskLevel, "medium");
    reasonCodes.push("future_money_usage");
  }
  if (flexiAction && context.amount >= 300) {
    riskLevel = nextRisk(riskLevel, "high");
    reasonCodes.push("large_flexicard_amount");
  }
  if (flexiAction && context.gxHealthScore < 50) {
    riskLevel = nextRisk(riskLevel, "high");
    reasonCodes.push("low_health_with_flexicard");
  }
  if (flexiAction && context.gxHealthScore < 35) {
    riskLevel = nextRisk(riskLevel, "critical");
    reasonCodes.push("critical_health_with_flexicard");
  }

  if (amountVsAvailable > 0.25) {
    riskLevel = nextRisk(riskLevel, "high");
    reasonCodes.push("amount_over_25pct_available");
  }
  if (amountVsAvailable > 0.5) {
    riskLevel = nextRisk(riskLevel, "critical");
    reasonCodes.push("amount_over_50pct_available");
  }
  if (remainingAfter < 120) {
    riskLevel = nextRisk(riskLevel, "high");
    reasonCodes.push("low_remaining_balance");
  }

  const categoryPressure =
    context.monthlyExpense > 0 ? context.categorySpending / context.monthlyExpense : 0;
  if (categoryPressure > 0.3) {
    riskLevel = nextRisk(riskLevel, "medium");
    reasonCodes.push("category_pressure");
  }

  if (!context.hasBudget && incomeRatio > 0.75) {
    riskLevel = nextRisk(riskLevel, "medium");
    reasonCodes.push("no_budget_high_spending");
  }
  if (context.hasBudget && context.budgetAmount && context.monthlyExpense > context.budgetAmount) {
    riskLevel = nextRisk(riskLevel, "high");
    reasonCodes.push("budget_exceeded");
  }

  const riskyRecentCount = context.recentTransactions.filter(
    (t) => t.type === "expense" && t.amount >= 200
  ).length;
  if (riskyRecentCount >= 3) {
    riskLevel = nextRisk(riskLevel, "high");
    reasonCodes.push("repeated_large_spending");
  }

  const recommendUseDebitInstead =
    flexiAction && context.currentBalance >= context.amount;
  const recommendSaveInstead =
    riskLevel === "high" || riskLevel === "critical";

  const suggestedAction =
    riskLevel === "critical"
      ? "Delay this transaction, review GXHealth, or save this amount first."
      : recommendUseDebitInstead
      ? "Use Debit Card instead of Credit when possible."
      : riskLevel === "high"
      ? "Consider reducing this amount or saving first."
      : "Proceed mindfully and keep an eye on your spending pattern.";

  return {
    riskLevel,
    reasonCodes,
    suggestedAction,
    requiresSoftFriction: riskLevel !== "low" || flexiAction,
    requiresCountdown: riskLevel === "high" || riskLevel === "critical",
    requiresReasonInput: riskLevel === "critical",
    shouldCreateNotification: riskLevel === "high" || riskLevel === "critical" || flexiAction,
    recommendUseDebitInstead,
    recommendSaveInstead,
  };
}
