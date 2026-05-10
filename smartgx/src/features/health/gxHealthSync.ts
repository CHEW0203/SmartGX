/**
 * Synchronous GXHealth score for stores (matches useHealthData core calculation, without AI enrichment).
 */
import { useTransactionStore } from "../../store/transactionStore";
import { useSavingsStore } from "../../store/savingsStore";
import { useAccountStore } from "../../store/accountStore";
import { useFlexiCreditStore } from "../../store/flexiCreditStore";
import { useGamificationStore } from "../../store/gamificationStore";
import { useSecurityStore, userHasPinSet } from "../../store/securityStore";
import { computeSecurityScoreDetail } from "../security/securityScore";
import { buildTransactionHealthSignals } from "../transactions/transactions.engine";
import { buildHealthInput, computeHealthReport } from "./health.engine";
import { buildEmergencyActivitySnapshot, buildSavingsDisciplineSnapshot } from "./health.savingsDiscipline";
import { normalizeScore, safeNumber } from "../../lib/number";
import { DEFAULT_MONTHLY_INCOME } from "../../lib/financialDefaults";

export function getSyncGxHealthScore(): number {
  const { useAuthStore } = require("../../store/authStore") as typeof import("../../store/authStore");
  const currentUser = useAuthStore.getState().currentUser;
  const userId = currentUser?.id ?? "";
  const transactions = useTransactionStore.getState().transactions;
  const savingsState = useSavingsStore.getState();
  const latestAutoAllocation = savingsState.latestAutoAllocation;
  const savingsBuckets = savingsState.savingsBuckets;
  const allocationRule = savingsState.userAllocationRule ?? savingsState.allocationRule;
  const manualActivities = savingsState.manualActivities;
  const roundUpEnabled = savingsState.roundUpEnabled;
  const roundUpTotal = savingsState.roundUpTotal;
  const account = useAccountStore.getState();
  const flexiUsed = account.flexiUsed;
  const flexiCreditUsed = account.flexiCreditUsed;
  const flexiLimit = account.flexiLimit;
  const mainBalance = account.mainBalance;
  const fc = useFlexiCreditStore.getState();
  const flexiOutstanding = fc.outstanding;
  const flexiMonthlyRepay = fc.monthlyRepayment;
  const flexiNextDue = fc.nextRepaymentDate;
  const flexiApprovedLimit = fc.approvedLimit;
  const flexiDrawdowns = fc.activeDrawdowns;
  const flexiOverdue = flexiDrawdowns.filter((d) => d.status === "overdue").length;
  const sec = useSecurityStore.getState();
  const secSnap = {
    deviceTrusted: sec.deviceTrusted,
    emergencyLock: sec.emergencyLock,
    transactionAlertsEnabled: sec.transactionAlertsEnabled,
    biometricEnabledLocal: sec.biometricEnabledLocal,
    mockSuspiciousSession: sec.mockSuspiciousSession,
    mockRiskyLinkFlag: sec.mockRiskyLinkFlag,
    safetyCheckStatus: sec.safetyCheckStatus,
    wrongPinAttempts: sec.wrongPinAttempts,
    sensitiveLockUntil: sec.sensitiveLockUntil,
    lastScamCheck: sec.lastScamCheck,
  };
  const secDetail = computeSecurityScoreDetail(currentUser, secSnap);
  const pinOk = userHasPinSet();
  const deviceSafety =
    sec.safetyCheckStatus === "safe"
      ? ("passed" as const)
      : sec.safetyCheckStatus === "attention"
        ? ("attention" as const)
        : sec.safetyCheckStatus === "risk"
          ? ("risk" as const)
          : ("not_run" as const);

  const monthlyIncome = safeNumber(currentUser?.financialProfile?.monthlyIncome, DEFAULT_MONTHLY_INCOME);
  const incomeBase = safeNumber(latestAutoAllocation?.amount, monthlyIncome);
  const totalSavings =
    safeNumber(savingsBuckets.bonus, 0) +
    safeNumber(savingsBuckets.emergency, 0) +
    safeNumber(savingsBuckets.goals, 0);
  const currentStreak = safeNumber(useGamificationStore.getState().currentStreak, 0);
  const savingsDiscipline = buildSavingsDisciplineSnapshot({
    bonusBalance: safeNumber(savingsBuckets.bonus, 0),
    goalsBalance: safeNumber(savingsBuckets.goals, 0),
    monthlyIncomeRef: incomeBase,
    manualActivities,
    allocationRule: {
      bonusPocket: safeNumber(allocationRule.bonusPocket, 0),
      emergencyFund: safeNumber(allocationRule.emergencyFund, 0),
      goalSavings: safeNumber(allocationRule.goalSavings, 0),
    },
    latestAutoAllocation,
    roundUpEnabled,
    roundUpTotal: safeNumber(roundUpTotal, 0),
    savingStreakDays: currentStreak,
  });
  const emergActivity = buildEmergencyActivitySnapshot(manualActivities);
  const debtExposure = safeNumber(flexiUsed, 0) + safeNumber(flexiCreditUsed, 0);
  const debtRatio = incomeBase > 0 ? Math.min(0.95, debtExposure / incomeBase) : 0.05;
  const transactionSignals = buildTransactionHealthSignals(transactions, incomeBase, userId);

  const input = buildHealthInput({
    monthlyIncome: incomeBase,
    monthlySavings: totalSavings,
    emergencyFundBalance: safeNumber(savingsBuckets.emergency, 0),
    emergencyWithdrawalCountThisMonth: emergActivity.emergencyWithdrawalCountThisMonth,
    emergencyWithdrawalAmountThisMonth: emergActivity.emergencyWithdrawalAmountThisMonth,
    savingsDiscipline,
    safeBudget: Math.max(0, incomeBase * (safeNumber(allocationRule.spendingWallet, 60) / 100)),
    debtRatio,
    mainBalance: safeNumber(mainBalance, 0),
    flexiDebt: {
      approvedLimit: safeNumber(flexiApprovedLimit, 0),
      outstanding: safeNumber(flexiOutstanding, 0),
      monthlyRepaymentDue: safeNumber(flexiMonthlyRepay, 0),
      nextDueDate: flexiNextDue,
      overdueCount: flexiOverdue,
      activeDrawdowns: flexiDrawdowns.length,
    },
    cardCredit: { used: safeNumber(flexiUsed, 0), limit: safeNumber(flexiLimit, 0) },
    security: {
      score: secDetail.score,
      pinConfigured: pinOk,
      deviceSafety,
      scamProtectionSummary: secDetail.breakdown.scamProtection,
      emergencyLock: sec.emergencyLock,
    },
    transactionSignals,
  });

  const base = computeHealthReport(input);
  return normalizeScore(base.score, 70);
}
