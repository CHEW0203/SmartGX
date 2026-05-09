import { getSupabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import type { Transaction } from "../../types/transaction";
import type { AppActivity } from "../../types/activity";
import type { AppNotification } from "../../types/notification";
import { transactionToDbInsert } from "./transactionMapper";

export function getAuthUserId(): string | null {
  return useAuthStore.getState().currentUser?.id ?? null;
}

export async function persistAccount(userId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { useAccountStore } = require("../../store/accountStore");
  const a = useAccountStore.getState();
  const { error } = await sb
    .from("accounts")
    .update({
      main_balance: a.mainBalance,
      flexi_limit: a.flexiLimit,
      flexi_used: a.flexiUsed,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  return !error;
}

export async function persistSavingsRow(userId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { useSavingsStore } = require("../../store/savingsStore");
  const s = useSavingsStore.getState();
  const savings_state = {
    manualIncomes: s.manualIncomes,
    manualActivities: s.manualActivities,
    withdrawalHistory: s.withdrawalHistory,
    latestAutoAllocation: s.latestAutoAllocation,
    userAllocationRule: s.userAllocationRule,
    allocationRule: s.allocationRule,
    pendingBonusBoost: s.pendingBonusBoost,
  };
  const { error } = await sb
    .from("savings")
    .update({
      bonus_balance: s.savingsBuckets.bonus,
      emergency_balance: s.savingsBuckets.emergency,
      goals_balance: s.savingsBuckets.goals,
      allocation_spending_pct: s.userAllocationRule.spendingWallet,
      allocation_bonus_pct: s.userAllocationRule.bonusPocket,
      allocation_emergency_pct: s.userAllocationRule.emergencyFund,
      allocation_goals_pct: s.userAllocationRule.goalSavings,
      pending_bonus_reward_name: s.pendingBonusRewardName ?? null,
      pending_bonus_reward_amount: s.pendingBonusRewardAmount ?? 0,
      pending_bonus_progress: s.pendingBonusProgress ?? 0,
      pending_bonus_target: s.pendingBonusTarget ?? 0,
      round_up_enabled: s.roundUpEnabled,
      round_up_total: s.roundUpTotal,
      round_up_destination: s.roundUpDestination,
      use_ai_allocation: s.useAIAllocation,
      savings_state,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  return !error;
}

export async function persistTransactionRow(userId: string, txn: Transaction): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const row = transactionToDbInsert({ ...txn, userId }, userId);
  const { error } = await sb.from("transactions").upsert(row, { onConflict: "id" });
  return !error;
}

export async function persistActivityRow(userId: string, a: AppActivity): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("latest_activities").upsert(
    {
      id: a.id,
      user_id: userId,
      type: a.type,
      title: a.title,
      description: a.description,
      amount: a.amount ?? null,
      target_screen: a.route ?? null,
      metadata: { direction: a.direction },
      created_at: a.timestamp,
    },
    { onConflict: "id" }
  );
  return !error;
}

export async function persistNotificationRow(userId: string, n: AppNotification): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("notifications").upsert(
    {
      id: n.id,
      user_id: userId,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      target_screen: n.linkedScreen ?? null,
      metadata: {},
      created_at:
        typeof n.time === "string" && (n.time.includes("T") || n.time.includes("-") && n.time.length >= 19)
          ? n.time.includes("T")
            ? n.time
            : new Date().toISOString()
          : new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  return !error;
}

export async function deleteNotificationDb(userId: string, id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("notifications").delete().eq("user_id", userId).eq("id", id);
  return !error;
}

export async function persistSecurityRow(userId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { useSecurityStore } = require("../../store/securityStore");
  const sec = useSecurityStore.getState();
  const { error } = await sb
    .from("security_settings")
    .update({
      emergency_lock_active: sec.emergencyLock,
      trusted_device: sec.deviceTrusted,
      wrong_pin_attempts: sec.wrongPinAttempts,
      security_extras: {
        sensitiveLockUntil: sec.sensitiveLockUntil,
        transactionAlertsEnabled: sec.transactionAlertsEnabled,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  return !error;
}

export async function persistPinHash(userId: string, pinHash: string | null, pinSet: boolean): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb
    .from("security_settings")
    .update({
      pin_hash: pinHash,
      pin_set: pinSet,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  return !error;
}

export async function persistFlexiCredit(userId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { useFlexiCreditStore } = require("../../store/flexiCreditStore");
  const f = useFlexiCreditStore.getState();
  const flexi_state = {
    eligibility: f.eligibility,
    debtAnalysis: f.debtAnalysis,
    application: f.application,
    safeDrawdownRecommendation: f.safeDrawdownRecommendation,
    nextRepaymentDate: f.nextRepaymentDate,
    monthlyRepayment: f.monthlyRepayment,
    repaymentHistory: f.repaymentHistory,
    outstanding: f.outstanding,
  };
  const { error } = await sb
    .from("flexicredit_accounts")
    .update({
      status: f.status,
      approved_limit: f.approvedLimit,
      available_credit: f.availableLimit,
      used_credit: f.outstanding,
      annual_interest_rate: f.annualInterestRate * 100,
      auto_repayment_enabled: f.autoRepaymentEnabled,
      documents: f.docs,
      application_data: f.application ?? {},
      flexi_state,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) return false;

  for (const d of f.activeDrawdowns) {
    const { error: de } = await sb.from("flexicredit_drawdowns").upsert(
      {
        id: d.drawdownId,
        user_id: userId,
        amount: d.principalAmount,
        purpose: d.purpose,
        tenure_months: d.tenureMonths,
        interest_rate: d.annualInterestRate * 100,
        estimated_interest: d.estimatedInterest,
        total_repayment: d.totalRepayment,
        monthly_repayment: d.monthlyRepayment,
        remaining_balance: d.remainingBalance,
        status: d.status,
        next_due_date: d.nextDueDate,
        metadata: { smartgx_drawdown: d },
        created_at: d.createdAt,
      },
      { onConflict: "id" }
    );
    if (de) return false;
  }
  return true;
}

export async function persistGamification(userId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { useGamificationStore } = require("../../store/gamificationStore");
  const g = useGamificationStore.getState();
  const { error: e1 } = await sb
    .from("streaks")
    .update({
      current_streak: g.currentStreak,
      longest_streak: g.longestStreak,
      saved_this_month: g.monthlySavedAmount,
      streak_milestones_claimed: g.streakMilestonesClaimed,
      auto_credited_milestones: g.autoCreditedStreakMilestones,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (e1) return false;

  for (const [date, amt] of Object.entries(g.savedByDate)) {
    const { error: e2 } = await sb.from("streak_days").upsert(
      { user_id: userId, date, saved_amount: amt, sources: [] },
      { onConflict: "user_id,date" }
    );
    if (e2) return false;
  }

  const { error: e3 } = await sb
    .from("money_tree")
    .update({
      level: g.treeLevel,
      exp: g.treeExp,
      health: g.treeHealth,
      water: g.water,
      smart_score: g.smartScore,
      rank_movement: g.rankMovement,
      tree_state: g.treeState,
      score_breakdown: g.scoreBreakdown,
      last_synced_at: g.lastSyncedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (e3) return false;

  for (const c of g.campaigns) {
    const { error: e4 } = await sb.from("campaign_progress").upsert(
      {
        user_id: userId,
        campaign_id: c.id,
        progress: c.progress,
        target: c.target,
        status: c.status,
        reward_credited: c.status === "reward_credited",
        metadata: {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,campaign_id" }
    );
    if (e4) return false;
  }
  return true;
}

/** Fire-and-forget sync helpers (log failures in dev). */
export function syncAccountAndSavings(): void {
  const uid = getAuthUserId();
  if (!uid) return;
  void Promise.all([persistAccount(uid), persistSavingsRow(uid)]).then(([a, s]) => {
    if (__DEV__ && (!a || !s)) console.warn("[SmartGX] persist account/savings partial failure");
  });
}

export function syncTransaction(txn: Transaction): void {
  const uid = getAuthUserId();
  if (!uid) return;
  void persistTransactionRow(uid, txn).then((ok) => {
    if (__DEV__ && !ok) console.warn("[SmartGX] persist transaction failed");
  });
}

export function syncActivity(a: AppActivity): void {
  const uid = getAuthUserId();
  if (!uid) return;
  void persistActivityRow(uid, a);
}

export function syncNotification(n: AppNotification): void {
  const uid = getAuthUserId();
  if (!uid) return;
  void persistNotificationRow(uid, n);
}

export function syncSecurity(): void {
  const uid = getAuthUserId();
  if (!uid) return;
  void persistSecurityRow(uid);
}

export function syncFlexi(): void {
  const uid = getAuthUserId();
  if (!uid) return;
  void persistFlexiCredit(uid);
}

export function syncGamification(): void {
  const uid = getAuthUserId();
  if (!uid) return;
  void persistGamification(uid);
}
