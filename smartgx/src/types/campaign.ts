export interface Campaign {
  id: string;
  campaignName: string;
  campaignType: "saving" | "spending_control" | "security" | "debt_prevention";
  description: string;
  reward: string;
  progress: number;
  isCompleted: boolean;
}
