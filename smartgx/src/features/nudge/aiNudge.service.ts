import type {
  NudgeEvaluation,
  NudgeRiskContext,
  ReasonAnalysisResult,
  ReasonRiskDim,
} from "./nudge.types";
import { callSmartGxAi } from "../../services/ai/ai.client";
import { getAiConfig } from "../ai/ai.config";
import { polishAiOutput } from "../../lib/aiText";
import { SMARTGX_AI_WRITING_RULES } from "../../services/ai/aiPromptStyle";

/** Cap wait for AI nudge copy; after this, use local fallback so Scan/Debit PIN flow stays snappy. */
const NUDGE_AI_TIMEOUT_MS = 750;

function fmtRm(n: number): string {
  return `RM${n.toFixed(2)}`;
}

function fallbackNudge(context: NudgeRiskContext, evaluation: NudgeEvaluation): string {
  const amount = fmtRm(context.amount);
  const topCat = context.topSpendingCategory || "others";
  const flexi = context.cardType === "flexicard";
  const remaining = Math.round((context.availableBalance - context.amount) * 100) / 100;
  const emerg =
    typeof context.emergencyPocketBalance === "number"
      ? ` Your Emergency pocket is about ${fmtRm(context.emergencyPocketBalance)}.`
      : "";
  const flexiDebt =
    typeof context.flexiCreditBorrowingOutstanding === "number" && context.flexiCreditBorrowingOutstanding > 0
      ? ` FlexiCredit borrowing outstanding is about ${fmtRm(context.flexiCreditBorrowingOutstanding)}.`
      : "";

  if (evaluation.riskLevel === "critical") {
    return polishAiOutput(
      `This ${amount} ${context.actionType.replace(/_/g, " ")} would leave about ${fmtRm(Math.max(0, remaining))} after you pay, measured against the balance SmartGX used for this check. Your GXHealth is ${context.gxHealthScore}.${emerg}${flexiDebt}${
        flexi ? " Paying on Credit adds repayment pressure on top of normal bills." : ""
      } Cancelling, delaying, or using Save Instead protects your buffer for essentials.`
    );
  }
  if (flexi) {
    return polishAiOutput(
      `You are about to charge ${amount} on Credit. GXHealth is ${context.gxHealthScore} and ${topCat} is already one of your heavier categories this month.${emerg} If you can cover it from Main on Debit, that avoids adding to next month’s repayment pile.`
    );
  }
  if (evaluation.reasonCodes.includes("amount_over_25pct_available")) {
    return polishAiOutput(
      `This ${amount} payment uses more than a quarter of the available balance SmartGX is using here, leaving about ${fmtRm(Math.max(0, remaining))}. That can shrink room for food, transport, and bills later this week.${emerg}`
    );
  }
  if (evaluation.reasonCodes.includes("category_pressure")) {
    return polishAiOutput(
      `${topCat} is already taking a large share of your month-to-date spend. Adding ${amount} on top may tighten the rest of the month unless you slow that category for a few days.${emerg}`
    );
  }
  return polishAiOutput(
    `Before you confirm ${amount}, check that it matches your plan for this week. Main-style balance after this move is about ${fmtRm(Math.max(0, remaining))}.${emerg}`
  );
}

function nudgeAiPayload(context: NudgeRiskContext, evaluation: NudgeEvaluation): Record<string, unknown> {
  const remainingAfter = Math.round((context.availableBalance - context.amount) * 100) / 100;
  return {
    riskLevel: evaluation.riskLevel,
    reasonCodes: evaluation.reasonCodes,
    actionType: context.actionType,
    amountRm: context.amount,
    merchant: context.merchant,
    category: context.category,
    paymentMethod: context.paymentMethod,
    gxHealthScore: context.gxHealthScore,
    cardType: context.cardType,
    topSpendingCategory: context.topSpendingCategory,
    availableBalance: context.availableBalance,
    currentMainBalance: context.currentBalance,
    monthlyIncome: context.monthlyIncome,
    monthlyExpense: context.monthlyExpense,
    top3ExpenseCategories: context.top3ExpenseCategories,
    emergencyPocketBalance: context.emergencyPocketBalance,
    flexiCreditBorrowingOutstanding: context.flexiCreditBorrowingOutstanding,
    flexiCreditMonthlyRepayment: context.flexiCreditMonthlyRepayment,
    totalSavingsPockets: context.savingsBalance,
    remainingAfterPayment: remainingAfter,
    recommendSaveInstead: evaluation.recommendSaveInstead,
    recommendUseDebitInstead: evaluation.recommendUseDebitInstead,
    categorySpendThisMonth: context.categorySpending,
    flexiCardLimit: context.flexiCardLimit,
    flexiCardUsed: context.flexiCardUsed,
    bonusPocketBalance: context.bonusPocketBalance,
    goalsPocketBalance: context.goalsPocketBalance,
    gxHealthFactorScores: context.gxHealthFactorScores,
    transactionDescription: context.transactionDescription ?? null,
    monthSpendProjection: context.monthSpendProjection ?? null,
  };
}

