import type {
  NudgeEvaluation,
  NudgeRiskContext,
  ReasonAnalysisResult,
  ReasonRiskDim,
} from "./nudge.types";
import { callSmartGxAi } from "../../services/ai/ai.client";
import { getAiConfig } from "../ai/ai.config";

function fallbackNudge(context: NudgeRiskContext, evaluation: NudgeEvaluation): string {
  const amount = `RM${context.amount.toFixed(2)}`;
  const topCat = context.topSpendingCategory || "others";
  const flexi = context.cardType === "flexicard";

  if (evaluation.riskLevel === "critical") {
    return `This ${amount} ${context.actionType.replace("_", " ")} is high pressure on your available cashflow. ${
      flexi ? "Using Credit now means future-money repayment stress." : ""
    } SmartGX recommends cancelling or saving this amount first.`;
  }
  if (flexi) {
    return `You are about to use Credit for ${amount}. Your current GXHealth score is ${context.gxHealthScore}, and ${
      topCat
    } spending is already elevated this month. SmartGX recommends using Debit Card if possible.`;
  }
  if (evaluation.reasonCodes.includes("amount_over_25pct_available")) {
    return `This payment of ${amount} is more than 25% of your available balance. Continuing may reduce buffer for essentials this week.`;
  }
  if (evaluation.reasonCodes.includes("category_pressure")) {
    return `Your ${topCat} category is already taking a high share of monthly spending. This ${amount} transaction may increase category pressure.`;
  }
  return `Before continuing, review if this ${amount} transaction supports your current savings and cashflow goals.`;
}

export async function generateAiNudge(context: NudgeRiskContext, evaluation: NudgeEvaluation): Promise<string> {
  const config = getAiConfig();
  if (!config.enabled) return fallbackNudge(context, evaluation);

  try {
    const res = await callSmartGxAi(
      "nudge",
      [
        "Write one concise SmartGX payment nudge (max 3 short sentences).",
        "Be specific to amount, payment method, and risk level. Plain text only.",
      ].join(" "),
      {
        riskLevel: evaluation.riskLevel,
        reasonCodes: evaluation.reasonCodes,
        actionType: context.actionType,
        amount: context.amount,
        merchant: context.merchant,
        category: context.category,
        gxHealthScore: context.gxHealthScore,
        cardType: context.cardType,
        topSpendingCategory: context.topSpendingCategory,
        availableBalance: context.availableBalance,
      },
      config
    );
    if (res?.success && res.content.trim()) return res.content.trim().slice(0, 900);
  } catch {
    /* fallback */
  }

  return fallbackNudge(context, evaluation);
}

function parseReasonDims(v: unknown): ReasonRiskDim | null {
  if (v === "low" || v === "medium" || v === "high") return v;
  return null;
}

function tryParseReasonAnalysisJson(raw: string): ReasonAnalysisResult | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]) as Record<string, unknown>;
    const necessity = parseReasonDims(j.necessity);
    const urgency = parseReasonDims(j.urgency);
    const impulseRisk = parseReasonDims(j.impulseRisk);
    const fraudRisk = parseReasonDims(j.fraudRisk);
    const cashflowConcern = parseReasonDims(j.cashflowConcern);
    const rec = j.recommendation;
    const recommendation =
      rec === "allow" ||
      rec === "delay" ||
      rec === "block" ||
      rec === "use_debit" ||
      rec === "save_instead" ||
      rec === "reduce_amount"
        ? rec
        : null;
    const explanation = typeof j.explanation === "string" ? j.explanation : null;
    const saferAlternative = typeof j.saferAlternative === "string" ? j.saferAlternative : "";
    const canContinue = typeof j.canContinue === "boolean" ? j.canContinue : false;
    if (!necessity || !urgency || !impulseRisk || !fraudRisk || !cashflowConcern || !recommendation || !explanation) return null;
    return {
      necessity,
      urgency,
      impulseRisk,
      fraudRisk,
      cashflowConcern,
      recommendation,
      explanation,
      saferAlternative,
      canContinue,
    };
  } catch {
    return null;
  }
}

