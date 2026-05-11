import { create } from "zustand";
import type { ActivityType } from "../types/activity";
import { syncSecurity } from "../services/db/persist";
import { useActivityStore } from "./activityStore";
import { useNotificationStore } from "./notificationStore";

function getAuthStore() {
  return require("./authStore").useAuthStore as typeof import("./authStore").useAuthStore;
}

export type SafetyCheckStatus = "idle" | "running" | "safe" | "attention" | "risk";

export interface SafetyCheckItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export type ScamRiskLevel = "low" | "medium" | "high";

export interface ScamAnalysisResult {
  risk: ScamRiskLevel;
  explanation: string;
  recommendation: string;
  signals: string[];
  provider?: "gemini" | "fallback";
  redFlags?: string[];
  avoidDoing?: string[];
}

const LOCK_MS = 5 * 60 * 1000;
const MAX_FAIL = 3;

function nowIso() {
  return new Date().toISOString();
}

export interface SecurityState {
  /** True when a PIN hash exists in Supabase for this user (session may not hold plaintext PIN). */
  pinSetFromServer: boolean;
  /** SHA-256 hash from server; used to verify PIN when plaintext not in memory. */
  serverPinHash: string | null;
  wrongPinAttempts: number;
  sensitiveLockUntil: number;
  emergencyLock: boolean;
  deviceTrusted: boolean;
  transactionAlertsEnabled: boolean;
  biometricEnabledLocal: boolean;
  lastLoginAt: string;
  deviceLabel: string;
  deviceLocationLabel: string;
  lastSafetyCheckAt: string | null;
  safetyCheckStatus: SafetyCheckStatus;
  safetyCheckItems: SafetyCheckItem[];
  mockSuspiciousSession: boolean;
  mockRiskyLinkFlag: boolean;
  lastScamCheck: ScamAnalysisResult | null;

  recordFailedPinAttempt: () => void;
  clearPinFailures: () => void;
  resetSensitiveLockFromForgot: () => void;
  setEmergencyLock: (locked: boolean) => void;
  setDeviceTrusted: (trusted: boolean) => void;
  setTransactionAlertsEnabled: (on: boolean) => void;
  setBiometricEnabledLocal: (on: boolean) => void;
  logoutOtherDevicesMock: () => void;
  setSafetyCheckResult: (status: Exclude<SafetyCheckStatus, "idle" | "running">, items: SafetyCheckItem[]) => void;
  setSafetyCheckRunning: () => void;
  setLastScamCheck: (r: ScamAnalysisResult | null) => void;
  setMockSuspiciousSession: (v: boolean) => void;
  setMockRiskyLinkFlag: (v: boolean) => void;
  touchLogin: () => void;
}

function securityNotify(title: string, message: string, type: "info" | "alert" | "insight" = "info") {
  useNotificationStore.getState().addNotification({
    id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    message,
    time: "Just now",
    read: false,
    type,
  });
}

function securityActivity(type: ActivityType, title: string, description: string, route = "/security") {
  useActivityStore.getState().addActivity({
    id: `act-sec-${Date.now()}`,
    type,
    title,
    description,
    timestamp: nowIso(),
    route,
  });
}

