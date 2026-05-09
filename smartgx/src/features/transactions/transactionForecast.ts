function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ForecastCashflowRisk = "low" | "medium" | "high";
export type ForecastDebtPressure = "low" | "medium" | "high";

export interface MonthSpendForecastInput {
  reference?: Date;
  monthToDateIncome: number;
  monthToDateExpense: number;
  mainAccountBalance: number;
  /** FlexiCredit outstanding / used (module), optional */
  flexiCreditOutstanding?: number;
  /** TapPay / card credit used (account store), optional */
  flexiCardUsed?: number;
  /** Next repayment amount if known */
  upcomingRepayment?: number;
}

export interface MonthSpendForecastResult {
  daysPassedInMonth: number;
  daysRemainingInMonth: number;
  averageDailyExpense: number;
  projectedAdditionalExpense: number;
  projectedMonthEndExpense: number;
  projectedMonthEndBalance: number;
  projectedNetCashflow: number;
  cashflowRisk: ForecastCashflowRisk;
  debtPressure: ForecastDebtPressure;
  cashflowRiskMessage: string;
  debtPressureNote: string;
}

function daysPassedInMonth(d: Date): number {
  return d.getDate();
}

function daysRemainingInMonth(d: Date): number {
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.max(0, lastDay - d.getDate());
}

export function computeMonthSpendForecast(input: MonthSpendForecastInput): MonthSpendForecastResult {
  const ref = input.reference ?? new Date();
  const daysPassed = Math.max(1, daysPassedInMonth(ref));
  const daysRemaining = daysRemainingInMonth(ref);

  const mti = round2(input.monthToDateIncome);
  const mte = round2(input.monthToDateExpense);
  const mainBal = round2(input.mainAccountBalance);

  const averageDailyExpense = round2(mte / Math.max(daysPassed, 1));
  const projectedAdditionalExpense = round2(averageDailyExpense * daysRemaining);
  const projectedMonthEndExpense = round2(mte + projectedAdditionalExpense);
  const projectedMonthEndBalance = round2(mainBal - projectedAdditionalExpense);
  const projectedNetCashflow = round2(mti - projectedMonthEndExpense);

  const flexiOut = round2(input.flexiCreditOutstanding ?? 0);
  const cardUsed = round2(input.flexiCardUsed ?? 0);
  const hasCreditExposure = flexiOut > 0 || cardUsed > 0;
  const upcoming = round2(input.upcomingRepayment ?? 0);

  let cashflowRisk: ForecastCashflowRisk = "low";
  let cashflowRiskMessage =
    "At your current daily spend pace, your Main Account buffer into month-end looks comfortable.";

  if (projectedMonthEndBalance < 0) {
    cashflowRisk = "high";
    cashflowRiskMessage =
      "At this pace, your Main Account may not cover remaining month spending — you could run short before month-end.";
  } else if (projectedMonthEndBalance < 100) {
    cashflowRisk = "high";
    cashflowRiskMessage =
      "Projected Main Account balance before month-end is very thin (under RM100) at the current spending pace.";
  } else if (projectedMonthEndBalance < 200) {
    cashflowRisk = "medium";
    cashflowRiskMessage =
      "Projected Main Account buffer is low (under RM200) if daily spending stays at the current average.";
  } else if (projectedNetCashflow < 0 && mti > 0) {
    cashflowRisk = "medium";
    cashflowRiskMessage =
      "Full-month spending at this pace may exceed recognised income for the month — net cashflow could tighten.";
  }

  let debtPressure: ForecastDebtPressure = "low";
  let debtPressureNote = "No strong signal of rising debt pressure from credit usage in this snapshot.";

  if (hasCreditExposure && projectedMonthEndBalance < 200) {
    debtPressure = projectedMonthEndBalance < 0 ? "high" : "medium";
    debtPressureNote =
      "With Credit/Flexi exposure already on file, a thin Main Account increases the chance you lean on credit for everyday spend.";
  } else if (hasCreditExposure && upcoming > 0 && projectedMonthEndBalance < projectedAdditionalExpense * 0.5) {
    debtPressure = "medium";
    debtPressureNote =
      "An upcoming repayment plus continued daily spend could squeeze cash unless you slow flexible categories.";
  } else if (hasCreditExposure && projectedMonthEndBalance >= 200) {
    debtPressure = "low";
    debtPressureNote =
      "You have some credit exposure, but your projected Main Account buffer still has room if the pace holds.";
  }

  return {
    daysPassedInMonth: daysPassed,
    daysRemainingInMonth: daysRemaining,
    averageDailyExpense,
    projectedAdditionalExpense,
    projectedMonthEndExpense,
    projectedMonthEndBalance,
    projectedNetCashflow,
    cashflowRisk,
    debtPressure,
    cashflowRiskMessage,
    debtPressureNote,
  };
}
