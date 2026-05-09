import { create } from "zustand";
import { randomUUIDCompat } from "../lib/uuid";
import type { Transaction } from "../types/transaction";
import { syncTransaction } from "../services/db/persist";

interface TransactionState {
  transactions: Transaction[];
  addTransaction: (txn: Transaction) => void;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  addTransaction: (txn) => {
    const id = UUID_RE.test(txn.id) ? txn.id : randomUUIDCompat();
    const next = { ...txn, id };
    set((s) => ({ transactions: [next, ...s.transactions] }));
    syncTransaction(next);
  },
}));