export async function generateRemoteReasonAnalysis(
  reason: string,
  context: NudgeRiskContext,
  evaluation: NudgeEvaluation
): Promise<ReasonAnalysisResult | null> {
  const config = getAiConfig();
  if (!config.enabled) return null;
  try {
    const remainingBalance = Math.round((context.availableBalance - context.amount) * 100) / 100;
    const riskScore =
      evaluation.riskLevel === "critical" ? 90
      : evaluation.riskLevel === "high" ? 70
      : evaluation.riskLevel === "medium" ? 45
      : 20;

    const local = localAnalyzeCriticalReason(reason, context, evaluation);

    const res = await callSmartGxAi(
      "critical_reason",
      [
        "Analyze the user's stated reason for a high-risk SmartGX transaction.",
        "Return JSON only with keys: necessity, urgency, impulseRisk, fraudRisk, cashflowConcern (each low|medium|high),",
        "recommendation (allow|delay|block|use_debit|save_instead|reduce_amount), explanation (string), saferAlternative (string), canContinue (boolean).",
        "Be conservative on fraud; align with SmartGX safety.",
      ].join(" "),
      {
        reason: reason.slice(0, 2000),
        riskScore,
        riskLevel: evaluation.riskLevel,
        actionType: context.actionType,
        amount: context.amount,
        gxHealthScore: context.gxHealthScore,
        remainingBalance,
        localAnalysis: local,
      },
      config
    );

    if (!res?.success || !res.content.trim()) return null;

    const parsed =
      Object.keys(res.structured).length > 0 ? tryParseReasonAnalysisJson(JSON.stringify(res.structured)) : null;
    const fromText = parsed ?? tryParseReasonAnalysisJson(res.content);
    return fromText;
  } catch {
    return null;
  }
}

const STRONG_REASONS = [
  "rent",
  "tuition",
  "school fee",
  "medical",
  "hospital",
  "emergency",
  "bill",
  "utilities",
  "loan repayment",
  "own account",
  "transfer to my bank",
  "family support",
];

const WEAK_IMPULSE = [
  "shopping",
  "phone",
  "laptop",
  "gadget",
  "gaming",
  "entertainment",
  "luxury",
  "sale",
  "discount",
  "want to buy",
  "gift",
];

const SCAM_RISK = [
  "guaranteed return",
  "investment opportunity",
  "urgent stranger",
  "prize",
  "claim reward",
  "processing fee",
  "crypto quick profit",
  "unknown seller",
  "someone told me",
  "urgent transfer to unknown",
];

function dimFromScore(s: number): ReasonRiskDim {
  if (s >= 3) return "high";
  if (s >= 2) return "medium";
  return "low";
}

