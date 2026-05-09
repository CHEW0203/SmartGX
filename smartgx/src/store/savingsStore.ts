import { create } from "zustand";
import { calcAllocation, DEFAULT_RULE, ruleTotal } from "../features/savings/savings.engine";
import type { AllocationRule, IncomeType, ManualIncome, SavingsActivity } from "../features/savings/savings.types";
import { getAuthUserId, persistSavingsRow } from "../services/db/persist";

function maybePersistSavings() {
  const uid = getAuthUserId();
  if (uid) void persistSavingsRow(uid);
}

export interface SavingsBuckets {
  bonus: number;
  emergency: number;
  goals: number;
}

export type SavingsDestination = keyof SavingsBuckets;

interface SavingsState {
  allocationRule:     AllocationRule;
  userAllocationRule: AllocationRule;
  useAIAllocation:    boolean;
  manualIncomes:      ManualIncome[];
  roundUpEnabled:     boolean;
  roundUpTotal:       number;
  roundUpDestination: SavingsDestination;
  /** User-controlled incremental savings by bucket */
  savingsBuckets:     SavingsBuckets;
  /** Recent manual saving activities; prepended on each manualSave */
  manualActivities:   SavingsActivity[];
  pendingBonusBoost: number;
  pendingBonusRewardName?: string;
  pendingBonusRewardAmount: number;
  pendingBonusProgress: number;
  pendingBonusTarget: number;
  withdrawalHistory: Array<{
    id: string;
    bucket: SavingsDestination;
    amount: number;
    createdAt: string;
    consequence: "bonus_boost_reset" | "emergency_buffer_reduced" | "goal_progress_reduced";
  }>;

  /** Latest auto allocation event (set after income received) */
  latestAutoAllocation: null | {
    id: string;
    receivedAt: string; // ISO datetime
    amount: number;
    incomeType: IncomeType;
    source: string;
    description: string;
    confidence: "high" | "medium" | "low";
    detectionReason: string;
    ruleUsed: AllocationRule;
    breakdown: {
      spendingWallet: number;
      bonus: number;
      emergency: number;
      goals: number;
    };
  };

  setAllocationRule:     (rule: AllocationRule) => void;
  setUserAllocationRule: (rule: AllocationRule) => void;
  setUseAIAllocation:    (value: boolean) => void;
  addManualIncome: (entry: {
    amount:      number;
    incomeType:  IncomeType;
    description: string;
    applied:     boolean;
  }) => void;
  toggleRoundUp: () => void;
  /** Manually transfer money from spending wallet into a saving bucket */
  manualSave: (destination: SavingsDestination, amount: number) => void;
  withdrawFromBucket: (destination: SavingsDestination, amount: number) => {
    ok: boolean;
    reason?: "invalid_amount" | "insufficient_balance";
    didResetBonusBoost: boolean;
    remainingPendingBonusBoost: number;
  };
  setRoundUpDestination: (destination: SavingsDestination) => void;
  /** Apply round-up saving from spending actions */
  applyRoundUp: (amount: number) => { ok: boolean; saved: number };
  /** Prepend a new activity to the recent activity list */
  addManualActivity: (entry: SavingsActivity) => void;

  /** Apply auto allocation for an income event (does NOT credit main balance) */
  applyIncomeAutoAllocation: (input: {
    amount: number;
    incomeType: IncomeType;
    source: string;
    description: string;
    confidence: "high" | "medium" | "low";
    detectionReason: string;
    receivedAt?: string;
  }) => { ok: boolean; error?: string; spendingWallet: number };
}

