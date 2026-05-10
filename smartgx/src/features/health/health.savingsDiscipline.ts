import type { SavingsActivity } from "../savings/savings.types";
import { safeNumber } from "../../lib/number";
import type { SavingsDisciplineSnapshot } from "./health.types";

function activityMonthKey(a: SavingsActivity): string {
  const iso = a.occurredAt ?? `${a.date}T12:00:00.000Z`;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toISOString().slice(0, 7);
}

export function pocketIsEmergency(pocket: string): boolean {
  return pocket.toLowerCase().includes("emergency");
}

export function pocketIsBonusOrGoals(pocket: string): boolean {
  if (pocketIsEmergency(pocket)) return false;
  const p = pocket.toLowerCase();
  return p.includes("bonus") || p.includes("goals");
}

export interface EmergencyActivitySnapshot {
  emergencyWithdrawalCountThisMonth: number;
  emergencyWithdrawalAmountThisMonth: number;
}

const AUTO_ALLOC_LOOKBACK_MS = 45 * 24 * 60 * 60 * 1000;

export function buildSavingsDisciplineSnapshot(args: {
  bonusBalance: number;
  goalsBalance: number;
  monthlyIncomeRef: number;
  manualActivities: SavingsActivity[];
  allocationRule: { bonusPocket: number; emergencyFund: number; goalSavings: number };
  latestAutoAllocation: { receivedAt: string } | null;
  roundUpEnabled: boolean;
  roundUpTotal: number;
  savingStreakDays: number;
  referenceDate?: Date;
}): SavingsDisciplineSnapshot {
  const ref = args.referenceDate ?? new Date();
  const ym = ref.toISOString().slice(0, 7);
  const b = safeNumber(args.allocationRule.bonusPocket, 0);
  const e = safeNumber(args.allocationRule.emergencyFund, 0);
  const g = safeNumber(args.allocationRule.goalSavings, 0);
  const denom = b + e + g;
  const bonusGoalsFrac = denom > 0 ? (b + g) / denom : 0;
  const allocPct = b + g;

  let monthBonusGoalsContributionSum = 0;
  let bonusGoalsWithdrawalCountThisMonth = 0;
  let bonusGoalsWithdrawalAmountThisMonth = 0;

  for (const a of args.manualActivities) {
    const am = activityMonthKey(a);
    if (!am || am !== ym) continue;

    if (a.type === "withdrawal") {
      if (pocketIsBonusOrGoals(a.pocket)) {
        bonusGoalsWithdrawalCountThisMonth += 1;
        bonusGoalsWithdrawalAmountThisMonth += safeNumber(a.amount, 0);
      }
      continue;
    }

    if (a.amount <= 0) continue;

    if (a.type === "auto" && a.pocket === "Savings" && a.label.toLowerCase().includes("auto-allocated")) {
      monthBonusGoalsContributionSum += safeNumber(a.amount, 0) * bonusGoalsFrac;
      continue;
    }

    if (pocketIsBonusOrGoals(a.pocket)) {
      monthBonusGoalsContributionSum += safeNumber(a.amount, 0);
    }
  }

  const alloc = args.latestAutoAllocation;
  let latestAutoAllocationApplied = false;
  if (alloc?.receivedAt) {
    const t = Date.parse(alloc.receivedAt);
    if (Number.isFinite(t) && ref.getTime() - t < AUTO_ALLOC_LOOKBACK_MS) {
      latestAutoAllocationApplied = true;
    }
  }

  return {
    bonusBalance: safeNumber(args.bonusBalance, 0),
    goalsBalance: safeNumber(args.goalsBalance, 0),
    monthlyIncomeRef: safeNumber(args.monthlyIncomeRef, 0),
    monthBonusGoalsContributionSum: Math.round(monthBonusGoalsContributionSum * 100) / 100,
    allocationBonusGoalsPercent: allocPct,
    latestAutoAllocationApplied,
    roundUpEnabled: args.roundUpEnabled,
    roundUpLifetimeTotal: safeNumber(args.roundUpTotal, 0),
    savingStreakDays: Math.max(0, Math.floor(safeNumber(args.savingStreakDays, 0))),
    bonusGoalsWithdrawalCountThisMonth,
    bonusGoalsWithdrawalAmountThisMonth: Math.round(bonusGoalsWithdrawalAmountThisMonth * 100) / 100,
  };
}

export function buildEmergencyActivitySnapshot(
  manualActivities: SavingsActivity[],
  referenceDate?: Date
): EmergencyActivitySnapshot {
  const ref = referenceDate ?? new Date();
  const ym = ref.toISOString().slice(0, 7);
  let emergencyWithdrawalCountThisMonth = 0;
  let emergencyWithdrawalAmountThisMonth = 0;
  for (const a of manualActivities) {
    const am = activityMonthKey(a);
    if (!am || am !== ym) continue;
    if (a.type !== "withdrawal") continue;
    if (!pocketIsEmergency(a.pocket)) continue;
    emergencyWithdrawalCountThisMonth += 1;
    emergencyWithdrawalAmountThisMonth += safeNumber(a.amount, 0);
  }
  return {
    emergencyWithdrawalCountThisMonth,
    emergencyWithdrawalAmountThisMonth: Math.round(emergencyWithdrawalAmountThisMonth * 100) / 100,
  };
}
