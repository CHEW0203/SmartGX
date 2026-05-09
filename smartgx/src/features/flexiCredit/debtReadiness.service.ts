import { getAiConfig } from "../ai/ai.config";
import { callSmartGxAi } from "../../services/ai/ai.client";

export type ReadinessLevel = "ready" | "cautious" | "risky" | "not_recommended";
export type BorrowPurpose =
  | "emergency"
  | "education"
  | "medical"
  | "home_family"
  | "business_cashflow"
  | "bills_commitments"
  | "shopping_lifestyle"
  | "other";

export interface DebtReadinessContext {
  requestedLimit: number;
  desiredDrawdown: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  existingMonthlyCommitments: number;
  gxHealthScore: number;
  savingsBalance: number;
  emergencyBalance: number;
  repaymentHistoryScore: number;
  employmentType: string;
  documentsQuality: "good" | "partial" | "weak";
  purpose: BorrowPurpose;
}

export interface DebtReadinessResult {
  debtReadinessScore: number;
  readinessLevel: ReadinessLevel;
  recommendedLimit: number;
  recommendedDrawdown: number;
  repaymentCapacity: number;
  riskFactors: string[];
  positiveFactors: string[];
  aiExplanation: string;
  recommendedActions: string[];
}

const LOW_RISK_PURPOSE: BorrowPurpose[] = ["medical", "education", "emergency", "bills_commitments", "business_cashflow"];
const HIGH_RISK_PURPOSE: BorrowPurpose[] = ["shopping_lifestyle", "other"];

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function fallback(context: DebtReadinessContext): DebtReadinessResult {
  const repaymentCapacity = Math.max(0, Math.round(context.monthlyIncome * 0.25 - context.existingMonthlyCommitments));
  const riskFactors: string[] = [];
  const positiveFactors: string[] = [];
  let score = 60;

  if (context.gxHealthScore >= 70) {
    score += 12;
    positiveFactors.push("Strong GXHealth indicates healthier repayment behavior.");
  } else if (context.gxHealthScore < 45) {
    score -= 18;
    riskFactors.push("Low GXHealth suggests elevated debt pressure.");
  }

  if (context.documentsQuality === "good") positiveFactors.push("Document quality is complete and stable.");
  if (context.documentsQuality === "weak") {
    score -= 12;
    riskFactors.push("Document quality is weak and requires review.");
  }

  if (LOW_RISK_PURPOSE.includes(context.purpose)) {
    score += 8;
    positiveFactors.push("Borrowing purpose is essential and financially justifiable.");
  }
  if (HIGH_RISK_PURPOSE.includes(context.purpose)) {
    score -= 14;
    riskFactors.push("Borrowing purpose appears discretionary and higher risk.");
  }

  if (context.desiredDrawdown > repaymentCapacity * 6) {
    score -= 20;
    riskFactors.push("Requested drawdown is high relative to safe repayment capacity.");
  } else {
    positiveFactors.push("Requested drawdown is within manageable repayment range.");
  }

  if (context.emergencyBalance >= context.monthlyExpenses * 1.5) positiveFactors.push("Emergency savings buffer is available.");
  else riskFactors.push("Emergency savings buffer is limited.");

  const debtReadinessScore = clamp(score);
  const readinessLevel: ReadinessLevel =
    debtReadinessScore >= 75 ? "ready" : debtReadinessScore >= 58 ? "cautious" : debtReadinessScore >= 40 ? "risky" : "not_recommended";
  const recommendedDrawdown = Math.max(0, Math.min(context.desiredDrawdown, repaymentCapacity * 5, context.requestedLimit));
  const recommendedLimit = Math.max(500, Math.min(context.requestedLimit, repaymentCapacity * 8));

  const recommendedActions: string[] = [];
  if (readinessLevel !== "ready") recommendedActions.push("Consider a smaller drawdown aligned to your repayment capacity.");
  if (HIGH_RISK_PURPOSE.includes(context.purpose)) recommendedActions.push("Use borrowed funds only for essential needs, not lifestyle spending.");
  if (context.emergencyBalance < context.monthlyExpenses) recommendedActions.push("Build emergency fund further before taking larger borrowing.");
  if (recommendedActions.length === 0) recommendedActions.push("Maintain repayment discipline and keep auto repayment enabled.");

  const aiExplanation =
    readinessLevel === "ready"
      ? "Your repayment profile is currently stable. Borrow conservatively and keep repayment automation active."
      : readinessLevel === "cautious"
        ? "Your profile supports borrowing with caution. SmartGX recommends a smaller drawdown to protect monthly cashflow."
        : readinessLevel === "risky"
          ? "Current borrowing pressure is elevated. Reduce drawdown and prioritize essential-purpose funding only."
          : "Borrowing is not recommended right now. Improve savings buffer and repayment capacity first.";

  return {
    debtReadinessScore,
    readinessLevel,
    recommendedLimit: Math.round(recommendedLimit),
    recommendedDrawdown: Math.round(recommendedDrawdown),
    repaymentCapacity,
    riskFactors,
    positiveFactors,
    aiExplanation,
    recommendedActions,
  };
}

export async function generateDebtReadinessAnalysis(context: DebtReadinessContext): Promise<DebtReadinessResult> {
  const base = fallback(context);
  const config = getAiConfig();
  if (!config.enabled) return base;
  try {
    const res = await callSmartGxAi(
      "debt_readiness",
      [
        "Explain this user's SmartGX FlexiCredit debt readiness in 2–3 short sentences.",
        "Reference repayment capacity and purpose. Do not contradict the readiness level or numeric score.",
        "Plain text only.",
      ].join(" "),
      {
        readinessLevel: base.readinessLevel,
        debtReadinessScore: base.debtReadinessScore,
        requestedLimit: context.requestedLimit,
        desiredDrawdown: context.desiredDrawdown,
        monthlyIncome: context.monthlyIncome,
        monthlyExpenses: context.monthlyExpenses,
        gxHealthScore: context.gxHealthScore,
        purpose: context.purpose,
        riskFactors: base.riskFactors,
        positiveFactors: base.positiveFactors,
      },
      config
    );
    if (res?.success && res.content.trim()) {
      return { ...base, aiExplanation: res.content.trim().slice(0, 900) };
    }
  } catch {
    /* keep base */
  }
  return base;
}