function transactionDescriptor(context: NudgeRiskContext): string {
  const cat = context.category ?? "this payment";
  const mer = (context.merchant ?? "").trim();
  const desc = (context.transactionDescription ?? "").trim();
  if (mer && desc) return `${cat} (${mer}). Reference: ${desc}`;
  if (mer) return `${cat} (${mer})`;
  if (desc) return `${cat}. Reference: ${desc}`;
  return String(cat);
}

function buildCriticalRiskGeminiContext(
  reason: string,
  context: NudgeRiskContext,
  evaluation: NudgeEvaluation,
  safetyAlignment: Pick<ReasonAnalysisResult, "recommendation" | "fraudRisk" | "canContinue">
): Record<string, unknown> {
  const remainingAfter = Math.round((context.availableBalance - context.amount) * 100) / 100;
  return {
    ...nudgeAiPayload(context, evaluation),
    riskLevel: evaluation.riskLevel,
    userReason: reason.slice(0, 2000),
    transaction: {
      amountRm: context.amount,
      actionType: context.actionType,
      paymentMethod: context.paymentMethod,
      category: context.category ?? "others",
      merchant: context.merchant ?? null,
      descriptor: transactionDescriptor(context),
    },
    balances: {
      mainAccountBefore: context.currentBalance,
      availableForThisCheck: context.availableBalance,
      projectedAfterPayment: remainingAfter,
      bonusPocket: context.bonusPocketBalance,
      emergencyPocket: context.emergencyPocketBalance,
      goalsPocket: context.goalsPocketBalance,
      totalSavingsPockets: context.savingsBalance,
    },
    monthCashflow: {
      monthlyIncome: context.monthlyIncome,
      monthlyExpenses: context.monthlyExpense,
    },
    gxHealthScore: context.gxHealthScore,
    gxHealthFactorScores: context.gxHealthFactorScores ?? null,
    flexiCreditOutstanding: context.flexiCreditBorrowingOutstanding ?? null,
    flexiMonthlyRepayment: context.flexiCreditMonthlyRepayment ?? null,
    recentTransactionsSample: (context.recentTransactions ?? []).slice(0, 6).map((t) => ({
      amount: t.amount,
      category: t.category,
      merchant: t.merchant,
      type: t.type,
      note: t.note ?? null,
    })),
    monthSpendProjection: context.monthSpendProjection ?? null,
    transactionDescription: context.transactionDescription ?? null,
    safetyAlignment,
  };
}

