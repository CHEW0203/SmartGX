import { useActivityStore } from "../../store/activityStore";
import { useAccountStore } from "../../store/accountStore";
import { useSavingsStore } from "../../store/savingsStore";
import { useTransactionStore } from "../../store/transactionStore";
import { useSecurityStore } from "../../store/securityStore";
import { buildEvalContext, type ChallengeEvalContext } from "./challenge.engine";

function isoDay(ts: string): string {
  return ts.slice(0, 10);
}

function savingsManualTotalsToday(today: string): { buckets: number; emergency: number } {
  const appActs = useActivityStore.getState().activities;
  let buckets = 0;
  let emergency = 0;
  for (const a of appActs) {
    if (isoDay(a.timestamp) !== today) continue;
    if (a.type === "manual_save" || a.type === "auto_allocation") {
      const amt = a.amount ?? 0;
      const desc = (a.description ?? "").toLowerCase();
      if (desc.includes("emergency")) emergency += amt;
      if (desc.includes("bonus") || desc.includes("emergency") || desc.includes("goal") || a.type === "auto_allocation") {
        buckets += amt;
      }
    }
  }
  return {
    buckets: Math.round(buckets * 100) / 100,
    emergency: Math.round(emergency * 100) / 100,
  };
}

export function buildChallengeEvalContextForUser(input: {
  userId: string;
  today: string;
  challengeStart: string;
  challengeEnd: string;
  insightReviewedToday: boolean;
  gxHealth: number;
}): ChallengeEvalContext {
  const activities = useActivityStore.getState().activities;
  const transactions = useTransactionStore.getState().transactions;
  const { buckets, emergency } = savingsManualTotalsToday(input.today);
  const roundUpEnabled = useSavingsStore.getState().roundUpEnabled;
  const mainBalance = useAccountStore.getState().mainBalance;
  const lastSafety = useSecurityStore.getState().lastSafetyCheckAt;

  return buildEvalContext({
    userId: input.userId,
    today: input.today,
    challengeStart: input.challengeStart,
    challengeEnd: input.challengeEnd,
    activities,
    transactions,
    savingsManualTodayTotal: buckets,
    emergencyAddedToday: emergency,
    roundUpEnabled,
    mainBalance,
    gxHealth: input.gxHealth,
    lastSafetyCheckAt: lastSafety,
    insightReviewedToday: input.insightReviewedToday,
  });
}
