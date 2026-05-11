import { getAiConfig } from "../ai/ai.config";
import { callSmartGxAi } from "../../services/ai/ai.client";
import { polishAiOutput } from "../../lib/aiText";
import { SMARTGX_AI_WRITING_RULES } from "../../services/ai/aiPromptStyle";

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
  /** Optional rich context for AI only -- does not change scoring math in fallback(). */
  mainAccountBalance?: number;
  totalSavingsPockets?: number;
  flexiCreditOutstanding?: number;
  flexiApprovedLimit?: number;
  flexiAvailableCredit?: number;
  flexiNextRepaymentDate?: string | null;
  flexiMonthlyRepayment?: number;
  annualProfitRate?: number;
  projectedMonthEndMainBalance?: number;
  estimatedNewDrawdownMonthlyRepayment?: number;
  estimatedNewDrawdownTotalRepayment?: number;
  tenureMonths?: number;
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

function fmtRm(n: number): string {
  const r = Math.round(n);
  return r >= 1000 ? `RM${r.toLocaleString("en-MY")}` : `RM${r}`;
}

function fallback(context: DebtReadinessContext): DebtReadinessResult {
  const repaymentCapacity = Math.max(0, Math.round(context.monthlyIncome * 0.25 - context.existingMonthlyCommitments));
  const riskFactors: string[] = [];
  const positiveFactors: string[] = [];
  let score = 60;

  if (context.gxHealthScore >= 70) {
    score += 12;
    positiveFactors.push(`GXHealth at ${context.gxHealthScore} suggests more room to handle repayments if income stays steady.`);
  } else if (context.gxHealthScore < 45) {
    score -= 18;
    riskFactors.push(`GXHealth at ${context.gxHealthScore} suggests cashflow is already under pressure before new borrowing.`);
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
    riskFactors.push(
      `Requested ${fmtRm(context.desiredDrawdown)} is high versus a conservative repayment capacity near ${fmtRm(repaymentCapacity)} per month from this model.`
    );
  } else {
    positiveFactors.push("Requested drawdown is within a manageable range versus modelled repayment capacity.");
  }

  if (context.emergencyBalance >= context.monthlyExpenses * 1.5) {
    positiveFactors.push(`Emergency savings near ${fmtRm(context.emergencyBalance)} add resilience.`);
  } else {
    riskFactors.push(`Emergency savings near ${fmtRm(context.emergencyBalance)} are thin versus monthly spend near ${fmtRm(context.monthlyExpenses)}.`);
  }

  const debtReadinessScore = clamp(score);
  const readinessLevel: ReadinessLevel =
    debtReadinessScore >= 75 ? "ready" : debtReadinessScore >= 58 ? "cautious" : debtReadinessScore >= 40 ? "risky" : "not_recommended";
  const recommendedDrawdown = Math.max(0, Math.min(context.desiredDrawdown, repaymentCapacity * 5, context.requestedLimit));
  const recommendedLimit = Math.max(500, Math.min(context.requestedLimit, repaymentCapacity * 8));

  const recommendedActions: string[] = [];
  if (readinessLevel !== "ready") recommendedActions.push("Consider a smaller drawdown aligned to your repayment capacity.");
  if (HIGH_RISK_PURPOSE.includes(context.purpose)) recommendedActions.push("Use borrowed funds only for essential needs, not lifestyle spending.");
  if (context.emergencyBalance < context.monthlyExpenses) recommendedActions.push("Build emergency savings further before taking larger borrowing.");
  if (recommendedActions.length === 0) recommendedActions.push("Maintain repayment discipline and keep auto repayment enabled.");

  const main = context.mainAccountBalance;
  const proj = context.projectedMonthEndMainBalance;
  const mainLine =
    typeof main === "number" && main >= 0
      ? ` Main Account is about ${fmtRm(main)}${typeof proj === "number" ? ` and a simple month-end view lands near ${fmtRm(proj)} on Main if spend stays similar` : ""}.`
      : "";

  const aiExplanation =
    readinessLevel === "ready"
      ? polishAiOutput(
          `Readiness score ${debtReadinessScore} with ${readinessLevel} band. Your modelled repayment headroom is about ${fmtRm(repaymentCapacity)} per month after existing commitments.${mainLine} SmartGX still does not guarantee approval.`
        )
      : readinessLevel === "cautious"
        ? polishAiOutput(
            `Readiness score ${debtReadinessScore}. Borrowing may work if you keep the drawdown near ${fmtRm(recommendedDrawdown)} instead of the full ${fmtRm(context.desiredDrawdown)}.${mainLine} Watch FlexiCredit repayment dates against your income dates.`
          )
        : readinessLevel === "risky"
          ? polishAiOutput(
              `Readiness score ${debtReadinessScore}. New borrowing at ${fmtRm(context.desiredDrawdown)} stacks on existing pressure when GXHealth is ${context.gxHealthScore} and emergency is ${fmtRm(context.emergencyBalance)}.${mainLine} Delay or reduce the amount if you can.`
            )
          : polishAiOutput(
              `Readiness score ${debtReadinessScore}. SmartGX would not treat this profile as ready for new FlexiCredit right now. Improve emergency savings and repayment headroom first.${mainLine}`
            );

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
      "flexicredit_debt_readiness",
      [
        "Explain this user's FlexiCredit debt readiness in 4 to 6 short sentences for a Malaysian reader.",
        "Use RM amounts from context. Your explanation must answer: Is borrowing this amount affordable given repaymentCapacity? Is repayment pressure comfortable considering existingMonthlyCommitments and estimatedNewDrawdownMonthlyRepayment? Should the user reduce the drawdown amount or delay? How does borrowing affect Debt Risk and GXHealth?",
        "Mention the purpose and whether it is essential or discretionary.",
        "State clearly that SmartGX AI does not guarantee approval or pricing.",
        "Do not contradict readinessLevel or debtReadinessScore from context.",
        SMARTGX_AI_WRITING_RULES,
        "Plain text only. No JSON.",
      ].join(" "),
      {
        readinessLevel: base.readinessLevel,
        debtReadinessScore: base.debtReadinessScore,
        requestedLimit: context.requestedLimit,
        desiredDrawdown: context.desiredDrawdown,
        monthlyIncome: context.monthlyIncome,
        monthlyExpenses: context.monthlyExpenses,
        existingMonthlyCommitments: context.existingMonthlyCommitments,
        gxHealthScore: context.gxHealthScore,
        purpose: context.purpose,
        riskFactors: base.riskFactors,
        positiveFactors: base.positiveFactors,
        repaymentCapacity: base.repaymentCapacity,
        recommendedDrawdown: base.recommendedDrawdown,
        emergencyBalance: context.emergencyBalance,
        savingsBalance: context.savingsBalance,
        mainAccountBalance: context.mainAccountBalance,
        totalSavingsPockets: context.totalSavingsPockets,
        flexiCreditOutstanding: context.flexiCreditOutstanding,
        flexiApprovedLimit: context.flexiApprovedLimit,
        flexiAvailableCredit: context.flexiAvailableCredit,
        flexiNextRepaymentDate: context.flexiNextRepaymentDate,
        flexiMonthlyRepayment: context.flexiMonthlyRepayment,
        annualProfitRate: context.annualProfitRate,
        projectedMonthEndMainBalance: context.projectedMonthEndMainBalance,
        estimatedNewDrawdownMonthlyRepayment: context.estimatedNewDrawdownMonthlyRepayment,
        estimatedNewDrawdownTotalRepayment: context.estimatedNewDrawdownTotalRepayment,
        tenureMonths: context.tenureMonths,
      },
      config
    );
    if (res?.success && res.content.trim()) {
      return { ...base, aiExplanation: polishAiOutput(res.content.trim().slice(0, 1200)) };
    }
  } catch {
    /* keep base */
  }
  return base;
}