export async function generateAiNudge(context: NudgeRiskContext, evaluation: NudgeEvaluation): Promise<string> {
  const config = getAiConfig();
  if (!config.enabled) return fallbackNudge(context, evaluation);

  try {
    const payload = nudgeAiPayload(context, evaluation);
    const prompt = [
      evaluation.riskLevel === "critical"
        ? "Write a stronger SmartGX critical-risk nudge (max 4 short sentences). Name the most serious cashflow or debt issue using the numbers in context."
        : "Write a SmartGX high-risk payment nudge (max 4 short sentences). Explain why continuing may hurt Main balance, Emergency, or repayments using context.",
      "Mention RM amounts from context. Suggest Save Instead or Debit when recommendSaveInstead or recommendUseDebitInstead is true.",
      SMARTGX_AI_WRITING_RULES,
      "Plain text only. No JSON.",
    ].join(" ");

    const aiPromise = callSmartGxAi("smart_ai_nudge", prompt, payload, config);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), NUDGE_AI_TIMEOUT_MS));
    const res = await Promise.race([aiPromise, timeoutPromise]);
    if (res?.success && res.content.trim()) return polishAiOutput(res.content.trim().slice(0, 900));
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
    const geminiContext = buildCriticalRiskGeminiContext(reason, context, evaluation, {
      recommendation: local.recommendation,
      fraudRisk: local.fraudRisk,
      canContinue: local.canContinue,
    });

    const res = await callSmartGxAi(
      "critical_risk_nudge",
      [
        "You are SmartGX Critical Risk analysis. Use ONLY context.transaction, context.balances, context.userReason, context.monthCashflow, context.monthSpendProjection, context.transactionDescription, context.gxHealthFactorScores, and context.recentTransactionsSample.",
        "Return JSON only with keys: necessity, urgency, impulseRisk, fraudRisk, cashflowConcern (each low|medium|high),",
        "recommendation (allow|delay|block|use_debit|save_instead|reduce_amount), explanation (string), saferAlternative (string), canContinue (boolean).",
        "",
        "NECESSITY EVALUATION (this is the most important dimension):",
        "Read context.userReason carefully and classify what kind of expense it is.",
        "Accommodation (rent, hostel, deposit), tuition/school/semester fees, medical/hospital, utilities, groceries, insurance, loan repayment, and family support are HIGH necessity.",
        "Food and dining out, transport, and moderate personal care are MEDIUM necessity.",
        "Shopping, gadgets, gaming, entertainment, luxury, gifts, and wants are LOW necessity.",
        "If unsure, lean toward MEDIUM and say why in the explanation.",
        "Do NOT default necessity to Medium for clearly essential expenses like hostel fees, rent, tuition, or medical.",
        "",
        "The explanation must:",
        "1. Name the user's reason (e.g. hostel fee, rent, tuition) and evaluate whether it is essential, time-sensitive, or discretionary.",
        "2. State the RM amount and projected remaining balance after payment.",
        "3. Mention Emergency buffer adequacy.",
        "4. Explain why the recommendation was chosen for THIS specific reason.",
        "5. If the expense is necessary but cashflow is tight, recommend continuing with caution rather than Save Instead.",
        "6. Only recommend Save Instead strongly for non-essential or impulse spending.",
        "",
        "Never mention laptops, phones, or gadgets unless userReason or transaction.category clearly indicates them.",
        "Tie risk to Emergency balance, Main after payment, month cashflow, FlexiCredit pressure, or GXHealth when those numbers exist. If data is missing, say what is missing in one short phrase then continue with available facts.",
        "Be conservative on fraud. Do not contradict context.safetyAlignment.recommendation with a weaker safety stance.",
        SMARTGX_AI_WRITING_RULES,
      ].join(" "),
      {
        riskScore,
        riskLevel: evaluation.riskLevel,
        remainingBalance,
        ...geminiContext,
      },
      config
    );

    if (!res?.success || !res.content.trim()) return null;

    const parsed =
      Object.keys(res.structured).length > 0 ? tryParseReasonAnalysisJson(JSON.stringify(res.structured)) : null;
    return parsed ?? tryParseReasonAnalysisJson(res.content);
  } catch {
    return null;
  }
}

