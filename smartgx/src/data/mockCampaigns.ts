import type { Campaign } from "../types/campaign";

export const mockCampaigns: Campaign[] = [
  {
    id: "c-1",
    campaignName: "No Overspend Week",
    campaignType: "spending_control",
    description: "Stay within your daily spending safety zone for 7 days.",
    reward: "RM20 reward points booster",
    progress: 35,
    isCompleted: false,
  },
];