export function localAnalyzeCriticalReason(
  reason: string,
  context: NudgeRiskContext,
  evaluation: NudgeEvaluation
): ReasonAnalysisResult {
  const n = reason.trim().toLowerCase();

  const strongHit = STRONG_REASONS.some((k) => n.includes(k));
  const weakHit = WEAK_IMPULSE.some((k) => n.includes(k));
  const scamHit = SCAM_RISK.some((k) => n.includes(k));

  let necessityScore = 1;
  if (strongHit) necessityScore = 3;
  else if (weakHit && /laptop|phone|gadget/.test(n)) necessityScore = 2;
  else if (n.length >= 12) necessityScore = 2;

  let impulseScore = 1;
  if (weakHit) {
    impulseScore = /want to buy|laptop|gadget|gaming|luxury|sale|discount|gift/.test(n) ? 3 : 2;
  }
  if (strongHit && !weakHit) impulseScore = 1;
  if (strongHit && weakHit) impulseScore = Math.min(impulseScore, 2);

  const fraudScore = scamHit ? 3 : 1;

  let urgencyScore = 1;
  if (/emergency|urgent|hospital|medical|due today|today only/.test(n)) urgencyScore = 3;
  else if (strongHit) urgencyScore = 2;

  const avail = Math.max(context.availableBalance, 0.01);
  const ratio = context.amount / avail;
  const remaining = context.availableBalance - context.amount;

  let cashScore = 1;
  if (ratio > 0.5 || remaining < 50) cashScore = 3;
  else if (ratio > 0.25 || remaining < 120) cashScore = 2;

  if (evaluation.reasonCodes.includes("amount_over_50pct_available")) cashScore = Math.max(cashScore, 3);
  if (evaluation.reasonCodes.includes("amount_over_25pct_available")) cashScore = Math.max(cashScore, 2);

  if (context.gxHealthScore < 40) cashScore = Math.min(3, cashScore + 1);
  if (context.gxHealthScore < 30) cashScore = Math.min(3, cashScore + 1);

  const necessity = dimFromScore(necessityScore);
  const urgency = dimFromScore(urgencyScore);
  const impulseRisk = dimFromScore(impulseScore);
  const fraudRisk = dimFromScore(fraudScore);
  const cashflowConcern = dimFromScore(cashScore);

  const flexiWithDebitOption =
    context.cardType === "flexicard" && context.currentBalance >= context.amount;

  if (fraudRisk === "high" || scamHit) {
    return {
      necessity,
      urgency,
      impulseRisk,
      fraudRisk: "high",
      cashflowConcern,
      recommendation: "block",
      canContinue: false,
      explanation:
        "This reason contains wording often associated with scams or unsafe money requests. SmartGX recommends blocking this action and verifying outside the app.",
      saferAlternative: "Cancel and verify the recipient through official channels.",
    };
  }

  if (strongHit && impulseScore <= 1) {
    const severeCashflow = cashScore >= 3;
    return {
      necessity: "high",
      urgency,
      impulseRisk: "low",
      fraudRisk: "low",
      cashflowConcern,
      recommendation: severeCashflow ? "reduce_amount" : "allow",
      canContinue: true,
      explanation:
        severeCashflow
          ? "This appears to be a necessary payment. SmartGX allows you to continue, but the current amount puts high pressure on your cashflow. Please confirm carefully or reduce the amount."
          : "This appears to be a necessary payment. SmartGX allows you to continue after confirmation.",
      saferAlternative: severeCashflow
        ? "Try a smaller amount first and complete the remaining payment later."
        : "Proceed with confirmation and passcode verification.",
    };
  }

  if (strongHit && cashScore >= 3) {
    return {
      necessity: "high",
      urgency,
      impulseRisk,
      fraudRisk: "low",
      cashflowConcern: "high",
      recommendation: "delay",
      canContinue: false,
      explanation:
        "Although this looks like necessary spending, the amount still puts severe pressure on your remaining balance. Consider delaying part of the payment or a smaller amount.",
      saferAlternative: "Try a smaller amount or split this payment.",
    };
  }

  if (weakHit || impulseScore >= 2) {
    if (flexiWithDebitOption && impulseScore >= 2) {
      return {
        necessity,
        urgency,
        impulseRisk,
        fraudRisk: "low",
        cashflowConcern,
        recommendation: "use_debit",
        canContinue: false,
        explanation:
          "This looks like discretionary spending. You have enough debit balance—SmartGX recommends using Debit instead of Credit, or delaying until you have saved for it.",
        saferAlternative: "Use Debit Instead or Save Instead.",
      };
    }

    const highCash = cashflowConcern === "high" || cashScore >= 3;
    return {
      necessity,
      urgency,
      impulseRisk,
      fraudRisk: "low",
      cashflowConcern,
      recommendation: highCash ? "save_instead" : "delay",
      canContinue: false,
      explanation:
        "Buying a laptop or similar item may be useful, but your reason does not show urgent necessity. Since this transaction creates high pressure on your available cashflow, SmartGX recommends delaying the purchase or saving first.",
      saferAlternative: highCash ? "Save Instead or try a smaller amount." : "Delay and review GXHealth.",
    };
  }

  return {
    necessity,
    urgency,
    impulseRisk,
    fraudRisk: "low",
    cashflowConcern,
    recommendation: cashScore >= 3 ? "save_instead" : "delay",
    canContinue: false,
    explanation:
      "SmartGX could not confirm strong necessity from your reason. Review GXHealth, try a smaller amount, or save toward this goal first.",
    saferAlternative: cashScore >= 3 ? "Save Instead." : "Try a smaller amount.",
  };
}

export async function analyzeCriticalReasonWithContext(
  reason: string,
  context: NudgeRiskContext,
  evaluation: NudgeEvaluation
): Promise<ReasonAnalysisResult> {
  let remote: ReasonAnalysisResult | null = null;
  try {
    remote = await generateRemoteReasonAnalysis(reason, context, evaluation);
  } catch {
    remote = null;
  }
  if (remote) return remote;
  return localAnalyzeCriticalReason(reason, context, evaluation);
}