const STRONG_REASONS = [
  "rent",
  "hostel",
  "accommodation",
  "housing",
  "deposit",
  "tuition",
  "school fee",
  "college fee",
  "university fee",
  "semester fee",
  "medical",
  "hospital",
  "clinic",
  "pharmacy",
  "emergency",
  "bill",
  "utilities",
  "electric",
  "water bill",
  "internet bill",
  "phone bill",
  "insurance",
  "loan repayment",
  "own account",
  "transfer to my bank",
  "family support",
  "groceries",
  "food supply",
  "childcare",
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
    const afterBal = fmtRm(Math.max(0, context.availableBalance - context.amount));
    const emergNote = typeof context.emergencyPocketBalance === "number"
      ? ` Your Emergency pocket is ${fmtRm(context.emergencyPocketBalance)}.`
      : "";
    return {
      necessity: "high",
      urgency,
      impulseRisk: "low",
      fraudRisk: "low",
      cashflowConcern,
      recommendation: severeCashflow ? "reduce_amount" : "allow",
      canContinue: true,
      explanation: severeCashflow
        ? `Your reason ("${reason.trim().slice(0, 80)}") points to a necessary expense. Paying ${fmtRm(context.amount)} would leave about ${afterBal}.${emergNote} SmartGX allows you to continue, but this puts high pressure on your cashflow. Confirm carefully or consider a partial payment.`
        : `Your reason ("${reason.trim().slice(0, 80)}") points to a necessary expense. SmartGX allows you to continue after confirmation.`,
      saferAlternative: severeCashflow
        ? "Try a smaller amount first and complete the remaining payment later."
        : "Proceed with confirmation and passcode verification.",
    };
  }

  if (strongHit && cashScore >= 3) {
    const afterBal = fmtRm(Math.max(0, context.availableBalance - context.amount));
    const emergNote = typeof context.emergencyPocketBalance === "number"
      ? ` Emergency pocket is ${fmtRm(context.emergencyPocketBalance)}.`
      : "";
    return {
      necessity: "high",
      urgency,
      impulseRisk,
      fraudRisk: "low",
      cashflowConcern: "high",
      recommendation: "delay",
      canContinue: false,
      explanation: `Your reason ("${reason.trim().slice(0, 80)}") looks like necessary spending, but paying ${fmtRm(context.amount)} leaves about ${afterBal} available.${emergNote} Consider delaying part of the payment or reducing the amount if the due date is not immediate.`,
      saferAlternative: "Try a smaller amount or split this payment.",
    };
  }

  if (weakHit || impulseScore >= 2) {
    if (flexiWithDebitOption && impulseScore >= 2) {
      const tx = transactionDescriptor(context);
      return {
        necessity,
        urgency,
        impulseRisk,
        fraudRisk: "low",
        cashflowConcern,
        recommendation: "use_debit",
        canContinue: false,
        explanation: `This payment pattern looks like flexible spend for ${tx} at ${fmtRm(
          context.amount
        )}. You have enough debit balance, so SmartGX recommends Debit instead of Credit, or delaying until you have saved for it.`,
        saferAlternative: "Use Debit Instead or Save Instead.",
      };
    }

    const highCash = cashflowConcern === "high" || cashScore >= 3;
    const tx = transactionDescriptor(context);
    const after = fmtRm(Math.max(0, context.availableBalance - context.amount));
    return {
      necessity,
      urgency,
      impulseRisk,
      fraudRisk: "low",
      cashflowConcern,
      recommendation: highCash ? "save_instead" : "delay",
      canContinue: false,
      explanation: `Your note points to flexible spending around ${tx} for ${fmtRm(context.amount)}. After this move, the balance SmartGX is using for this check would be about ${after}. That is tight for essentials unless you delay, reduce the amount, or use Save Instead.`,
      saferAlternative: highCash ? "Save Instead or try a smaller amount." : "Delay and review GXHealth.",
    };
  }

  const txd = transactionDescriptor(context);
  const afterBal = fmtRm(Math.max(0, context.availableBalance - context.amount));
  return {
    necessity,
    urgency,
    impulseRisk,
    fraudRisk: "low",
    cashflowConcern,
    recommendation: cashScore >= 3 ? "save_instead" : "delay",
    canContinue: false,
    explanation: `Your reason ("${reason.trim().slice(0, 60)}") did not match an urgent bill pattern for this ${txd} of ${fmtRm(context.amount)}. After paying, available balance is about ${afterBal}. Consider verifying urgency, trying a smaller amount, or Save Instead if cashflow is tight.`,
    saferAlternative: cashScore >= 3 ? "Save Instead." : "Try a smaller amount.",
  };
}

function polishReasonResult(r: ReasonAnalysisResult): ReasonAnalysisResult {
  return {
    ...r,
    explanation: polishAiOutput(r.explanation),
    saferAlternative: polishAiOutput(r.saferAlternative),
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
  if (remote) return polishReasonResult(remote);
  return polishReasonResult(localAnalyzeCriticalReason(reason, context, evaluation));
}