export const useSecurityStore = create<SecurityState>((set, get) => ({
  pinSetFromServer: false,
  serverPinHash: null,
  wrongPinAttempts: 0,
  sensitiveLockUntil: 0,
  emergencyLock: false,
  deviceTrusted: true,
  transactionAlertsEnabled: true,
  biometricEnabledLocal: false,
  lastLoginAt: nowIso(),
  deviceLabel: "This device",
  deviceLocationLabel: "Malaysia",
  lastSafetyCheckAt: null,
  safetyCheckStatus: "idle",
  safetyCheckItems: [],
  mockSuspiciousSession: false,
  mockRiskyLinkFlag: false,
  lastScamCheck: null,

  recordFailedPinAttempt: () => {
    const next = get().wrongPinAttempts + 1;
    if (next >= MAX_FAIL) {
      const until = Date.now() + LOCK_MS;
      set({ wrongPinAttempts: next, sensitiveLockUntil: until });
      securityNotify("Sign-in protection", "Too many incorrect PIN attempts. Sensitive actions are temporarily limited.", "alert");
      securityActivity("security_pin", "PIN attempts", "Multiple incorrect PIN entries. Review Security Center.");
    } else {
      set({ wrongPinAttempts: next });
    }
    syncSecurity();
  },

  clearPinFailures: () => {
    set({ wrongPinAttempts: 0, sensitiveLockUntil: 0 });
    syncSecurity();
  },

  resetSensitiveLockFromForgot: () => set({ wrongPinAttempts: 0, sensitiveLockUntil: 0 }),

  setEmergencyLock: (locked) => {
    set({ emergencyLock: locked });
    if (locked) {
      securityNotify("Emergency Lock on", "Transfers, scan payments, and card payments are paused.", "alert");
      securityActivity("security_lock", "Emergency Lock activated", "Your account controls are in lockdown mode.");
    } else {
      securityNotify("Emergency Lock off", "Sensitive actions are available again after PIN verification.", "info");
      securityActivity("security_lock", "Emergency Lock cleared", "Protection mode disabled.");
    }
    syncSecurity();
  },

  setDeviceTrusted: (trusted) => {
    set({ deviceTrusted: trusted });
    securityNotify(trusted ? "Device trusted" : "Device untrusted", trusted ? "This device is marked as trusted." : "Extra checks may apply on this device.", "info");
    securityActivity("security_device", trusted ? "Trusted device" : "Device trust removed", trusted ? "You marked this device as trusted." : "Trust was removed for this device.");
    syncSecurity();
  },

  setTransactionAlertsEnabled: (on) => {
    set({ transactionAlertsEnabled: on });
    securityNotify("Transaction alerts", on ? "Alerts enabled for sensitive activity." : "Transaction alerts turned off.", "info");
  },

  setBiometricEnabledLocal: (on) => {
    set({ biometricEnabledLocal: on });
    const auth = getAuthStore();
    const user = auth.getState().currentUser;
    if (user) {
      auth.setState((s) => ({
        currentUser: s.currentUser ? { ...s.currentUser, biometricEnabled: on } : null,
        users: s.users.map((u) => (u.id === user.id ? { ...u, biometricEnabled: on } : u)),
      }));
    }
  },

  logoutOtherDevicesMock: () => {
    securityNotify("Sessions", "Other sessions were signed out from this device.", "info");
    securityActivity("security_session", "Other sessions ended", "You signed out other active sessions.");
  },

  setSafetyCheckRunning: () => set({ safetyCheckStatus: "running" }),

  setSafetyCheckResult: (status, items) => {
    set({
      safetyCheckStatus: status,
      safetyCheckItems: items,
      lastSafetyCheckAt: nowIso(),
    });
    const title = status === "safe" ? "Device Safety Check" : status === "attention" ? "Safety check: review" : "Safety check: risk signals";
    securityNotify(title, "Open Security Center to review details.", status === "risk" ? "alert" : "insight");
    securityActivity("security_safety_check", "Device Safety Check completed", `Result: ${status}`);
  },

  setLastScamCheck: (r) => set({ lastScamCheck: r }),

  setMockSuspiciousSession: (v) => set({ mockSuspiciousSession: v }),

  setMockRiskyLinkFlag: (v) => set({ mockRiskyLinkFlag: v }),

  touchLogin: () => set({ lastLoginAt: nowIso() }),
}));

/** Returns null if action allowed, else error message for UI. */
export function sensitiveActionBlockedMessage(): string | null {
  const sec = useSecurityStore.getState();
  if (sec.emergencyLock) return "Emergency Lock is on. Unlock in Security Center.";
  if (Date.now() < sec.sensitiveLockUntil) {
    const mins = Math.ceil((sec.sensitiveLockUntil - Date.now()) / 60000);
    return `Too many incorrect PINs. Try again in ${mins} min or reset PIN.`;
  }
  return null;
}

export function userHasPinSet(): boolean {
  const sec = useSecurityStore.getState();
  if (sec.pinSetFromServer) return true;
  if (typeof sec.serverPinHash === "string" && sec.serverPinHash.length > 0) return true;
  const p = getAuthStore().getState().currentUser?.passcode;
  return typeof p === "string" && p.length === 6 && /^\d{6}$/.test(p);
}
