import type { AIRecommendation } from "../savings/savings.types";
import { callSmartGxAi } from "../../services/ai/ai.client";
import { getAiConfig } from "../../services/ai/ai.config";
import { polishAiOutput } from "../../lib/aiText";
import { SMARTGX_AI_WRITING_RULES } from "../../services/ai/aiPromptStyle";

export interface SavingAllocationAiContext {
  /** Rule from SmartGX engine — percentages only; do not change in this module. */
  localRecommendation: AIRecommendation;
  monthlyIncome: number;
  monthlySpend: number;
  mainAccountBalance: number;
  bonusBalance: number;
  emergencyBalance: number;
  goalsBalance: number;
  emergencyTargetRm: number;
  gxHealthScore?: number;
  debtRiskScore?: number;
  flexiCreditOutstanding?: number;
  roundUpEnabled?: boolean;
  autoAllocationEnabled?: boolean;
  savingStreakDays?: number;
  /** Last auto allocation breakdown if any */
  lastAutoAllocation?: {
    amount: number;
    spendingWallet: number;
    bonusPocket: number;
    emergencyFund: number;
    goalSavings: number;
  } | null;
}

/**
 * Richer natural-language explanation for the Saving screen.
 * Does not alter allocation percentages (those stay from savings.engine).
 */
export async function enrichSavingAllocationExplanation(ctx: SavingAllocationAiContext): Promise<string | null> {
  const cfg = getAiConfig();
  if (!cfg.enabled) return null;

  const { localRecommendation, monthlyIncome, monthlySpend } = ctx;
  const rule = localRecommendation.rule;

  try {
    const res = await callSmartGxAi(
      "saving_allocation_explanation",
      [
        "Explain why SmartGX split income across Spending Wallet, Bonus Pocket, Emergency Fund, and Goal Savings for this user.",
        "Use the percentages and RM amounts in context.",
        "",
        "Your explanation must cover:",
        "1. Why Main Account (Spending Wallet) keeps its share — is it enough for upcoming expenses?",
        "2. Why Bonus Pocket gets flexible growth money — mention the current Bonus balance.",
        "3. Why Emergency Fund gets priority or not — compare current Emergency balance against emergencyTargetRm.",
        "4. Why Goals Pocket gets long-term saving — mention progress if goalsBalance is provided.",
        "5. Whether the overall rule is too aggressive (leaving Main too low) or too conservative (saving too little).",
        "6. How this allocation helps or hurts GXHealth and financial resilience.",
        "",
        "If Emergency balance is well below target, say Emergency should be the priority.",
        "If saving streak is strong, acknowledge it positively.",
        "Do not change the numeric rule in context. You are explaining only.",
        SMARTGX_AI_WRITING_RULES,
        "Plain text only. 4–7 sentences.",
      ].join(" "),
      {
        localInsight: localRecommendation.insight,
        localChanges: localRecommendation.changes,
        rulePercents: {
          spendingWallet: rule.spendingWallet,
          bonusPocket: rule.bonusPocket,
          emergencyFund: rule.emergencyFund,
          goalSavings: rule.goalSavings,
        },
        monthlyIncome,
        monthlySpend,
        mainAccountBalance: ctx.mainAccountBalance,
        bonusBalance: ctx.bonusBalance,
        emergencyBalance: ctx.emergencyBalance,
        goalsBalance: ctx.goalsBalance,
        emergencyTargetRm: ctx.emergencyTargetRm,
        totalSavings: ctx.bonusBalance + ctx.emergencyBalance + ctx.goalsBalance,
        gxHealthScore: ctx.gxHealthScore,
        debtRiskScore: ctx.debtRiskScore,
        flexiCreditOutstanding: ctx.flexiCreditOutstanding,
        roundUpEnabled: ctx.roundUpEnabled,
        autoAllocationEnabled: ctx.autoAllocationEnabled,
        savingStreakDays: ctx.savingStreakDays,
        lastAutoAllocation: ctx.lastAutoAllocation,
      },
      cfg
    );

    if (!res?.success || !res.content.trim()) return null;
    return polishAiOutput(res.content.trim().slice(0, 1400));
  } catch {
    return null;
  }
}
