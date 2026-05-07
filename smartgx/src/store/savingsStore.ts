import { create } from "zustand";
import { DEFAULT_RULE } from "../features/savings/savings.engine";
import type { AllocationRule, IncomeType, ManualIncome } from "../features/savings/savings.types";

interface SavingsState {
  /** Currently active allocation rule (may be AI-applied or manual) */
  allocationRule: AllocationRule;
  /** Last manually confirmed allocation rule — restored when AI is turned off */
  userAllocationRule: AllocationRule;
  /** Whether the AI-customized allocation toggle is ON */
  useAIAllocation: boolean;
  /** Manually added income records */
  manualIncomes: ManualIncome[];
  /** Whether round-up saving is enabled */
  roundUpEnabled: boolean;
  /** Accumulated round-up total (added to as round-ups are detected) */
  roundUpTotal: number;

  setAllocationRule: (rule: AllocationRule) => void;
  /** Call this only when the user manually confirms a rule (not AI apply) */
  setUserAllocationRule: (rule: AllocationRule) => void;
  setUseAIAllocation: (value: boolean) => void;
  addManualIncome: (entry: {
    amount:      number;
    incomeType:  IncomeType;
    description: string;
    applied:     boolean;
  }) => void;
  toggleRoundUp: () => void;
}

export const useSavingsStore = create<SavingsState>((set, get) => ({
  allocationRule:     DEFAULT_RULE,
  userAllocationRule: DEFAULT_RULE,
  useAIAllocation:    false,
  manualIncomes:      [],
  roundUpEnabled:     true,
  roundUpTotal:       5.05, // pre-seeded with the mock round-up total

  setAllocationRule:     (rule)  => set({ allocationRule: rule }),
  setUserAllocationRule: (rule)  => set({ userAllocationRule: rule }),
  setUseAIAllocation:    (value) => set({ useAIAllocation: value }),

  addManualIncome: ({ amount, incomeType, description, applied }) => {
    const newEntry: ManualIncome = {
      id:                String(Date.now()),
      amount,
      incomeType,
      description:        description || INCOME_TYPE_DEFAULTS[incomeType],
      date:               new Date().toISOString().split("T")[0],
      allocationApplied:  applied,
    };
    set((s) => ({ manualIncomes: [newEntry, ...s.manualIncomes] }));
  },

  toggleRoundUp: () => set((s) => ({ roundUpEnabled: !s.roundUpEnabled })),
}));

const INCOME_TYPE_DEFAULTS: Record<IncomeType, string> = {
  salary:      "Salary income",
  allowance:   "Monthly allowance",
  part_time:   "Part-time income",
  cash_income: "Cash income",
};
