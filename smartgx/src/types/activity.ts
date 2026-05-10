export type ActivityType =
  | "receive_income"
  | "auto_allocation"
  | "transfer"
  | "scan_payment"
  | "tappay"
  | "manual_save"
  | "round_up_saving"
  | "add_money"
  | "card_control"
  | "save_instead"
  | "flexicredit_apply"
  | "flexicredit_approved"
  | "flexicredit_activated"
  | "flexicredit_drawdown"
  | "flexicredit_repayment"
  | "streak_milestone_reward"
  | "mission_completed"
  | "friend_added"
  | "money_tree_watered"
  | "money_tree_level_up"
  | "saving_withdrawal"
  | "security_pin"
  | "security_device"
  | "security_session"
  | "security_safety_check"
  | "security_scam_check"
  | "security_lock"
  | "challenge_started"
  | "challenge_reward";

export type ActivityDirection = "credit" | "debit";

export interface AppActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  amount?: number;
  direction?: ActivityDirection;
  timestamp: string;
  route?: string;
}

