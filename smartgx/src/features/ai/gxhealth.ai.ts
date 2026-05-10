import type { HealthFactor, HealthInput, HealthStatus } from "../health/health.types";
import { callSmartGxAi } from "../../services/ai/ai.client";
import { getAiConfig } from "../../services/ai/ai.config";
import { sanitizeAiCurrencyToRM } from "../../lib/aiText";
import { userHasPinSet } from "../../store/securityStore";
import type { GxHealthAiContextPayload } from "./gxhealthContext.builder";
import type {
  GXHealthActionType,
  GXHealthRecommendedAction,
  GXHealthStructuredAnalysis,
} from "./gxhealth.ai.types";

export type { GXHealthActionType, GXHealthRecommendedAction, GXHealthStructuredAnalysis } from "./gxhealth.ai.types";

export interface GXHealthAnalysisContext {
  score: number;
  displayScore: number;
  status: HealthStatus;
  factors: HealthFactor[];
  input: HealthInput;
  extended: GxHealthAiContextPayload;
}

export interface GXHealthAnalysisResult {
  /** Short summary for dashboard / hero */
  summaryAnalysis: string;
  /** Longer multiline block when structured parsing fails */
  aiBodyMultiline: string;
  keyReason: string;
  positiveBehaviour: string;
  riskBehaviour: string;
  recommendedActions: string[];
  structured: GXHealthStructuredAnalysis | null;
  tone: "positive" | "cautious" | "warning";
}

const ACTION_TYPES: GXHealthActionType[] = [
  "saving",
  "spending",
  "credit",
  "security",
  "cashflow",
  "repayment",
];

function parseActionType(v: unknown): GXHealthActionType {
  return typeof v === "string" && ACTION_TYPES.includes(v as GXHealthActionType)
    ? (v as GXHealthActionType)
    : "cashflow";
}

function clampMoveToMain(main: number, want: number, minBuffer = 50): number {
  const cap = Math.max(0, main - minBuffer);
  return Math.min(Math.max(0, want), cap);
}

function formatRm(n: number): string {
  const rounded = Math.round(n);
  return rounded >= 1000 ? `RM${rounded.toLocaleString("en-MY")}` : `RM${rounded}`;
}

export function buildGXHealthPrompt(_context: GxHealthAiContextPayload): string {
  return [
    "You are SmartGX AI, a financial behaviour assistant for Malaysian youth.",
    "Analyze the user's real-time financial behaviour using the JSON context only.",
    "Be specific, practical, and reference actual numbers and categories from context.",
    "CRITICAL: Distinguish Savings vs Emergency. The Savings factor is general (non-emergency) discipline: Bonus + Goals behaviour, flows into those pockets, allocation, round-up, streak, withdrawals from Bonus/Goals. The Emergency factor is emergency buffer strength (balance vs emergencyTargetRm and adequacyVsOneMonthTarget). Total account.totalSavings includes Bonus+Emergency+Goals, but you must NOT treat a rising Emergency balance as proof of stronger 'Savings' discipline — cite Emergency under the Emergency factor instead.",
    "You may contrast them in prose, e.g. Bonus/Goals growing while Emergency is thin, or Emergency healthy while Bonus/Goals contributions are weak this month.",
    "Explain WHY the GXHealth score is where it is, using all five healthFactors: Savings (non-emergency discipline), Spending, Emergency (buffer vs target), Debt Risk (FlexiCredit outstanding, limits, repayment due, overdue drawdowns), and Security (securityScore, PIN, device safety, scam protection, emergency lock).",
    "If security.pinConfigured is true in context, do NOT recommend setting up a 6-digit PIN.",
    "Use Malaysian Ringgit format only. Write amounts as RM100, RM1,200, or RM5,000.",
    "Never use $, USD, dollars, or word 'cents' for currency unless the user explicitly asked.",
    "Do not claim to be a licensed financial adviser; stay supportive and clear.",
    "Do not recommend saving more than Main Account can afford after a RM50 buffer.",
    "Do not recommend repaying more than flexiCreditOutstanding.",
    "Do not suggest borrowing to fix overspending.",
    "Output ONE JSON object only (no markdown code fences). Keys:",
    '"summary" (string, 2–3 sentences),',
    '"scoreExplanation" (string, 2–4 sentences tying score to savings, spend categories, cashflow, credit),',
    '"positiveSignals" (array of 2–4 short strings),',
    '"riskSignals" (array of 2–4 short strings),',
    '"recommendedActions" (array of 3–5 objects: title, reason, impact, actionType),',
    'actionType must be one of: "saving"|"spending"|"credit"|"security"|"cashflow"|"repayment",',
    '"priorityAction" (one concrete sentence),',
    '"confidence" ("low"|"medium"|"high").',
  ].join(" ");
}

