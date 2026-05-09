import type { AppNotification } from "../types/notification";

export const mockNotificationData: AppNotification[] = [
  {
    id: "notif-1",
    title: "Salary auto-allocation completed",
    message:
      "RM3,500 received on 1 May 2026. SmartGX has auto-allocated RM1,050 to your savings pockets based on your 30% savings rule.",
    time: "1 May 2026 · 09:15 AM",
    read: false,
    type: "info",
  },
  {
    id: "notif-2",
    title: "SmartGX Insight available",
    message:
      "Your May spending analysis is ready. You have 4 active subscriptions totalling RM130.80/month. Reviewing unused services could free up extra savings.",
    time: "8 May 2026 · 01:00 AM",
    read: false,
    type: "insight",
  },
  {
    id: "notif-3",
    title: "Security reminder",
    message:
      "You have not updated your security PIN in 90 days. We recommend updating your PIN regularly to keep your account safe.",
    time: "5 May 2026 · 10:00 AM",
    read: false,
    type: "security",
  },
  {
    id: "notif-4",
    title: "Credit limit reminder",
    message:
      "Your Credit has RM3,750 in available credit. A repayment of RM625 is due on 1 June 2026. Plan ahead to avoid late charges.",
    time: "7 May 2026 · 08:00 AM",
    read: true,
    type: "alert",
  },
  {
    id: "notif-5",
    title: "Card control updated",
    message:
      "Online payments were enabled on your Debit Card on 1 May 2026. If this was not you, contact SmartGX support immediately.",
    time: "1 May 2026 · 09:20 AM",
    read: true,
    type: "alert",
  },
];
