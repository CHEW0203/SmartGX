import type { Account } from "../types/account";

export const mockAccounts: Account[] = [
  { id: "a-1", userId: "u-freshgrad-001", accountType: "gx_account", balance: 3000 },
  { id: "a-2", userId: "u-freshgrad-001", accountType: "bonus_pocket", balance: 600 },
  { id: "a-3", userId: "u-freshgrad-001", accountType: "emergency_fund", balance: 300 },
  { id: "a-4", userId: "u-freshgrad-001", accountType: "goal_savings", balance: 300 },
];
