import type { TransactionCategory } from "../../types/transaction";
import { callSmartGxAi } from "../../services/ai/ai.client";
import { getAiConfig } from "../../services/ai/ai.config";
import { sanitizeAiCurrencyToRM } from "../../lib/aiText";
import type { MonthSpendForecastResult } from "../transactions/transactionForecast";

export interface TransactionInsightRecentTxn {
  amount: number;
  category: string;
  type: string;
  date: string;
  paymentMethod: string;
  merchant: string;
}

export interface TransactionInsightContext {
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  expenseCategories: Record<TransactionCategory, number>;
  incomeCategories: Record<string, number>;
  topSpendingCategory: string;
  recurringSubscriptions: number;
  recurringSubscriptionTotal: number;
  recent7DaySpend: number;
  budgetStatus: "no_budget" | "within_budget" | "over_budget";
  hasCreditSpending: boolean;
  mainAccountBalance: number;
  totalSavings: number;
  gxHealthScore: number;
  forecast: MonthSpendForecastResult;
  top3ExpenseCategories: Array<{ label: string; amount: number }>;
  recentTransactions: TransactionInsightRecentTxn[];
  largeTransactions: TransactionInsightRecentTxn[];
  flexiCreditOutstanding: number;
  flexiCardUsed: number;
  flexiCardLimit: number;
  upcomingRepayment: number;
  daysRemainingInMonth: number;
}

export interface TransactionInsightAction {
  title: string;
  reason: string;
  suggestedAmount: string;
  timeframe: string;
}

export interface TransactionInsightStructured {
  summary: string;
  currentPattern: string;
  topDrivers: string[];
  monthEndForecast: {
    projectedExpense: string;
    projectedRemainingBalance: string;
    cashflowRisk: "low" | "medium" | "high";
    debtPressure: "low" | "medium" | "high";
  };
  riskExplanation: string;
  recommendedActions: TransactionInsightAction[];
  priorityAction: string;
}

export interface TransactionInsightResult {
  insightTitle: string;
  insightMessage: string;
  concernLevel: "low" | "medium" | "high";
  suggestedAction: string;
  categoriesMentioned: string[];
  /** Full structured insight when parsed */
  structured: TransactionInsightStructured | null;
  /** Multiline plain text for cards */
  displayBody: string;
}

function formatRmInt(n: number): string {
  const r = Math.round(n);
  return r >= 1000 ? `RM${r.toLocaleString("en-MY")}` : `RM${r}`;
}

function forecastConcern(ctx: TransactionInsightContext): TransactionInsightResult["concernLevel"] {
  if (ctx.forecast.cashflowRisk === "high" || ctx.netCashflow < 0) return "high";
  if (ctx.forecast.cashflowRisk === "medium" || ctx.forecast.debtPressure === "medium") return "medium";
  return "low";
}

function buildStructuredFallback(ctx: TransactionInsightContext): TransactionInsightStructured {
  const top = ctx.top3ExpenseCategories[0];
  const second = ctx.top3ExpenseCategories[1];
  const drivers: string[] = [];
  if (top) drivers.push(`${top.label} at ${formatRmInt(top.amount)}`);
  if (second) drivers.push(`${second.label} at ${formatRmInt(second.amount)}`);
  if (drivers.length === 0) drivers.push("Not enough category spread yet — keep logging expenses.");

  const fc = ctx.forecast;
  const monthEndForecast = {
    projectedExpense: formatRmInt(fc.projectedMonthEndExpense),
    projectedRemainingBalance: formatRmInt(fc.projectedMonthEndBalance),
    cashflowRisk: fc.cashflowRisk,
    debtPressure: fc.debtPressure,
  };

  const summary = `This month you spent ${formatRmInt(ctx.totalExpense)} against ${formatRmInt(ctx.totalIncome)} income, leaving about ${formatRmInt(ctx.netCashflow)} net cashflow so far. Main Account is ${formatRmInt(ctx.mainAccountBalance)}.`;
  const currentPattern = `Daily spend is averaging ${formatRmInt(fc.averageDailyExpense)} over ${fc.daysPassedInMonth} day(s) in the month. If that pace continues for ${fc.daysRemainingInMonth} more day(s), modelled extra spend is about ${formatRmInt(fc.projectedAdditionalExpense)}.`;
  const riskExplanation = `${fc.cashflowRiskMessage} ${fc.debtPressureNote}`;

  const actions: TransactionInsightAction[] = [];
  if (top) {
    const cap = Math.max(40, Math.round(top.amount / 4));
    actions.push({
      title: `Cap ${top.label} for 7 days`,
      reason: `${top.label} is the top driver at ${formatRmInt(top.amount)}.`,
      suggestedAmount: `Try staying under ${formatRmInt(cap)} this week`,
      timeframe: "Next 7 days",
    });
  }
  if (ctx.hasCreditSpending || ctx.flexiCardUsed > 0) {
    actions.push({
      title: "Prefer debit for non-essentials",
      reason: "Credit/TapPay use stacks on future repayments when cashflow tightens.",
      suggestedAmount: "RM0 extra credit",
      timeframe: "Until buffer improves",
    });
  }
  const move = Math.min(80, Math.max(0, ctx.mainAccountBalance - 100));
  if (move >= 20 && ctx.totalSavings < ctx.totalExpense) {
    actions.push({
      title: "Optional pocket transfer",
      reason: "Only if Main stays above RM100 after bills.",
      suggestedAmount: `Up to ${formatRmInt(move)} to Emergency`,
      timeframe: "This week",
    });
  }
  if (actions.length === 0) {
    actions.push({
      title: "Keep logging transactions",
      reason: "More history improves SmartGX category forecasts.",
      suggestedAmount: "—",
      timeframe: "Ongoing",
    });
  }

  return {
    summary: sanitizeAiCurrencyToRM(summary),
    currentPattern: sanitizeAiCurrencyToRM(currentPattern),
    topDrivers: drivers.map(sanitizeAiCurrencyToRM),
    monthEndForecast: {
      projectedExpense: sanitizeAiCurrencyToRM(monthEndForecast.projectedExpense),
      projectedRemainingBalance: sanitizeAiCurrencyToRM(monthEndForecast.projectedRemainingBalance),
      cashflowRisk: monthEndForecast.cashflowRisk,
      debtPressure: monthEndForecast.debtPressure,
    },
    riskExplanation: sanitizeAiCurrencyToRM(riskExplanation),
    recommendedActions: actions.map((a) => ({
      ...a,
      title: sanitizeAiCurrencyToRM(a.title),
      reason: sanitizeAiCurrencyToRM(a.reason),
      suggestedAmount: sanitizeAiCurrencyToRM(a.suggestedAmount),
      timeframe: sanitizeAiCurrencyToRM(a.timeframe),
    })),
    priorityAction: sanitizeAiCurrencyToRM(
      actions[0]
        ? `${actions[0].title}: ${actions[0].reason}`
        : "Review top categories and slow discretionary spend for one week."
    ),
  };
}

