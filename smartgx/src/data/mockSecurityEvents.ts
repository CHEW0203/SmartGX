import type { SecurityEvent } from "../types/security";

export const mockSecurityEvents: SecurityEvent[] = [
  {
    id: "se-1",
    userId: "u-freshgrad-001",
    eventType: "suspicious_merchant",
    severity: "medium",
    message: "Unusual merchant pattern detected for late-night online purchase.",
    createdAt: "2026-05-04T21:32:00Z",
  },
];