export const useSavingsStore = create<SavingsState>((set, get) => ({
  allocationRule:     DEFAULT_RULE,
  userAllocationRule: DEFAULT_RULE,
  useAIAllocation:    false,
  manualIncomes:      [],
  roundUpEnabled:     true,
  roundUpTotal:       0,
  savingsBuckets:   { bonus: 0, emergency: 0, goals: 0 },
  manualActivities: [],
  pendingBonusBoost: 3,
  withdrawalHistory: [],
  roundUpDestination: "bonus",
  latestAutoAllocation: null,
  pendingBonusRewardName: undefined,
  pendingBonusRewardAmount: 0,
  pendingBonusProgress: 0,
  pendingBonusTarget: 0,

  setAllocationRule:     (rule)  => {
    set({ allocationRule: rule });
    maybePersistSavings();
  },
  setUserAllocationRule: (rule)  => {
    set({ userAllocationRule: rule });
    maybePersistSavings();
  },
  setUseAIAllocation:    (value) => {
    set({ useAIAllocation: value });
    maybePersistSavings();
  },

  addManualIncome: ({ amount, incomeType, description, applied }) => {
    const newEntry: ManualIncome = {
      id:               String(Date.now()),
      amount,
      incomeType,
      description:      description || INCOME_TYPE_DEFAULTS[incomeType],
      date:             new Date().toISOString().split("T")[0],
      allocationApplied:applied,
    };
    set((s) => ({ manualIncomes: [newEntry, ...s.manualIncomes] }));
    maybePersistSavings();
  },

  toggleRoundUp: () => {
    set((s) => ({ roundUpEnabled: !s.roundUpEnabled }));
    maybePersistSavings();
  },

  manualSave: (destination, amount) => {
    set((s) => ({
      savingsBuckets: {
        ...s.savingsBuckets,
        [destination]: Math.round((s.savingsBuckets[destination] + amount) * 100) / 100,
      },
      pendingBonusBoost:
        destination === "bonus"
          ? Math.round((s.pendingBonusBoost + Math.max(0, amount * 0.01)) * 100) / 100
          : s.pendingBonusBoost,
    }));
    maybePersistSavings();
  },

  withdrawFromBucket: (destination, amount) => {
    if (amount <= 0) return { ok: false, reason: "invalid_amount", didResetBonusBoost: false, remainingPendingBonusBoost: get().pendingBonusBoost };
    const state = get();
    const current = state.savingsBuckets[destination];
    if (amount > current) {
      return { ok: false, reason: "insufficient_balance", didResetBonusBoost: false, remainingPendingBonusBoost: state.pendingBonusBoost };
    }
    const isoNow = new Date().toISOString();
    const withdrawId = `sv-withdraw-${Date.now()}`;
    const didResetBonusBoost = destination === "bonus" && state.pendingBonusBoost > 0;
    const amtRounded = Math.round(amount * 100) / 100;
    const pocketLabel =
      destination === "bonus"
        ? "Bonus Pocket"
        : destination === "emergency"
          ? "Emergency Fund"
          : "Goals";
    set((s) => ({
      savingsBuckets: {
        ...s.savingsBuckets,
        [destination]: Math.round((s.savingsBuckets[destination] - amount) * 100) / 100,
      },
      pendingBonusBoost: destination === "bonus" ? 0 : s.pendingBonusBoost,
      manualActivities: [
        {
          id: withdrawId,
          label: `Withdrew RM${amtRounded.toFixed(2)} to Main Account`,
          pocket: pocketLabel,
          amount: amtRounded,
          date: isoNow.slice(0, 10),
          occurredAt: isoNow,
          type: "withdrawal",
        },
        ...s.manualActivities,
      ],
      withdrawalHistory: [
        {
          id: withdrawId,
          bucket: destination,
          amount: amtRounded,
          createdAt: isoNow,
          consequence:
            destination === "bonus"
              ? "bonus_boost_reset"
              : destination === "emergency"
                ? "emergency_buffer_reduced"
                : "goal_progress_reduced",
        },
        ...s.withdrawalHistory,
      ],
    }));
    maybePersistSavings();
    return { ok: true, didResetBonusBoost, remainingPendingBonusBoost: destination === "bonus" ? 0 : state.pendingBonusBoost };
  },

  setRoundUpDestination: (destination) => {
    set({ roundUpDestination: destination });
    maybePersistSavings();
  },

  applyRoundUp: (amount) => {
    const state = get();
    if (!state.roundUpEnabled || amount <= 0) return { ok: false, saved: 0 };
    const rounded = Math.ceil(amount);
    const roundUp = Math.round((rounded - amount) * 100) / 100;
    if (roundUp <= 0) return { ok: false, saved: 0 };
    const destination = state.roundUpDestination;
    set((s) => ({
      roundUpTotal: Math.round((s.roundUpTotal + roundUp) * 100) / 100,
      savingsBuckets: {
        ...s.savingsBuckets,
        [destination]: Math.round((s.savingsBuckets[destination] + roundUp) * 100) / 100,
      },
    }));
    return { ok: true, saved: roundUp };
  },

  addManualActivity: (entry) =>
    set((s) => ({ manualActivities: [entry, ...s.manualActivities] })),

  applyIncomeAutoAllocation: (input) => {
    const state = get();
    const effectiveRule = state.userAllocationRule ?? state.allocationRule ?? DEFAULT_RULE;
    const total = ruleTotal(effectiveRule);
    if (total !== 100) {
      return {
        ok: false,
        error: `Allocation rule must total 100%. Current total is ${total}%.`,
        spendingWallet: 0,
      };
    }

    const alloc = calcAllocation(input.amount, effectiveRule);
    const receivedAt = input.receivedAt ?? new Date().toISOString();
    const id = `auto-alloc-${Date.now()}`;

    set((s) => ({
      savingsBuckets: {
        bonus: Math.round((s.savingsBuckets.bonus + alloc.bonusPocket) * 100) / 100,
        emergency: Math.round((s.savingsBuckets.emergency + alloc.emergencyFund) * 100) / 100,
        goals: Math.round((s.savingsBuckets.goals + alloc.goalSavings) * 100) / 100,
      },
      manualActivities: [
        {
          id: `${id}-income`,
          label: `${input.incomeType === "salary" ? "Salary" : "Income"} received`,
          pocket: "Main Account",
          amount: input.amount,
          date: receivedAt.slice(0, 10),
          occurredAt: receivedAt,
          type: "auto",
        },
        {
          id: `${id}-alloc`,
          label: `Income auto-allocated`,
          pocket: "Savings",
          amount: alloc.bonusPocket + alloc.emergencyFund + alloc.goalSavings,
          date: receivedAt.slice(0, 10),
          occurredAt: receivedAt,
          type: "auto",
        },
        ...s.manualActivities,
      ],
      latestAutoAllocation: {
        id,
        receivedAt,
        amount: input.amount,
        incomeType: input.incomeType,
        source: input.source,
        description: input.description,
        confidence: input.confidence,
        detectionReason: input.detectionReason,
        ruleUsed: effectiveRule,
        breakdown: {
          spendingWallet: alloc.spendingWallet,
          bonus: alloc.bonusPocket,
          emergency: alloc.emergencyFund,
          goals: alloc.goalSavings,
        },
      },
    }));

    maybePersistSavings();
    return { ok: true, spendingWallet: alloc.spendingWallet };
  },
}));


const INCOME_TYPE_DEFAULTS: Record<IncomeType, string> = {
  salary:      "Salary income",
  allowance:   "Monthly allowance",
  part_time:   "Part-time income",
  freelance_income: "Freelance income",
  cash_income: "Cash income",
};
