import { getSupabase } from "../../lib/supabase";
import { useAccountStore } from "../../store/accountStore";
import { useActivityStore } from "../../store/activityStore";
import { useFlexiCreditStore } from "../../store/flexiCreditStore";
import { useGamificationStore } from "../../store/gamificationStore";
import { useNotificationStore } from "../../store/notificationStore";
import { useSavingsStore } from "../../store/savingsStore";
import { useSecurityStore } from "../../store/securityStore";
import { useTransactionStore } from "../../store/transactionStore";
import type { AppActivity } from "../../types/activity";
import type { AppNotification } from "../../types/notification";
import type { FlexiCreditDrawdown, FlexiCreditRepaymentRecord } from "../../store/flexiCreditStore";
import type { BorrowPurpose } from "../../features/flexiCredit/debtReadiness.service";
import { dbRowToTransaction, filterTransactionsNotFuture } from "./transactionMapper";
import type { DbTransactionRow } from "./transactionMapper";
import { normalizeScore, normalizeSmartScore, safeNumber } from "../../lib/number";
import { DEFAULT_CREDIT_CARD_LIMIT, DEFAULT_DEBIT_DAILY_LIMIT } from "../../features/card/cardSpend";

function normalizeHydratedFlexi(
  limitRaw: unknown,
  usedRaw: unknown
): { flexiLimit: number; flexiUsed: number } {
  let flexiLimit = safeNumber(limitRaw, 0);
  let flexiUsed = safeNumber(usedRaw, 0);
  if (flexiUsed < 0) flexiUsed = 0;
  if (flexiLimit <= 0) {
    flexiLimit = flexiUsed > 0 ? Math.max(DEFAULT_CREDIT_CARD_LIMIT, flexiUsed) : DEFAULT_CREDIT_CARD_LIMIT;
  }
  if (flexiUsed > flexiLimit) {
    flexiLimit = flexiUsed;
  }
  return { flexiLimit: Math.round(flexiLimit * 100) / 100, flexiUsed: Math.round(flexiUsed * 100) / 100 };
}

