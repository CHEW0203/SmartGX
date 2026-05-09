export type NotificationType =
  | "info"
  | "alert"
  | "insight"
  | "security"
  | "risk"
  | "success"
  | "warning"
  | "reward"
  | "campaign";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: NotificationType;
  /** Optional route key for tapping the in-app toast (expo-router path). */
  linkedScreen?: string;
}
