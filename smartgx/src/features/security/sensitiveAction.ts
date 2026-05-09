import { useAuthStore } from "../../store/authStore";
import { sensitiveActionBlockedMessage, useSecurityStore, userHasPinSet } from "../../store/securityStore";
import { verifyAppPin } from "../../services/db/pinCrypto";

export type PinVerifyResult = { ok: true } | { ok: false; message: string };

/** Verify 6-digit PIN for transfers, scan pay, card, FlexiCredit, withdrawals. */
export async function verifyUserPin(entered: string): Promise<PinVerifyResult> {
  if (!userHasPinSet()) {
    return { ok: false, message: "Set up your SmartGX PIN in Security Center first." };
  }
  const block = sensitiveActionBlockedMessage();
  if (block) return { ok: false, message: block };

  const user = useAuthStore.getState().currentUser;
  if (!user) return { ok: false, message: "Not signed in." };

  const mem = user.passcode;
  if (mem && entered === mem) {
    useSecurityStore.getState().clearPinFailures();
    return { ok: true };
  }

  const hash = useSecurityStore.getState().serverPinHash;
  if (hash) {
    const ok = await verifyAppPin(user.id, entered, hash);
    if (ok) {
      useAuthStore.setState((s) => ({
        currentUser: s.currentUser ? { ...s.currentUser, passcode: entered } : null,
      }));
      useSecurityStore.getState().clearPinFailures();
      return { ok: true };
    }
  }

  useSecurityStore.getState().recordFailedPinAttempt();
  return { ok: false, message: "Incorrect PIN." };
}

export function pinRequiredRedirect(): "/auth/app-pin-setup" | null {
  if (!userHasPinSet()) return "/auth/app-pin-setup";
  return null;
}

export async function verifyEmergencyUnlockPin(entered: string): Promise<PinVerifyResult> {
  if (!userHasPinSet()) {
    return { ok: false, message: "Set up your SmartGX PIN in Security Center first." };
  }
  const sec = useSecurityStore.getState();
  if (Date.now() < sec.sensitiveLockUntil) {
    const mins = Math.ceil((sec.sensitiveLockUntil - Date.now()) / 60000);
    return { ok: false, message: `Too many incorrect PINs. Try again in ${mins} min or reset PIN.` };
  }

  const user = useAuthStore.getState().currentUser;
  if (!user) return { ok: false, message: "Not signed in." };

  const mem = user.passcode;
  if (mem && entered === mem) {
    useSecurityStore.getState().clearPinFailures();
    return { ok: true };
  }

  const hash = useSecurityStore.getState().serverPinHash;
  if (hash) {
    const ok = await verifyAppPin(user.id, entered, hash);
    if (ok) {
      useAuthStore.setState((s) => ({
        currentUser: s.currentUser ? { ...s.currentUser, passcode: entered } : null,
      }));
      useSecurityStore.getState().clearPinFailures();
      return { ok: true };
    }
  }

  useSecurityStore.getState().recordFailedPinAttempt();
  return { ok: false, message: "Incorrect PIN. Emergency Lock stays on." };
}