export async function hydrateUserDataStores(userId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: "Database not configured." };

  try {
    const [
      accRes,
      savRes,
      txnRes,
      actRes,
      notifRes,
      secRes,
      flexRes,
      drawRes,
      streakRes,
      dayRes,
      treeRes,
      campRes,
      missRes,
      friendsRes,
      gxRes,
    ] = await Promise.all([
      sb.from("accounts").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("savings").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
      sb.from("latest_activities").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      sb.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      sb.from("security_settings").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("flexicredit_accounts").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("flexicredit_drawdowns").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      sb.from("streaks").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("streak_days").select("*").eq("user_id", userId),
      sb.from("money_tree").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("campaign_progress").select("*").eq("user_id", userId),
      sb.from("missions").select("*").eq("user_id", userId),
      sb.from("friends").select("*").eq("user_id", userId),
      sb.from("gxhealth").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    const err =
      accRes.error ||
      savRes.error ||
      txnRes.error ||
      actRes.error ||
      notifRes.error ||
      secRes.error ||
      flexRes.error ||
      drawRes.error ||
      streakRes.error ||
      dayRes.error ||
      treeRes.error ||
      campRes.error ||
      missRes.error ||
      friendsRes.error ||
      gxRes.error;
    if (err) throw err;

    const account = accRes.data;
    if (account) {
      const { flexiLimit, flexiUsed } = normalizeHydratedFlexi(account.flexi_limit, account.flexi_used);
      useAccountStore.setState({
        mainBalance: safeNumber(account.main_balance, 0),
        flexiLimit,
        flexiUsed,
        flexiCreditLimit: 0,
        flexiCreditUsed: 0,
        debitDailyLimit: DEFAULT_DEBIT_DAILY_LIMIT,
      });
    }

    const savings = savRes.data;
    if (savings) {
      const st = (savings.savings_state ?? {}) as Record<string, unknown>;
      useSavingsStore.setState({
        savingsBuckets: {
          bonus: safeNumber(savings.bonus_balance, 0),
          emergency: safeNumber(savings.emergency_balance, 0),
          goals: safeNumber(savings.goals_balance, 0),
        },
        allocationRule: {
          spendingWallet: safeNumber(savings.allocation_spending_pct, 60),
          bonusPocket: safeNumber(savings.allocation_bonus_pct, 20),
          emergencyFund: safeNumber(savings.allocation_emergency_pct, 10),
          goalSavings: safeNumber(savings.allocation_goals_pct, 10),
        },
        userAllocationRule: {
          spendingWallet: safeNumber(savings.allocation_spending_pct, 60),
          bonusPocket: safeNumber(savings.allocation_bonus_pct, 20),
          emergencyFund: safeNumber(savings.allocation_emergency_pct, 10),
          goalSavings: safeNumber(savings.allocation_goals_pct, 10),
        },
        useAIAllocation: Boolean(savings.use_ai_allocation),
        roundUpEnabled: Boolean(savings.round_up_enabled),
        roundUpTotal: safeNumber(savings.round_up_total, 0),
        roundUpDestination: (savings.round_up_destination as "bonus" | "emergency" | "goals") ?? "bonus",
        pendingBonusRewardName: savings.pending_bonus_reward_name ?? undefined,
        pendingBonusRewardAmount: safeNumber(savings.pending_bonus_reward_amount, 0),
        pendingBonusProgress: safeNumber(savings.pending_bonus_progress, 0),
        pendingBonusTarget: safeNumber(savings.pending_bonus_target, 0),
        manualIncomes: (st.manualIncomes as typeof useSavingsStore extends { getState: () => { manualIncomes: infer M } } ? M : never) ?? [],
        manualActivities: (st.manualActivities as []) ?? [],
        withdrawalHistory: (st.withdrawalHistory as []) ?? [],
        latestAutoAllocation: (st.latestAutoAllocation as null) ?? null,
        pendingBonusBoost: safeNumber(st.pendingBonusBoost, 0),
      });
      const ur = st.userAllocationRule as { spendingWallet: number; bonusPocket: number; emergencyFund: number; goalSavings: number } | undefined;
      const ar = st.allocationRule as typeof ur;
      if (ur) useSavingsStore.setState({ userAllocationRule: ur });
      if (ar) useSavingsStore.setState({ allocationRule: ar });
    }

    const txns = (txnRes.data ?? []) as DbTransactionRow[];
    const mapped = filterTransactionsNotFuture(txns.map((r) => dbRowToTransaction(r, userId)));
    useTransactionStore.setState({ transactions: mapped });

    const activities = (actRes.data ?? []).map(
      (r): AppActivity => ({
        id: r.id,
        type: r.type as AppActivity["type"],
        title: r.title,
        description: r.description ?? "",
        amount: r.amount != null ? Number(r.amount) : undefined,
        direction: (r.metadata as { direction?: AppActivity["direction"] } | null)?.direction,
        timestamp: r.created_at,
        route: r.target_screen ?? undefined,
      })
    );
    useActivityStore.setState({ activities });

    const notifications = (notifRes.data ?? []).map(
      (r): AppNotification => ({
        id: r.id,
        title: r.title,
        message: r.message,
        time: r.created_at,
        read: Boolean(r.read),
        type: r.type as AppNotification["type"],
        linkedScreen: r.target_screen ?? undefined,
      })
    );
    const unread = notifications.filter((n) => !n.read).length;
    useNotificationStore.setState({ notifications, unreadCount: unread });

    const sec = secRes.data;
    if (sec) {
      const pinHash = typeof sec.pin_hash === "string" ? sec.pin_hash : null;
      useSecurityStore.setState({
        pinSetFromServer: Boolean(sec.pin_set) || Boolean(pinHash && pinHash.length > 0),
        serverPinHash: pinHash,
        emergencyLock: Boolean(sec.emergency_lock_active),
        deviceTrusted: Boolean(sec.trusted_device),
        wrongPinAttempts: Number(sec.wrong_pin_attempts ?? 0),
      });
      const extras = (sec.security_extras ?? {}) as { sensitiveLockUntil?: number; transactionAlertsEnabled?: boolean };
      if (typeof extras.sensitiveLockUntil === "number") {
        useSecurityStore.setState({ sensitiveLockUntil: extras.sensitiveLockUntil });
      }
      if (typeof extras.transactionAlertsEnabled === "boolean") {
        useSecurityStore.setState({ transactionAlertsEnabled: extras.transactionAlertsEnabled });
      }
    }

    const flex = flexRes.data;
    const flexState = (flex?.flexi_state ?? {}) as Record<string, unknown>;
    if (flex) {
      useAccountStore.setState({
        flexiCreditLimit: Number(flex.approved_limit ?? 0),
        flexiCreditUsed: Number(flex.used_credit ?? 0),
      });
      useFlexiCreditStore.setState({
        status: flex.status as typeof useFlexiCreditStore extends { getState: () => { status: infer S } } ? S : never,
        approvedLimit: Number(flex.approved_limit),
        availableLimit: Number(flex.available_credit),
        outstanding: Number(flexState.outstanding ?? 0),
        annualInterestRate: Number(flex.annual_interest_rate) / 100,
        autoRepaymentEnabled: Boolean(flex.auto_repayment_enabled),
        docs: (flex.documents ?? {}) as typeof useFlexiCreditStore extends { getState: () => { docs: infer D } } ? D : never,
        application: (flexState.application as typeof useFlexiCreditStore extends { getState: () => { application: infer A } } ? A : null) ?? null,
        debtAnalysis: (flexState.debtAnalysis as typeof useFlexiCreditStore extends { getState: () => { debtAnalysis: infer D } } ? D : null) ?? null,
        eligibility: (flexState.eligibility as typeof useFlexiCreditStore extends { getState: () => { eligibility: infer E } } ? E : null) ?? null,
        safeDrawdownRecommendation: Number(flexState.safeDrawdownRecommendation ?? 0),
        nextRepaymentDate: (flexState.nextRepaymentDate as string | null) ?? null,
        monthlyRepayment: Number(flexState.monthlyRepayment ?? 0),
        repaymentHistory: (flexState.repaymentHistory as FlexiCreditRepaymentRecord[]) ?? [],
      });
    }

    const drawRows = drawRes.data ?? [];
    if (drawRows.length > 0) {
      const activeDrawdowns: FlexiCreditDrawdown[] = drawRows.map((row) => {
        const m = (row.metadata as { smartgx_drawdown?: FlexiCreditDrawdown } | null)?.smartgx_drawdown;
        if (m) return m;
        return {
          drawdownId: row.id,
          principalAmount: Number(row.amount),
          annualInterestRate: Number(row.interest_rate) / 100,
          tenureMonths: row.tenure_months,
          estimatedInterest: Number(row.estimated_interest),
          totalRepayment: Number(row.total_repayment),
          monthlyRepayment: Number(row.monthly_repayment),
          remainingBalance: Number(row.remaining_balance),
          remainingPrincipal: Number(row.amount),
          paidAmount: 0,
          principalPaid: 0,
          interestPaid: 0,
          nextDueDate: row.next_due_date ?? "",
          remainingMonths: row.tenure_months,
          purpose: row.purpose as BorrowPurpose,
          status: row.status as FlexiCreditDrawdown["status"],
          createdAt: row.created_at,
        };
      });
      useFlexiCreditStore.setState({ activeDrawdowns });
    }
    const drawsAfter = useFlexiCreditStore.getState().activeDrawdowns;
    const outSum = Math.round(drawsAfter.reduce((sum, d) => sum + d.remainingBalance, 0) * 100) / 100;
    if (outSum > 0 || flexState.outstanding != null) {
      useFlexiCreditStore.setState({
        outstanding: outSum > 0 ? outSum : Number(flexState.outstanding ?? 0),
      });
    }

    const streak = streakRes.data;
    const days = dayRes.data ?? [];
    const savedByDate: Record<string, number> = {};
    for (const d of days) {
      savedByDate[d.date] = Number(d.saved_amount);
    }
    useGamificationStore.setState({
      savedByDate,
      ...(streak
        ? {
            streakMilestonesClaimed: (streak.streak_milestones_claimed as string[]) ?? [],
            autoCreditedStreakMilestones: (streak.auto_credited_milestones as string[]) ?? [],
          }
        : {}),
    });

    const tree = treeRes.data;
    if (tree) {
      useGamificationStore.setState({
        treeLevel: Math.max(1, safeNumber(tree.level, 1)),
        treeExp: safeNumber(tree.exp, 0),
        treeHealth: normalizeScore(tree.health, 70),
        water: Math.max(0, safeNumber(tree.water, 0)),
        smartScore: normalizeSmartScore(tree.smart_score, 420),
        rankMovement: safeNumber(tree.rank_movement, 0),
        treeState: tree.tree_state as typeof useGamificationStore extends { getState: () => { treeState: infer T } } ? T : never,
        scoreBreakdown: (tree.score_breakdown as typeof useGamificationStore extends { getState: () => { scoreBreakdown: infer S } } ? S : never) ?? undefined,
        lastSyncedAt: tree.last_synced_at,
      });
    }

    const camps = campRes.data ?? [];
    if (camps.length > 0) {
      const byId = new Map(camps.map((c) => [c.campaign_id, c]));
      useGamificationStore.setState((s) => ({
        campaigns: s.campaigns.map((c) => {
          const row = byId.get(c.id);
          if (!row) return c;
          return {
            ...c,
            progress: Number(row.progress),
            target: Number(row.target),
            status: row.status as (typeof s.campaigns)[0]["status"],
          };
        }),
      }));
    }

    const missRows = missRes.data ?? [];
    if (missRows.length > 0) {
      useGamificationStore.setState((s) => ({
        missions: missRows.map((m) => {
          const prog = Number(m.progress);
          const tgt = Number(m.target);
          const claimed = m.status === "claimed";
          const done = claimed || prog >= tgt;
          const lifecycle =
            claimed ? "claimed" : done ? "ready_to_claim" : "in_progress";
          return {
            id: m.mission_id,
            type: m.type as "daily" | "weekly",
            title: m.title,
            description: (m.metadata as { description?: string })?.description ?? "",
            target: tgt,
            progress: Math.min(prog, tgt),
            rewardWater: m.reward_water,
            rewardPoints: m.reward_points,
            rewardBonus: (m.metadata as { rewardBonus?: number })?.rewardBonus,
            completed: done,
            claimed,
            status: lifecycle as typeof s.missions[0]["status"],
            expiry: (m.metadata as { expiry?: string })?.expiry ?? new Date().toISOString().slice(0, 10),
          };
        }),
      }));
    }

    const friendRows = friendsRes.data ?? [];
    if (friendRows.length > 0) {
      useGamificationStore.setState({
        friends: friendRows.map((f) => {
          const snap = (f.friend_snapshot ?? {}) as {
            name?: string;
            contact?: string;
            smartScore?: number;
            gxHealth?: number;
            streak?: number;
          };
          return {
            id: f.friend_user_id,
            name: snap.name ?? "Friend",
            contact: snap.contact ?? "",
            smartScore: normalizeSmartScore(snap.smartScore, 420),
            gxHealth: normalizeScore(snap.gxHealth, 70),
            streak: Math.max(0, safeNumber(snap.streak, 0)),
          };
        }),
      });
    }

    const gxRow = gxRes.data;
    const gxScore = gxRow ? normalizeScore(gxRow.score, 70) : 70;

    useGamificationStore.getState().syncFromData({
      activities: useActivityStore.getState().activities,
      gxHealthScore: gxScore,
      totalSavings:
        useSavingsStore.getState().savingsBuckets.bonus +
        useSavingsStore.getState().savingsBuckets.emergency +
        useSavingsStore.getState().savingsBuckets.goals,
      debtPressure:
        useAccountStore.getState().flexiUsed + useFlexiCreditStore.getState().outstanding,
    });

    if (streak) {
      useGamificationStore.setState({
        currentStreak: streak.current_streak,
        longestStreak: Math.max(useGamificationStore.getState().longestStreak, streak.longest_streak),
        monthlySavedAmount: Number(streak.saved_this_month),
      });
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load data.";
    if (__DEV__) console.warn("[SmartGX] hydrate error", e);
    return { ok: false, message: msg };
  }
}