function tryParseGxHealthStructured(
  content: string,
  structured: Record<string, unknown>
): GXHealthStructuredAnalysis | null {
  const fromObj = (j: Record<string, unknown>): GXHealthStructuredAnalysis | null => {
    const summary = typeof j.summary === "string" ? j.summary.trim() : "";
    const scoreExplanation = typeof j.scoreExplanation === "string" ? j.scoreExplanation.trim() : "";
    if (!summary || !scoreExplanation) return null;

    const positiveSignals = Array.isArray(j.positiveSignals)
      ? (j.positiveSignals as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
      : [];
    const riskSignals = Array.isArray(j.riskSignals)
      ? (j.riskSignals as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
      : [];

    const rawRec = Array.isArray(j.recommendedActions) ? j.recommendedActions : [];
    const recommendedActions: GXHealthRecommendedAction[] = [];
    for (const item of rawRec) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title.trim() : "";
      const reason = typeof o.reason === "string" ? o.reason.trim() : "";
      if (!title) continue;
      recommendedActions.push({
        title,
        reason: reason || title,
        impact: typeof o.impact === "string" ? o.impact.trim() : "",
        actionType: parseActionType(o.actionType),
      });
    }

    const priorityAction = typeof j.priorityAction === "string" ? j.priorityAction.trim() : "";
    const confRaw = j.confidence;
    const confidence =
      confRaw === "low" || confRaw === "medium" || confRaw === "high" ? confRaw : "medium";

    return {
      summary: sanitizeAiCurrencyToRM(summary),
      scoreExplanation: sanitizeAiCurrencyToRM(scoreExplanation),
      positiveSignals: positiveSignals.map(sanitizeAiCurrencyToRM),
      riskSignals: riskSignals.map(sanitizeAiCurrencyToRM),
      recommendedActions: recommendedActions.map((a) => ({
        ...a,
        title: sanitizeAiCurrencyToRM(a.title),
        reason: sanitizeAiCurrencyToRM(a.reason),
        impact: sanitizeAiCurrencyToRM(a.impact),
      })),
      priorityAction: sanitizeAiCurrencyToRM(priorityAction),
      confidence,
    };
  };

  if (structured && typeof structured.summary === "string" && typeof structured.scoreExplanation === "string") {
    const parsed = fromObj(structured);
    if (parsed) return parsed;
  }

  try {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]) as Record<string, unknown>;
    return fromObj(j);
  } catch {
    return null;
  }
}

function isPinSetupRecommendationText(text: string): boolean {
  const t = text.toLowerCase();
  return (
    (t.includes("6") && t.includes("digit") && t.includes("pin") && (t.includes("set up") || t.includes("setup"))) ||
    /set\s+up\s+your\s+6[\s-]*digit\s+pin/.test(t)
  );
}

function stripPinSetupRecommendationsIfConfigured(
  result: GXHealthAnalysisResult,
  pinConfigured: boolean
): GXHealthAnalysisResult {
  if (!pinConfigured) return result;
  const keepAction = (a: GXHealthRecommendedAction) =>
    !(a.actionType === "security" && isPinSetupRecommendationText(`${a.title} ${a.reason}`));

  const structured = result.structured
    ? {
        ...result.structured,
        recommendedActions: result.structured.recommendedActions.filter(keepAction),
      }
    : null;

  const fromStructured =
    structured && structured.recommendedActions.length > 0
      ? structured.recommendedActions.map((a) =>
          a.reason && a.reason !== a.title ? `${a.title} — ${a.reason}` : a.title
        )
      : null;

  const recommendedActions = (fromStructured ?? result.recommendedActions).filter(
    (line) => !isPinSetupRecommendationText(line)
  );

  return {
    ...result,
    structured,
    recommendedActions: recommendedActions.length > 0 ? recommendedActions : result.recommendedActions.filter(
      (line) => !isPinSetupRecommendationText(line)
    ),
  };
}

