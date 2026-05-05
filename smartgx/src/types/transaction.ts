import type { RiskLevel } from "./risk";

export interface Transaction {
  id: string;
  userId: string;
  merchant: string;
  category: "food" | "transport" | "shopping" | "bills" | "education" | "entertainment";
  amount: number;
  paymentMethod: "gx_card" | "online_transfer";
  transactionDate: string;
  riskLevel: RiskLevel;
  isSuspicious: boolean;
}
