import type { Transaction } from "../../types/transaction";

export const DEFAULT_DEBIT_DAILY_LIMIT = 2000;
export const DEFAULT_CREDIT_CARD_LIMIT = 3000;

export function clampPercent(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

/** Safe 0–100 display percent; non-finite input returns fallback. */
export function safePercent(value: unknown, fallback = 0): number {
  let n: number;
  if (typeof value === "number" && Number.isFinite(value)) n = value;
  else if (typeof value === "string" && value.trim() !== "") {
    const p = Number(value);
    n = Number.isFinite(p) ? p : NaN;
  } else n = NaN;
  if (!Number.isFinite(n)) return fallback;
  return clampPercent(n);
}

export function safeMoney(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** True if this transaction counts as a TapPay debit card spend for daily limits. */
export function isTapPayDebitExpense(t: Transaction): boolean {
  if (t.userId == null || t.userId === "") return false;
  if (t.type !== "expense") return false;
  if (t.paymentMethod !== "gx_card") return false;
  if (t.sourceAction !== "tappay") return false;
  if (t.tapPaySource === "debit") return true;
  if (t.tapPaySource === "flexicard") return false;
  return (t.note ?? "").toLowerCase().includes("debit card");
}

/** Sum TapPay debit spends for a calendar day (YYYY-MM-DD). */
export function sumDebitTapPaySpendForDay(
  transactions: Transaction[],
  userId: string,
  dayYmd: string
): number {
  if (!userId) return 0;
  let sum = 0;
  for (const t of transactions) {
    if (t.transactionDate !== dayYmd) continue;
    if (!isTapPayDebitExpense(t)) continue;
    const a = safeMoney(t.amount, 0);
    if (a > 0) sum += a;
  }
  return Math.round(sum * 100) / 100;
}

export function remainingDebitDailyLimit(dailyLimit: number, todaySpent: number): number {
  const lim = Math.max(0, safeMoney(dailyLimit, DEFAULT_DEBIT_DAILY_LIMIT));
  const spent = Math.max(0, safeMoney(todaySpent, 0));
  return Math.max(0, Math.round((lim - spent) * 100) / 100);
}

export function availableDebitSpending(mainBalance: number, dailyLimit: number, todaySpent: number): number {
  const main = Math.max(0, safeMoney(mainBalance, 0));
  const rem = remainingDebitDailyLimit(dailyLimit, todaySpent);
  return Math.min(main, rem);
}

export function dailyDebitProgressPercent(dailyLimit: number, todaySpent: number): number {
  const lim = Math.max(0, safeMoney(dailyLimit, DEFAULT_DEBIT_DAILY_LIMIT));
  if (lim <= 0) return 0;
  const spent = Math.max(0, safeMoney(todaySpent, 0));
  return clampPercent((spent / lim) * 100);
}

export function computeCreditMinPayment(repaymentDue: number): number {
  const d = Math.max(0, safeMoney(repaymentDue, 0));
  if (d <= 0) return 0;
  return Math.max(50, Math.round(d * 0.05 * 100) / 100);
}

export function creditUsagePercent(usedCredit: number, creditLimit: number): number {
  const lim = Math.max(0, safeMoney(creditLimit, 0));
  if (lim <= 0) return 0;
  const u = Math.max(0, safeMoney(usedCredit, 0));
  return clampPercent((u / lim) * 100);
}

/** Billing window: current month cycle + payment due on 15th of next month. */
export function computeCreditBillingWindow(ref = new Date()): {
  billingCycleStart: string;
  billingCycleEnd: string;
  paymentDueDate: string;
} {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const billingCycleStart = `${y}-${pad(m + 1)}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const billingCycleEnd = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
  const due = new Date(y, m + 1, 15);
  const paymentDueDate = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-15`;
  return { billingCycleStart, billingCycleEnd, paymentDueDate };
}

export function formatBillingDateShort(iso: string): string {
  if (!iso || typeof iso !== "string") return "—";
  const [y, mo, d] = iso.split("-").map((x) => Number(x));
  if (!y || !mo || !d) return iso;
  try {
    const dt = new Date(y, mo - 1, d);
    return dt.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}
