import { create } from "zustand";
import { getAuthUserId, persistAccount } from "../services/db/persist";
import { DEFAULT_CREDIT_CARD_LIMIT, DEFAULT_DEBIT_DAILY_LIMIT } from "../features/card/cardSpend";

function maybePersistAccount() {
  const uid = getAuthUserId();
  if (uid) void persistAccount(uid);
}

interface AccountState {
  /** Debit Card available spending balance */
  mainBalance: number;
  /** FlexiCard total limit */
  flexiLimit: number;
  /** FlexiCard amount currently used */
  flexiUsed: number;
  /** Daily spending cap for debit / TapPay debit (not a separate balance). */
  debitDailyLimit: number;
  setDebitDailyLimit: (limit: number) => void;

  /** Attempt a Debit Card payment. Returns ok + reason on failure. */
  debitPay: (amount: number) => { ok: boolean; reason?: string };
  /** Attempt a FlexiCard payment. Returns ok + reason on failure. */
  flexiPay: (amount: number) => { ok: boolean; reason?: string };
  /** Repay My Card credit balance from Main Account (statement balance = flexiUsed). */
  repayFlexiCard: (amount: number) => { ok: boolean; reason?: string };
  /** Credit (add) money to the main balance — used by Add Money flow. */
  creditBalance: (amount: number) => void;
  /** FlexiCredit borrowing module (separate from card credit spending) */
  flexiCreditLimit: number;
  flexiCreditUsed: number;
  setFlexiCreditLimit: (limit: number) => void;
  drawdownFlexiCredit: (amount: number) => { ok: boolean; reason?: string };
  repayFlexiCredit: (amount: number, principalPortion?: number) => { ok: boolean; reason?: string };
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  // New account defaults (credit line for My Card TapPay demo)
  mainBalance: 50,
  flexiLimit:  DEFAULT_CREDIT_CARD_LIMIT,
  flexiUsed:   0,
  debitDailyLimit: DEFAULT_DEBIT_DAILY_LIMIT,
  flexiCreditLimit: 0,
  flexiCreditUsed: 0,

  setDebitDailyLimit: (limit) => {
    const n = Math.max(0, r2(limit));
    set({ debitDailyLimit: n });
  },

  debitPay: (amount) => {
    const { mainBalance } = get();
    if (amount > mainBalance) {
      return { ok: false, reason: "insufficient_balance" };
    }
    set({ mainBalance: r2(mainBalance - amount) });
    maybePersistAccount();
    return { ok: true };
  },

  flexiPay: (amount) => {
    const { flexiLimit, flexiUsed } = get();
    const available = r2(flexiLimit - flexiUsed);
    if (amount > available) {
      return { ok: false, reason: "insufficient_limit" };
    }
    set({ flexiUsed: r2(flexiUsed + amount) });
    maybePersistAccount();
    return { ok: true };
  },

  repayFlexiCard: (amount) => {
    const { flexiUsed, mainBalance } = get();
    if (amount <= 0) return { ok: false, reason: "invalid_amount" };
    if (flexiUsed <= 0) return { ok: false, reason: "nothing_to_repay" };
    const due = r2(flexiUsed);
    if (amount > due) return { ok: false, reason: "exceeds_repayment" };
    if (amount > mainBalance) return { ok: false, reason: "insufficient_balance" };
    set({
      mainBalance: r2(mainBalance - amount),
      flexiUsed: r2(flexiUsed - amount),
    });
    maybePersistAccount();
    return { ok: true };
  },

  creditBalance: (amount) => {
    const { mainBalance } = get();
    set({ mainBalance: r2(mainBalance + amount) });
    maybePersistAccount();
  },
  setFlexiCreditLimit: (limit) => {
    set({ flexiCreditLimit: Math.max(0, r2(limit)) });
    maybePersistAccount();
  },
  drawdownFlexiCredit: (amount) => {
    const { flexiCreditLimit, flexiCreditUsed, mainBalance } = get();
    if (amount <= 0) return { ok: false, reason: "invalid_amount" };
    const available = r2(flexiCreditLimit - flexiCreditUsed);
    if (amount > available) return { ok: false, reason: "insufficient_limit" };
    set({
      flexiCreditUsed: r2(flexiCreditUsed + amount),
      mainBalance: r2(mainBalance + amount),
    });
    maybePersistAccount();
    return { ok: true };
  },
  repayFlexiCredit: (amount, principalPortion) => {
    const { flexiCreditUsed, mainBalance } = get();
    if (amount <= 0) return { ok: false, reason: "invalid_amount" };
    if (amount > mainBalance) return { ok: false, reason: "insufficient_balance" };
    if (flexiCreditUsed <= 0) return { ok: false, reason: "nothing_to_repay" };
    const paid = Math.min(amount, mainBalance);
    const principalPaid =
      typeof principalPortion === "number"
        ? Math.max(0, Math.min(principalPortion, flexiCreditUsed))
        : Math.min(amount, flexiCreditUsed);
    set({
      mainBalance: r2(mainBalance - paid),
      flexiCreditUsed: r2(flexiCreditUsed - principalPaid),
    });
    maybePersistAccount();
    return { ok: true };
  },
}));
