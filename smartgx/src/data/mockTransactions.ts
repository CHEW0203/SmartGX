import type { Transaction } from "../types/transaction";

export const mockTransactions: Transaction[] = [
  {
    id: "t-1",
    userId: "u-freshgrad-001",
    merchant: "MyBurger KL Sentral",
    category: "food",
    amount: 24.5,
    paymentMethod: "gx_card",
    transactionDate: "2026-05-02",
    riskLevel: "medium",
    isSuspicious: false,
  },
  {
    id: "t-2",
    userId: "u-freshgrad-001",
    merchant: "LRT RapidKL",
    category: "transport",
    amount: 7.2,
    paymentMethod: "gx_card",
    transactionDate: "2026-05-03",
    riskLevel: "low",
    isSuspicious: false,
  },
];
