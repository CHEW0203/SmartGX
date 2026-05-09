import type { TransactionCategory } from "../types/transaction";

export type MerchantPaymentType = "contactless" | "online" | "overseas";

export interface MockMerchant {
  merchant: string;
  category: TransactionCategory;
  amount: number;
  paymentType: MerchantPaymentType;
}

export interface GeneratedTransaction extends MockMerchant {
  transactionDate: string;
  transactionTime: string;
}

const MERCHANTS: MockMerchant[] = [
  { merchant: "ZUS Coffee",          category: "food",          amount: 13.90, paymentType: "contactless" },
  { merchant: "Grab",                category: "transport",     amount: 18.00, paymentType: "online"      },
  { merchant: "Shopee",              category: "shopping",      amount: 86.50, paymentType: "online"      },
  { merchant: "Netflix",             category: "subscription",  amount: 45.00, paymentType: "online"      },
  { merchant: "Touch 'n Go Reload",  category: "transport",     amount: 50.00, paymentType: "online"      },
  { merchant: "Jaya Grocer",         category: "food",          amount: 74.20, paymentType: "contactless" },
  { merchant: "TNB Electricity",     category: "bills",         amount: 120.00,paymentType: "online"      },
  { merchant: "Unifi Home Broadband",category: "bills",         amount: 129.00,paymentType: "online"      },
  { merchant: "McDonald's",          category: "food",          amount: 24.50, paymentType: "contactless" },
  { merchant: "Starbucks KLCC",      category: "food",          amount: 22.00, paymentType: "contactless" },
  { merchant: "Watsons",             category: "shopping",      amount: 45.80, paymentType: "contactless" },
  { merchant: "KLCC Parking",        category: "transport",     amount: 15.00, paymentType: "contactless" },
  { merchant: "Aeon Big",            category: "food",          amount: 58.90, paymentType: "contactless" },
  { merchant: "GrabFood",            category: "food",          amount: 32.50, paymentType: "online"      },
  { merchant: "Steam",               category: "entertainment", amount: 49.00, paymentType: "online"      },
  { merchant: "Amazon US",           category: "shopping",      amount: 89.00, paymentType: "overseas"    },
  { merchant: "Spotify Premium",     category: "subscription",  amount: 15.90, paymentType: "online"      },
  { merchant: "Grab (Airport)",      category: "transport",     amount: 55.00, paymentType: "online"      },
  { merchant: "Decathlon",           category: "shopping",      amount: 67.00, paymentType: "contactless" },
  { merchant: "Udemy",               category: "education",     amount: 49.00, paymentType: "online"      },
];

// Module-level rotating index — cycles through merchants on each call
let _idx = 0;

export function generateMockTransaction(): GeneratedTransaction {
  const m = MERCHANTS[_idx % MERCHANTS.length];
  _idx = (_idx + 1) % MERCHANTS.length;

  // Always fall within REPORTING_MONTH (2026-05) for the prototype
  const transactionDate = "2026-05-08";
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2, "0");
  const mm  = String(now.getMinutes()).padStart(2, "0");
  const transactionTime = `${hh}:${mm}`;

  return { ...m, transactionDate, transactionTime };
}
