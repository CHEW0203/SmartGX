import type { AuthUser } from "../auth/auth.types";
import type { SecurityState } from "../../store/securityStore";
import { weakPinReason } from "./pin.rules";

/** Fields from `SecurityState` used for scoring (no methods). */
export type SecurityScoreSnapshot = Pick<
  SecurityState,
  | "deviceTrusted"
  | "emergencyLock"
  | "transactionAlertsEnabled"
  | "biometricEnabledLocal"
  | "mockSuspiciousSession"
  | "mockRiskyLinkFlag"
  | "safetyCheckStatus"
  | "wrongPinAttempts"
  | "sensitiveLockUntil"
  | "lastScamCheck"
>;

export type SecurityStatusLabel = "Protected" | "Needs Attention" | "At Risk" | "Critical";

export function securityStatusFromScore(score: number): SecurityStatusLabel {
  if (score >= 80) return "Protected";
  if (score >= 60) return "Needs Attention";
  if (score >= 40) return "At Risk";
  return "Critical";
}

export interface SecurityScoreBreakdown {
  pinProtection: string;
  deviceTrust: string;
  safetyCheck: string;
  scamProtection: string;
  transactionAlerts: string;
  emergencyLockLabel: string;
  recentRisk: string;
}

/** 0–100 score with human-readable breakdown rows for Security Center. */
export function computeSecurityScoreDetail(
  user: AuthUser | null,
  sec: SecurityScoreSnapshot
): { score: number; status: SecurityStatusLabel; breakdown: SecurityScoreBreakdown; factors: string[] } {
  const factors: string[] = [];
  let score = 0;
  const pin = user?.passcode;
  const pinOk = Boolean(pin && pin.length === 6 && /^\d{6}$/.test(pin));
  const pinWeak = pinOk && weakPinReason(pin!);

  let pinProtection = "Not set";
  if (pinOk) {
    score += 20;
    factors.push("PIN is set");
    if (!pinWeak) {
      score += 15;
      pinProtection = "Strong";
    } else {
      score -= 12;
      pinProtection = "Weak pattern";
      factors.push("PIN uses a weak or predictable pattern");
    }
  }

  let deviceTrust = "Not trusted";
  if (sec.deviceTrusted) {
    score += 15;
    deviceTrust = "Trusted";
    factors.push("Trusted device");
  }

  let safetyCheck = "Not run yet";
  if (sec.safetyCheckStatus === "safe") {
    score += 15;
    safetyCheck = "Passed";
    factors.push("Device Safety Check passed");
  } else if (sec.safetyCheckStatus === "attention") {
    score += 8;
    safetyCheck = "Needs review";
  } else if (sec.safetyCheckStatus === "risk") {
    score -= 20;
    safetyCheck = "Risk flagged";
    factors.push("Safety Check reported risk signals");
  }

  let scamProtection = "Not checked recently";
  if (sec.lastScamCheck) {
    if (sec.lastScamCheck.risk === "low") {
      score += 10;
      scamProtection = "Last check: low risk";
    } else if (sec.lastScamCheck.risk === "medium") {
      score -= 5;
      scamProtection = "Last check: medium risk";
      factors.push("Recent scam check showed medium risk");
    } else {
      score -= 10;
      scamProtection = "High risk message flagged";
      factors.push("High-risk scam pattern recently detected");
    }
  } else {
    score += 4;
    scamProtection = "Use Scam Check when needed";
  }

  let transactionAlerts = "Off";
  if (sec.transactionAlertsEnabled) {
    score += 10;
    transactionAlerts = "On";
    factors.push("Transaction alerts enabled");
  }

  let emergencyLockLabel = "Available (off)";
  if (sec.emergencyLock) {
    score -= 10;
    emergencyLockLabel = "Active — critical";
    factors.push("Emergency Lock is on");
  } else {
    score += 5;
  }

  const lockoutActive = Date.now() < sec.sensitiveLockUntil;
  let recentRisk = "None";
  if (sec.wrongPinAttempts === 0 && !lockoutActive) {
    score += 10;
  } else {
    const pen = Math.min(20, 10 + sec.wrongPinAttempts * 3);
    score -= pen;
    recentRisk = lockoutActive ? "PIN temporarily limited" : `${sec.wrongPinAttempts} incorrect PIN attempt(s)`;
    factors.push("Recent PIN risk");
  }

  if (sec.mockSuspiciousSession) {
    score -= 20;
    recentRisk = "Suspicious session pattern";
    factors.push("Suspicious device/session flag");
  }

  if (sec.mockRiskyLinkFlag) {
    score -= 10;
    if (recentRisk === "None") recentRisk = "Risky link flagged";
    factors.push("Risky link flag enabled");
  }

  if (user?.biometricEnabled || sec.biometricEnabledLocal) {
    score += 5;
    factors.push("Biometric sign-in on device");
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score: clamped,
    status: securityStatusFromScore(clamped),
    breakdown: {
      pinProtection,
      deviceTrust,
      safetyCheck,
      scamProtection,
      transactionAlerts,
      emergencyLockLabel,
      recentRisk,
    },
    factors,
  };
}

/** @deprecated Prefer `computeSecurityScoreDetail` for UI; kept for quick score-only use. */
export function computeSecurityScore(user: AuthUser | null, sec: SecurityScoreSnapshot) {
  const d = computeSecurityScoreDetail(user, sec);
  return { score: d.score, status: d.status, factors: d.factors };
}
