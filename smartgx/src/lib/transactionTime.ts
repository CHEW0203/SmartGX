import type { Transaction } from "../types/transaction";

/** Sort/key time for ordering: uses occurredAt when set, otherwise local noon on transactionDate. */
export function transactionOccurredMs(t: Transaction): number {
  if (t.occurredAt) {
    const ms = Date.parse(t.occurredAt);
    return Number.isNaN(ms) ? 0 : ms;
  }
  const parts = t.transactionDate?.split("-").map(Number);
  if (!parts || parts.length !== 3) return 0;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

/** Transaction history should only include items that occurred on or before now. */
export function isPastOrPresentTransaction(t: Transaction, nowMs = Date.now()): boolean {
  return transactionOccurredMs(t) <= nowMs;
}

export function visibleHistoryTransactions(txns: Transaction[], nowMs = Date.now()): Transaction[] {
  return txns.filter((t) => isPastOrPresentTransaction(t, nowMs));
}
