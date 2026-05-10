/**
 * Shared GXHealth calculation hook.
 * Both dashboard and GXHealth screen import this to guarantee identical scores.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { useTransactionStore } from "../store/transactionStore";
import { useSavingsStore } from "../store/savingsStore";
import { useAccountStore } from "../store/accountStore";
import { useFlexiCreditStore } from "../store/flexiCreditStore";
import { useNotificationStore } from "../store/notificationStore";
import { useGamificationStore } from "../store/gamificationStore";
import { useSecurityStore, userHasPinSet } from "../store/securityStore";
import { computeSecurityScoreDetail } from "../features/security/securityScore";
import {
  aggregateCategorySpend,
  aggregateMonthly,
  buildTransactionHealthSignals,
} from "../features/transactions/transactions.engine";
import { buildHealthInput, computeHealthReport } from "../features/health/health.engine";
import {
  buildEmergencyActivitySnapshot,
  buildSavingsDisciplineSnapshot,
} from "../features/health/health.savingsDiscipline";
import type { HealthReport } from "../features/health/health.types";
import { normalizeScore, safeNumber } from "../lib/number";
import { DEFAULT_MONTHLY_INCOME } from "../lib/financialDefaults";
import { enrichGxHealthWithAi, gxHealthAnalysisFallback } from "../features/ai/gxhealth.ai";
import { buildGxHealthAiContext } from "../features/ai/gxhealthContext.builder";
import { transactionOccurredMs, visibleHistoryTransactions } from "../lib/transactionTime";
import type { GXHealthStructuredAnalysis } from "../features/ai/gxhealth.ai.types";

export { DEFAULT_MONTHLY_INCOME } from "../lib/financialDefaults";

export function useHealthData(): HealthReport {
  const { currentUser } = useAuth();
  const { transactions } = useTransactionStore();
  const latestAutoAllocation = useSavingsStore((s) => s.latestAutoAllocation);
  const savingsBuckets = useSavingsStore((s) => s.savingsBuckets);
  const allocationRule = useSavingsStore((s) => s.userAllocationRule ?? s.allocationRule);
  const manualActivities = useSavingsStore((s) => s.manualActivities);
  const roundUpEnabled = useSavingsStore((s) => s.roundUpEnabled);
  const roundUpTotal = useSavingsStore((s) => s.roundUpTotal);
  const flexiUsed = useAccountStore((s) => s.flexiUsed);
  const flexiLimit = useAccountStore((s) => s.flexiLimit);
  const flexiCreditUsed = useAccountStore((s) => s.flexiCreditUsed);
  const flexiCreditLimit = useAccountStore((s) => s.flexiCreditLimit);
  const mainBalance = useAccountStore((s) => s.mainBalance);

  const flexiOutstanding = useFlexiCreditStore((s) => s.outstanding);
  const flexiNextDue = useFlexiCreditStore((s) => s.nextRepaymentDate);
  const flexiMonthlyRepay = useFlexiCreditStore((s) => s.monthlyRepayment);
  const flexiApprovedLimit = useFlexiCreditStore((s) => s.approvedLimit);
  const flexiActiveDrawdowns = useFlexiCreditStore((s) => s.activeDrawdowns);
  const flexiDrawdowns = flexiActiveDrawdowns.length;

  const secDeviceTrusted = useSecurityStore((s) => s.deviceTrusted);
  const secEmergencyLock = useSecurityStore((s) => s.emergencyLock);
  const secTxAlerts = useSecurityStore((s) => s.transactionAlertsEnabled);
  const secBioLocal = useSecurityStore((s) => s.biometricEnabledLocal);
  const secMockSusp = useSecurityStore((s) => s.mockSuspiciousSession);
  const secMockRisky = useSecurityStore((s) => s.mockRiskyLinkFlag);
  const secSafety = useSecurityStore((s) => s.safetyCheckStatus);
  const secWrongPins = useSecurityStore((s) => s.wrongPinAttempts);
  const secLockUntil = useSecurityStore((s) => s.sensitiveLockUntil);
  const secLastScam = useSecurityStore((s) => s.lastScamCheck);
  const secPinFromServer = useSecurityStore((s) => s.pinSetFromServer);
  const secServerPinHash = useSecurityStore((s) => s.serverPinHash);

  const notifications = useNotificationStore((s) => s.notifications);
  const currentStreak = useGamificationStore((s) => s.currentStreak);
  const campaigns = useGamificationStore((s) => s.campaigns);

  const userId = currentUser?.id ?? "";

  const input = useMemo(() => {
    const monthlyIncome = safeNumber(currentUser?.financialProfile?.monthlyIncome, DEFAULT_MONTHLY_INCOME);
    const incomeBase = safeNumber(latestAutoAllocation?.amount, monthlyIncome);
    const totalSavings =
      safeNumber(savingsBuckets.bonus, 0) +
      safeNumber(savingsBuckets.emergency, 0) +
      safeNumber(savingsBuckets.goals, 0);
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
      savingStreakDays: safeNumber(currentStreak, 0),
    });
    const emergActivity = buildEmergencyActivitySnapshot(manualActivities);
    const debtExposure = safeNumber(flexiUsed, 0) + safeNumber(flexiCreditUsed, 0);
    const debtRatio = incomeBase > 0 ? Math.min(0.95, debtExposure / incomeBase) : 0.05;

    const transactionSignals = buildTransactionHealthSignals(transactions, incomeBase, userId);

    const overdueN = flexiActiveDrawdowns.filter((d) => d.status === "overdue").length;
    const flexiDebt = {
      approvedLimit: safeNumber(flexiApprovedLimit, 0),
      outstanding: safeNumber(flexiOutstanding, 0),
      monthlyRepaymentDue: safeNumber(flexiMonthlyRepay, 0),
      nextDueDate: flexiNextDue,
      overdueCount: overdueN,
      activeDrawdowns: flexiDrawdowns,
    };

    const secSnap = {
      deviceTrusted: secDeviceTrusted,
      emergencyLock: secEmergencyLock,
      transactionAlertsEnabled: secTxAlerts,
      biometricEnabledLocal: secBioLocal,
      mockSuspiciousSession: secMockSusp,
      mockRiskyLinkFlag: secMockRisky,
      safetyCheckStatus: secSafety,
      wrongPinAttempts: secWrongPins,
      sensitiveLockUntil: secLockUntil,
      lastScamCheck: secLastScam,
    };
    const secDetail = computeSecurityScoreDetail(currentUser, secSnap);
    const pinOk = userHasPinSet();
    const deviceSafety =
      secSafety === "safe"
        ? ("passed" as const)
        : secSafety === "attention"
          ? ("attention" as const)
          : secSafety === "risk"
            ? ("risk" as const)
            : ("not_run" as const);

    return buildHealthInput({
      monthlyIncome: incomeBase,
      monthlySavings: totalSavings,
      emergencyFundBalance: safeNumber(savingsBuckets.emergency, 0),
      emergencyWithdrawalCountThisMonth: emergActivity.emergencyWithdrawalCountThisMonth,
      emergencyWithdrawalAmountThisMonth: emergActivity.emergencyWithdrawalAmountThisMonth,
      savingsDiscipline,
      safeBudget: Math.max(0, incomeBase * (safeNumber(allocationRule.spendingWallet, 60) / 100)),
      debtRatio,
      mainBalance: safeNumber(mainBalance, 0),
      flexiDebt,
      cardCredit: { used: safeNumber(flexiUsed, 0), limit: safeNumber(flexiLimit, 0) },
      security: {
        score: secDetail.score,
        pinConfigured: pinOk,
        deviceSafety,
        scamProtectionSummary: secDetail.breakdown.scamProtection,
        emergencyLock: secEmergencyLock,
      },
      transactionSignals,
    });
  }, [
    transactions,
    userId,
    currentUser,
    latestAutoAllocation,
    manualActivities,
    roundUpEnabled,
    roundUpTotal,
    currentStreak,
    savingsBuckets.bonus,
    savingsBuckets.emergency,
    savingsBuckets.goals,
    allocationRule.bonusPocket,
    allocationRule.emergencyFund,
    allocationRule.goalSavings,
    allocationRule.spendingWallet,
    flexiUsed,
    flexiCreditUsed,
    flexiLimit,
    mainBalance,
    flexiOutstanding,
    flexiNextDue,
    flexiMonthlyRepay,
    flexiApprovedLimit,
    flexiActiveDrawdowns,
    flexiDrawdowns,
    secDeviceTrusted,
    secEmergencyLock,
    secTxAlerts,
    secBioLocal,
    secMockSusp,
    secMockRisky,
    secSafety,
    secWrongPins,
    secLockUntil,
    secLastScam,
    secPinFromServer,
    secServerPinHash,
  ]);

  const baseReport = useMemo(() => computeHealthReport(input), [input]);

  const reportNorm: HealthReport = useMemo(
    () => ({
      ...baseReport,
      score: normalizeScore(baseReport.score, 70),
    }),
    [baseReport]
  );

  const monthAgg = useMemo(
    () => (userId ? aggregateMonthly(transactions, userId) : { totalIncome: 0, totalExpense: 0, netCashflow: 0 }),
    [transactions, userId]
  );

  const categorySpend = useMemo(
    () => (userId ? aggregateCategorySpend(transactions, userId) : ({} as Record<string, number>)),
    [transactions, userId]
  );

  const recentTxForAi = useMemo(() => {
    if (!userId) return [];
    return [...visibleHistoryTransactions(transactions)]
      .filter((t) => t.userId === userId)
      .sort((a, b) => transactionOccurredMs(b) - transactionOccurredMs(a))
      .slice(0, 15);
  }, [transactions, userId]);

  const notificationsRisk14d = useMemo(() => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return notifications.filter((n) => {
      if (n.type !== "risk" && n.type !== "warning" && n.type !== "alert") return false;
      const parsed = Date.parse(n.time.replace(/·/g, " "));
      if (Number.isFinite(parsed)) return parsed >= cutoff;
      return true;
    }).length;
  }, [notifications]);

  const campaignSample = useMemo(
    () =>
      campaigns.slice(0, 4).map((c) => ({
        id: c.id,
        title: c.title,
        progress: c.progress,
        target: c.target,
        status: c.status,
      })),
    [campaigns]
  );

  const flexiCreditOutstandingForCtx = flexiOutstanding > 0 || flexiDrawdowns > 0 ? flexiOutstanding : flexiCreditUsed;
  const flexiOverdueForCtx = flexiActiveDrawdowns.filter((d) => d.status === "overdue").length;

  const extendedBase = useMemo(() => {
    const secSnap = {
      deviceTrusted: secDeviceTrusted,
      emergencyLock: secEmergencyLock,
      transactionAlertsEnabled: secTxAlerts,
      biometricEnabledLocal: secBioLocal,
      mockSuspiciousSession: secMockSusp,
      mockRiskyLinkFlag: secMockRisky,
      safetyCheckStatus: secSafety,
      wrongPinAttempts: secWrongPins,
      sensitiveLockUntil: secLockUntil,
      lastScamCheck: secLastScam,
    };
    const secForAi = computeSecurityScoreDetail(currentUser, secSnap);
    return buildGxHealthAiContext({
      displayScore: reportNorm.score,
      rawScore: baseReport.score,
      status: baseReport.status,
      previousScore: null,
      scoreChange: null,
      input,
      factors: baseReport.factors,
      mainBalance: safeNumber(mainBalance, 0),
      savingsBuckets: {
        bonus: safeNumber(savingsBuckets.bonus, 0),
        emergency: safeNumber(savingsBuckets.emergency, 0),
        goals: safeNumber(savingsBuckets.goals, 0),
      },
      employmentStatus: currentUser?.financialProfile?.employmentStatus,
      allocationAccepted: currentUser?.financialProfile?.allocationAccepted ?? false,
      monthlyIncomeDeclared: safeNumber(currentUser?.financialProfile?.monthlyIncome, DEFAULT_MONTHLY_INCOME),
      allocationRulePercents: {
        spendingWallet: safeNumber(allocationRule.spendingWallet, 0),
        bonusPocket: safeNumber(allocationRule.bonusPocket, 0),
        emergencyFund: safeNumber(allocationRule.emergencyFund, 0),
        goalSavings: safeNumber(allocationRule.goalSavings, 0),
      },
      monthIncome: monthAgg.totalIncome,
      monthExpense: monthAgg.totalExpense,
      netCashflow: monthAgg.netCashflow,
      categorySpend,
      recentTransactions: recentTxForAi,
      flexiCardUsed: safeNumber(flexiUsed, 0),
      flexiCardLimit: safeNumber(flexiLimit, 0),
      flexiCreditUsed: safeNumber(flexiCreditUsed, 0),
      flexiCreditLimit: safeNumber(flexiCreditLimit, 0),
      flexiOutstanding: safeNumber(flexiCreditOutstandingForCtx, 0),
      flexiApprovedLimit: safeNumber(flexiApprovedLimit, 0),
      flexiActiveDrawdowns: flexiDrawdowns,
      flexiOverdueDrawdowns: flexiOverdueForCtx,
      nextRepaymentDate: flexiNextDue,
      monthlyRepayment: safeNumber(flexiMonthlyRepay, 0),
      securityScore: secForAi.score,
      pinConfigured: userHasPinSet(),
      deviceSafetyStatus: secSafety,
      scamProtectionSummary: secForAi.breakdown.scamProtection,
      emergencyLock: secEmergencyLock,
      transactionAlertsEnabled: secTxAlerts,
      deviceTrusted: secDeviceTrusted,
      savingStreakDays: safeNumber(currentStreak, 0),
      roundUpEnabled,
      roundUpTotal: safeNumber(roundUpTotal, 0),
      latestAutoAllocationAmount: latestAutoAllocation?.amount ?? null,
      recentManualSaveCount: manualActivities.filter((a) => a.type === "manual").slice(0, 14).length,
      notificationsRiskCount14d: notificationsRisk14d,
      campaigns: campaignSample,
    });
  },
    [
      reportNorm.score,
      baseReport.score,
      baseReport.status,
      baseReport.factors,
      input,
      mainBalance,
      savingsBuckets.bonus,
      savingsBuckets.emergency,
      savingsBuckets.goals,
      currentUser,
      currentUser?.financialProfile?.employmentStatus,
      currentUser?.financialProfile?.allocationAccepted,
      currentUser?.financialProfile?.monthlyIncome,
      allocationRule.spendingWallet,
      allocationRule.bonusPocket,
      allocationRule.emergencyFund,
      allocationRule.goalSavings,
      monthAgg.totalIncome,
      monthAgg.totalExpense,
      monthAgg.netCashflow,
      categorySpend,
      recentTxForAi,
      flexiUsed,
      flexiLimit,
      flexiCreditUsed,
      flexiCreditLimit,
      flexiCreditOutstandingForCtx,
      flexiApprovedLimit,
      flexiDrawdowns,
      flexiOverdueForCtx,
      flexiNextDue,
      flexiMonthlyRepay,
      secDeviceTrusted,
      secEmergencyLock,
      secTxAlerts,
      secBioLocal,
      secMockSusp,
      secMockRisky,
      secSafety,
      secWrongPins,
      secLockUntil,
      secLastScam,
      currentUser?.passcode,
      secPinFromServer,
      secServerPinHash,
      currentStreak,
      roundUpEnabled,
      roundUpTotal,
      latestAutoAllocation?.amount,
      manualActivities,
      notificationsRisk14d,
      campaignSample,
    ]
  );

  const ruleAi = useMemo(
    () =>
      gxHealthAnalysisFallback({
        score: baseReport.score,
        displayScore: reportNorm.score,
        status: baseReport.status,
        factors: baseReport.factors,
        input,
        extended: extendedBase,
      }),
    [baseReport.score, baseReport.status, baseReport.factors, reportNorm.score, input, extendedBase]
  );

  const [aiAnalysis, setAiAnalysis] = useState(ruleAi.summaryAnalysis);
  const [suggestions, setSuggestions] = useState(ruleAi.recommendedActions);
  const [gxHealthAiStructured, setGxHealthAiStructured] = useState<GXHealthStructuredAnalysis | null>(
    ruleAi.structured
  );
  const [gxHealthAiBody, setGxHealthAiBody] = useState(ruleAi.aiBodyMultiline);

  useEffect(() => {
    setAiAnalysis(ruleAi.summaryAnalysis);
    setSuggestions(ruleAi.recommendedActions);
    setGxHealthAiStructured(ruleAi.structured);
    setGxHealthAiBody(ruleAi.aiBodyMultiline);
  }, [ruleAi]);

  const prevScoreRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const prev = prevScoreRef.current;
    const extended = {
      ...extendedBase,
      gxHealth: {
        ...extendedBase.gxHealth,
        previousScore: prev != null ? Math.round(prev) : null,
        scoreChange: prev != null ? Math.round(reportNorm.score - prev) : null,
      },
    };

    void enrichGxHealthWithAi({
      score: baseReport.score,
      displayScore: reportNorm.score,
      status: baseReport.status,
      factors: baseReport.factors,
      input,
      extended,
    }).then((enriched) => {
      if (cancelled || !enriched) return;
      setAiAnalysis(enriched.summaryAnalysis);
      setSuggestions(enriched.recommendedActions);
      setGxHealthAiStructured(enriched.structured);
      setGxHealthAiBody(enriched.aiBodyMultiline);
    });

    prevScoreRef.current = reportNorm.score;
    return () => {
      cancelled = true;
    };
  }, [
    baseReport.score,
    baseReport.status,
    baseReport.factors,
    reportNorm.score,
    input,
    extendedBase,
  ]);

  return {
    ...reportNorm,
    aiAnalysis,
    suggestions,
    gxHealthAiStructured,
    gxHealthAiBody,
  };
}
