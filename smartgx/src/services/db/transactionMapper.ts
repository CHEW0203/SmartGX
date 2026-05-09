import type { Transaction } from "../../types/transaction";
import type { RiskLevel } from "../../types/risk";

export interface DbTransactionRow {
  id: string;
  user_id: string;
  type: string;
  category: string | null;
  title: string;
  description: string | null;
  amount: number;
  direction: string | null;
  source: string | null;
  destination: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function dbRowToTransaction(row: DbTransactionRow, userId: string): Transaction {
  const m = (row.metadata ?? {}) as Record<string, unknown>;
  const embedded = (m.smartgx_txn as Partial<Transaction> | undefined) ?? {};
  return {
    id: row.id,
    userId,
    merchant: embedded.merchant ?? row.title,
    category: (embedded.category ?? row.category ?? "others") as Transaction["category"],
    amount: typeof embedded.amount === "number" ? embedded.amount : Number(row.amount),
    type: (embedded.type ?? row.type) as Transaction["type"],
    paymentMethod: (embedded.paymentMethod ?? "gx_card") as Transaction["paymentMethod"],
    transactionDate: embedded.transactionDate ?? row.created_at.slice(0, 10),
    riskLevel: (embedded.riskLevel ?? "low") as RiskLevel,
    isSuspicious: Boolean(embedded.isSuspicious),
    isSubscription: embedded.isSubscription,
    note: embedded.note ?? row.description ?? undefined,
    sourceAction: embedded.sourceAction,
    occurredAt: embedded.occurredAt ?? row.created_at,
    incomeType: embedded.incomeType,
    incomeSource: embedded.incomeSource,
    incomeDescription: embedded.incomeDescription,
    incomeConfidence: embedded.incomeConfidence,
    classificationReason: embedded.classificationReason,
    allocationApplied: embedded.allocationApplied,
    allocationBreakdown: embedded.allocationBreakdown,
  };
}

export function transactionToDbInsert(txn: Transaction, userId: string) {
  const direction =
    txn.type === "income" ? "credit" : txn.type === "repayment" ? "debit" : "debit";
  return {
    id: txn.id,
    user_id: userId,
    type: txn.type,
    category: txn.category,
    title: txn.merchant,
    description: txn.note ?? null,
    amount: txn.amount,
    direction,
    source: txn.incomeSource ?? null,
    destination: null,
    metadata: { smartgx_txn: txn },
  };
}

export function filterTransactionsNotFuture(transactions: Transaction[]): Transaction[] {
  const now = Date.now();
  return transactions.filter((t) => {
    const ts = t.occurredAt ? Date.parse(t.occurredAt) : Date.parse(`${t.transactionDate}T23:59:59`);
    return !Number.isNaN(ts) && ts <= now;
  });
}