function structuredToDisplay(s: TransactionInsightStructured, title: string, concern: TransactionInsightResult["concernLevel"]): TransactionInsightResult {
  const bulletLines = s.recommendedActions
    .slice(0, 5)
    .map((a, i) => `${i + 1}. ${a.title}${a.suggestedAmount ? ` (${a.suggestedAmount})` : ""} — ${a.reason}`)
    .join("\n");

  const displayBody = [
    s.summary,
    "",
    s.currentPattern,
    "",
    `Top drivers: ${s.topDrivers.join("; ")}.`,
    "",
    `Month-end model (if pace continues): spend about ${s.monthEndForecast.projectedExpense}, Main Account around ${s.monthEndForecast.projectedRemainingBalance}. Cashflow risk: ${s.monthEndForecast.cashflowRisk}. Debt pressure: ${s.monthEndForecast.debtPressure}.`,
    "",
    s.riskExplanation,
    "",
    "Recommended this week:",
    bulletLines,
    "",
    `Priority: ${s.priorityAction}`,
  ].join("\n");

  return {
    insightTitle: title,
    insightMessage: s.summary,
    concernLevel: concern,
    suggestedAction: s.priorityAction,
    categoriesMentioned: s.topDrivers,
    structured: s,
    displayBody,
  };
}

function fallback(ctx: TransactionInsightContext): TransactionInsightResult {
  const concernLevel = forecastConcern(ctx);
  const insightTitle =
    concernLevel === "high"
      ? "SmartGX Cashflow Alert"
      : concernLevel === "medium"
        ? "SmartGX Spending Watch"
        : "SmartGX Healthy Pattern";
  const structured = buildStructuredFallback(ctx);
  return structuredToDisplay(structured, insightTitle, concernLevel);
}

export function buildTransactionInsightPrompt(_ctx: TransactionInsightContext): string {
  return [
    "You are SmartGX AI, a transaction and cashflow analyst for Malaysian youth.",
    "Use ONLY the JSON context, including pre-calculated forecast numbers — do not invent different arithmetic.",
    "Explain what is happening now, which categories drive spend, and what month-end may look like if the pace continues.",
    "Use Malaysian Ringgit format only: RM100, RM1,200, RM5,000. Never $, USD, or dollars.",
    "Output ONE JSON object only (no markdown fences). Keys:",
    '"summary" (2–3 sentences),',
    '"currentPattern" (2–3 sentences referencing averages),',
    '"topDrivers" (array of 2–4 strings with category + RM amounts),',
    '"monthEndForecast": { "projectedExpense", "projectedRemainingBalance" (strings with RM), "cashflowRisk", "debtPressure" }',
    "must match the context forecast cashflowRisk/debtPressure levels exactly,",
    '"riskExplanation" (2–3 sentences),',
    '"recommendedActions": [{ "title", "reason", "suggestedAmount", "timeframe" }], 3–5 items, practical for Malaysia,',
    '"priorityAction" (one sentence).',
    "Do not recommend borrowing to cover overspending.",
  ].join(" ");
}

