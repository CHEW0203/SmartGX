import type { RiskLevel } from "./risk";

export interface SecurityEvent {
  id: string;
  userId: string;
  eventType: "suspicious_merchant" | "device_risk" | "scam_alert";
  severity: RiskLevel;
  message: string;
  createdAt: string;
}