function structuredToFallbackStrings(
  s: GXHealthStructuredAnalysis,
  tone: GXHealthAnalysisResult["tone"]
): GXHealthAnalysisResult {
  const recommendedActions = s.recommendedActions.map((a) =>
    a.reason && a.reason !== a.title ? `${a.title} — ${a.reason}` : a.title
  );
  return {
    summaryAnalysis: s.summary,
    aiBodyMultiline: [s.summary, "", s.scoreExplanation].join("\n"),
    keyReason: s.scoreExplanation.split(".")[0] ?? s.scoreExplanation,
    positiveBehaviour: s.positiveSignals[0] ?? "Your profile shows at least one supportive habit in the data.",
    riskBehaviour: s.riskSignals[0] ?? "Monitor spending pace against income for the rest of the month.",
    recommendedActions: recommendedActions.length > 0 ? recommendedActions : [s.priorityAction].filter(Boolean),
    structured: s,
    tone,
  };
}

/** Rule-based narrative — single source of truth for scores; used when Gemini is off or fails. */
export function gxHealthAnalysisFallback(context: GXHealthAnalysisContext): GXHealthAnalysisResult {
  const { displayScore, factors, input, extended } = context;
  const tone: GXHealthAnalysisResult["tone"] =
    displayScore >= 75 ? "positive" : displayScore >= 50 ? "cautious" : "warning";

  const sorted = [...factors].sort((a, b) => a.score - b.score);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];
  const topFactorLabel = weakest?.label ?? "overall behaviour";
  const main = extended.account.mainBalance;
  const cashflow = extended.monthlyOverview.netCashflow;
  const topCat = extended.spending.top3Categories[0];
  const secondCat = extended.spending.top3Categories[1];
  const debtUsed = extended.credit.flexiCreditOutstanding + extended.credit.flexiCardUsed;
  const secCtx = extended.security;

  const positiveSignals: string[] = [];
  if (extended.savingsBehaviour.savingStreakDays >= 3) {
    positiveSignals.push(
      `You are on a ${extended.savingsBehaviour.savingStreakDays}-day saving streak — consistency helps GXHealth.`
    );
  }
  const emergMo = extended.emergencyBuffer?.monthsOfSpendCovered ?? 0;
  const emergRm = extended.emergencyBuffer?.emergencyBalanceRm ?? extended.account.emergency;
  if (emergRm > 0 && emergMo >= 2) {
    positiveSignals.push(
      `Emergency pocket is about ${formatRm(emergRm)} (~${emergMo.toFixed(1)} months of spend covered) — a solid GXHealth buffer.`
    );
  } else if (extended.account.emergency >= extended.monthlyOverview.totalExpensesThisMonth * 0.2 && extended.account.emergency > 0) {
    positiveSignals.push(
      `Emergency pocket holds ${formatRm(extended.account.emergency)}, which adds buffer against shocks.`
    );
  }
  if (extended.savingsBehaviour.latestAutoAllocationAmount && extended.savingsBehaviour.latestAutoAllocationAmount > 0) {
    positiveSignals.push(
      `Recent auto allocation moved ${formatRm(extended.savingsBehaviour.latestAutoAllocationAmount)} into pockets — that supports discipline.`
    );
  }
  if (cashflow >= 0 && extended.monthlyOverview.totalIncomeThisMonth > 0) {
    positiveSignals.push(
      `Month-to-date net cashflow is ${formatRm(cashflow)} with income of ${formatRm(extended.monthlyOverview.totalIncomeThisMonth)}.`
    );
  }
  if (secCtx.securityScore >= 80) {
    positiveSignals.push(`Security Score ${secCtx.securityScore} — account protection is helping GXHealth.`);
  }
  if (positiveSignals.length === 0) {
    positiveSignals.push(`${strongest?.label ?? "Savings"} is currently your strongest GXHealth factor (${strongest?.statusLabel ?? "ok"}).`);
  }

  const riskSignals: string[] = [];
  if (topCat) {
    riskSignals.push(
      `${topCat.name} leads spending at ${formatRm(topCat.amount)}${
        secondCat ? `, followed by ${secondCat.name} at ${formatRm(secondCat.amount)}` : ""
      }.`
    );
  }
  if (input.recentSpendTrend === "increasing") {
    riskSignals.push("Weekly spending pace is rising versus earlier in the month.");
  }
  if (debtUsed > 0 || extended.credit.flexiOverdueDrawdowns > 0) {
    riskSignals.push(
      `FlexiCredit outstanding about ${formatRm(extended.credit.flexiCreditOutstanding)} on approved ${formatRm(extended.credit.flexiCreditApprovedLimit)}; monthly due ${formatRm(extended.credit.monthlyRepayment)}; card used ${formatRm(extended.credit.flexiCardUsed)}${
        extended.credit.flexiOverdueDrawdowns > 0 ? `; ${extended.credit.flexiOverdueDrawdowns} overdue drawdown(s)` : ""
      }.`
    );
  }
  if (secCtx.securityScore < 70) {
    riskSignals.push(
      `Security Score is ${secCtx.securityScore} (${secCtx.pinConfigured ? "PIN set" : "PIN not set"}; device safety: ${secCtx.deviceSafetyStatus}; ${secCtx.scamProtectionSummary}).`
    );
  }
  if (main < extended.monthlyOverview.totalExpensesThisMonth * 0.15 && extended.monthlyOverview.totalExpensesThisMonth > 0) {
    riskSignals.push(
      `Main Account (${formatRm(main)}) is thin versus month spend (${formatRm(extended.monthlyOverview.totalExpensesThisMonth)}).`
    );
  }
  if (emergMo < 1 && emergRm >= 0 && extended.monthlyOverview.totalExpensesThisMonth > 0) {
    riskSignals.push(
      `Emergency buffer is thin at ${formatRm(emergRm)} (~${emergMo.toFixed(1)} months of expenses) versus typical spend — this drags the Emergency GXHealth factor.`
    );
  }
  if (extended.riskBehaviour.saveInsteadCountThisMonth === 0 && extended.spending.byCategory["Shopping"] > extended.account.mainBalance * 0.25) {
    riskSignals.push("Shopping is elevated and there were no Save Instead events this month in the snapshot.");
  }
  if (riskSignals.length === 0) {
    riskSignals.push(`Watch ${topFactorLabel.toLowerCase()} — it currently drags the score the most.`);
  }

  const recs: GXHealthRecommendedAction[] = [];
  const capEmergency = clampMoveToMain(main, 100);
  if (extended.account.emergency < extended.monthlyOverview.totalExpensesThisMonth && capEmergency >= 20) {
    recs.push({
      title: `Move ${formatRm(Math.min(capEmergency, 150))} from Main to Emergency this week`,
      reason: "Rebuild buffer so essentials are covered if spend stays high.",
      impact: "Raises emergency cover without emptying Main.",
      actionType: "saving",
    });
  }

  if (topCat && (topCat.name.toLowerCase().includes("food") || topCat.name.toLowerCase().includes("shopping"))) {
    const weekCap = Math.max(50, Math.round(topCat.amount / 4));
    recs.push({
      title: `Keep ${topCat.name} under ${formatRm(weekCap)} for the next 7 days`,
      reason: `${topCat.name} is your top category at ${formatRm(topCat.amount)}.`,
      impact: "Slows category pressure while income catches up.",
      actionType: "spending",
    });
  }

  if (debtUsed > 0 && displayScore < 75) {
    recs.push({
      title: "Pause non-essential Credit/TapPay until GXHealth is back above 75",
      reason: "New credit spend stacks on existing exposure and repayment dates.",
      impact: "Reduces rollover risk and keeps repayments predictable.",
      actionType: "credit",
    });
  }

  const maxRepay = extended.credit.flexiCreditOutstanding;
  if (!secCtx.pinConfigured) {
    recs.push({
      title: "Set up your 6-digit PIN before using high-risk money movement",
      reason: "PIN protects transfers, FlexiCredit, and sensitive actions.",
      impact: "Raises Security Score and GXHealth Security factor.",
      actionType: "security",
    });
  }
  if (secCtx.deviceSafetyStatus !== "safe") {
    recs.push({
      title: "Complete Device Safety Check in Security Center",
      reason: `Status is ${secCtx.deviceSafetyStatus} — unfinished checks pull down Security Score.`,
      impact: "Improves Security factor and overall GXHealth.",
      actionType: "security",
    });
  }
  if (secCtx.securityScore < 65 && secCtx.scamProtectionSummary.toLowerCase().includes("high")) {
    recs.push({
      title: "Review Scam Protection — recent checks flagged higher risk",
      reason: secCtx.scamProtectionSummary,
      impact: "Reduces security drag on GXHealth.",
      actionType: "security",
    });
  }

  if (maxRepay > 0 && main > 80) {
    const repay = clampMoveToMain(main, Math.min(maxRepay, Math.round(maxRepay * 0.15)), 40);
    if (repay >= 20) {
      recs.push({
        title: `Schedule ${formatRm(repay)} toward FlexiCredit if due soon`,
        reason: `Outstanding is about ${formatRm(maxRepay)}; partial pay-down protects cashflow.`,
        impact: "Lowers interest drag and debt ratio in GXHealth.",
        actionType: "repayment",
      });
    }
  }

  if (recs.length === 0) {
    recs.push({
      title: `Hold spending near ${formatRm(extended.spending.safeBudget)} for the rest of the month`,
      reason: `Safe spend budget from your rule is ${formatRm(extended.spending.safeBudget)}.`,
      impact: "Keeps GXHealth factors aligned with your income profile.",
      actionType: "cashflow",
    });
  }

  const summary = `Your GXHealth is ${Math.round(displayScore)} (${context.status}). Main Account is ${formatRm(main)} and total savings (Bonus + Emergency + Goals) are ${formatRm(extended.account.totalSavings)}.`;
  const scoreExplanation = `This score is mainly shaped by ${weakest?.label ?? "behaviour"} (${weakest?.statusLabel ?? "watch"}) versus ${strongest?.label ?? "other areas"}. Month-to-date spend is ${formatRm(extended.monthlyOverview.totalExpensesThisMonth)} against income ${formatRm(extended.monthlyOverview.totalIncomeThisMonth)}, so net cashflow is ${formatRm(cashflow)} with ${extended.monthlyOverview.daysRemainingInMonth} days left in the month.`;

  const structured: GXHealthStructuredAnalysis = {
    summary: sanitizeAiCurrencyToRM(summary),
    scoreExplanation: sanitizeAiCurrencyToRM(scoreExplanation),
    positiveSignals: positiveSignals.map(sanitizeAiCurrencyToRM),
    riskSignals: riskSignals.map(sanitizeAiCurrencyToRM),
    recommendedActions: recs.map((a) => ({
      ...a,
      title: sanitizeAiCurrencyToRM(a.title),
      reason: sanitizeAiCurrencyToRM(a.reason),
      impact: sanitizeAiCurrencyToRM(a.impact),
    })),
    priorityAction: sanitizeAiCurrencyToRM(recs[0]?.title ?? "Review top spending category and protect Main Account buffer this week."),
    confidence: "medium",
  };

  return stripPinSetupRecommendationsIfConfigured(structuredToFallbackStrings(structured, tone), secCtx.pinConfigured);
}