function parseStructured(
  content: string,
  structured: Record<string, unknown>,
  ctx: TransactionInsightContext
): TransactionInsightStructured | null {
  const fc = ctx.forecast;
  const expectedRisk = fc.cashflowRisk;
  const expectedDebt = fc.debtPressure;

  const fromObj = (j: Record<string, unknown>): TransactionInsightStructured | null => {
    const summary = typeof j.summary === "string" ? j.summary.trim() : "";
    const currentPattern = typeof j.currentPattern === "string" ? j.currentPattern.trim() : "";
    if (!summary || !currentPattern) return null;
    const topDrivers = Array.isArray(j.topDrivers)
      ? (j.topDrivers as unknown[])
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
      : [];
    const mef = j.monthEndForecast;
    let monthEndForecast: TransactionInsightStructured["monthEndForecast"];
    if (mef && typeof mef === "object" && !Array.isArray(mef)) {
      const o = mef as Record<string, unknown>;
      monthEndForecast = {
        projectedExpense: typeof o.projectedExpense === "string" ? o.projectedExpense : formatRmInt(fc.projectedMonthEndExpense),
        projectedRemainingBalance:
          typeof o.projectedRemainingBalance === "string" ? o.projectedRemainingBalance : formatRmInt(fc.projectedMonthEndBalance),
        cashflowRisk: expectedRisk,
        debtPressure: expectedDebt,
      };
    } else {
      monthEndForecast = {
        projectedExpense: formatRmInt(fc.projectedMonthEndExpense),
        projectedRemainingBalance: formatRmInt(fc.projectedMonthEndBalance),
        cashflowRisk: expectedRisk,
        debtPressure: expectedDebt,
      };
    }
    monthEndForecast.cashflowRisk = expectedRisk;
    monthEndForecast.debtPressure = expectedDebt;

    const riskExplanation = typeof j.riskExplanation === "string" ? j.riskExplanation.trim() : "";
    const rawRec = Array.isArray(j.recommendedActions) ? j.recommendedActions : [];
    const recommendedActions: TransactionInsightAction[] = [];
    for (const item of rawRec) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title.trim() : "";
      if (!title) continue;
      recommendedActions.push({
        title,
        reason: typeof o.reason === "string" ? o.reason.trim() : "",
        suggestedAmount: typeof o.suggestedAmount === "string" ? o.suggestedAmount.trim() : "",
        timeframe: typeof o.timeframe === "string" ? o.timeframe.trim() : "",
      });
    }
    const priorityAction = typeof j.priorityAction === "string" ? j.priorityAction.trim() : "";

    return {
      summary: sanitizeAiCurrencyToRM(summary),
      currentPattern: sanitizeAiCurrencyToRM(currentPattern),
      topDrivers: topDrivers.map(sanitizeAiCurrencyToRM),
      monthEndForecast: {
        projectedExpense: sanitizeAiCurrencyToRM(monthEndForecast.projectedExpense),
        projectedRemainingBalance: sanitizeAiCurrencyToRM(monthEndForecast.projectedRemainingBalance),
        cashflowRisk: monthEndForecast.cashflowRisk,
        debtPressure: monthEndForecast.debtPressure,
      },
      riskExplanation: sanitizeAiCurrencyToRM(riskExplanation || ctx.forecast.cashflowRiskMessage),
      recommendedActions: recommendedActions.map((a) => ({
        ...a,
        title: sanitizeAiCurrencyToRM(a.title),
        reason: sanitizeAiCurrencyToRM(a.reason),
        suggestedAmount: sanitizeAiCurrencyToRM(a.suggestedAmount),
        timeframe: sanitizeAiCurrencyToRM(a.timeframe),
      })),
      priorityAction: sanitizeAiCurrencyToRM(priorityAction || recommendedActions[0]?.title || ""),
    };
  };

  if (structured && typeof structured.summary === "string") {
    const p = fromObj(structured);
    if (p) return p;
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

/** Rule-based insight — deterministic concern level and forecast binding. */
export function generateTransactionInsight(context: TransactionInsightContext): TransactionInsightResult {
  return fallback(context);
}

export async function enrichTransactionInsightWithGemini(ctx: TransactionInsightContext): Promise<TransactionInsightResult> {
  const base = fallback(ctx);
  const cfg = getAiConfig();
  if (!cfg.enabled) return base;

  try {
    const prompt = buildTransactionInsightPrompt(ctx);
    const res = await callSmartGxAi("transaction_insight", prompt, ctx as unknown as Record<string, unknown>, cfg);
    if (!res?.success || !res.content.trim()) return base;

    const parsed = parseStructured(res.content, res.structured ?? {}, ctx);
    if (parsed) {
      return structuredToDisplay(parsed, base.insightTitle, base.concernLevel);
    }

    const plain = sanitizeAiCurrencyToRM(res.content.trim().slice(0, 2500));
    return {
      ...base,
      insightMessage: plain.split("\n")[0] ?? plain,
      displayBody: plain,
      structured: base.structured,
    };
  } catch {
    return base;
  }
}
