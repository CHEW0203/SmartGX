export interface Account {
  id: string;
  userId: string;
  accountType: "gx_account" | "bonus_pocket" | "emergency_fund" | "goal_savings";
  balance: number;
}