/**
 * Optional Gemini copy — does not change the numeric score (still from rules).
 * Returns null if proxy unavailable or request fails (caller keeps fallback text).
 */
export async function enrichGxHealthWithAi(context: GXHealthAnalysisContext): Promise<GXHealthAnalysisResult | null> {
  const config = getAiConfig();
  const base = gxHealthAnalysisFallback(context);
  const pinOk = userHasPinSet();
  if (!config.enabled) return null;

  try {
    const prompt = buildGXHealthPrompt(context.extended);
    const res = await callSmartGxAi("gxhealth", prompt, context.extended as unknown as Record<string, unknown>, config);

    if (!res?.success || !res.content.trim()) return null;

    const parsed = tryParseGxHealthStructured(res.content, res.structured ?? {});
    if (parsed) {
      const merged = structuredToFallbackStrings(parsed, base.tone);
      const withRecs = {
        ...merged,
        recommendedActions:
          merged.recommendedActions.length > 0 ? merged.recommendedActions : base.recommendedActions,
      };
      return stripPinSetupRecommendationsIfConfigured(withRecs, pinOk);
    }

    const plain = sanitizeAiCurrencyToRM(res.content.trim().slice(0, 2000));
    return stripPinSetupRecommendationsIfConfigured(
      {
        ...base,
        summaryAnalysis: plain.split("\n")[0] ?? plain,
        aiBodyMultiline: plain,
        structured: base.structured,
      },
      pinOk
    );
  } catch {
    return null;
  }
}
