import { create } from "zustand";
import {
  createRegisteredUser,
  findUserByCredentials,
  getInitialMockUsers,
  resolveLoginRoute,
} from "../features/auth/auth.service";
import { validateLoginInput } from "../features/auth/auth.rules";
import { STEP } from "../features/auth/onboarding.route";
import type { AuthState, AuthUser, FinancialProfile } from "../features/auth/auth.types";

const updateCurrentUser = (
  get: () => AuthState,
  set: (partial: Partial<AuthState> | ((state: AuthState) => Partial<AuthState>)) => void,
  patch: Partial<AuthUser>
) => {
  const user = get().currentUser;
  if (!user) return;
  const updated = { ...user, ...patch };
  set((state) => ({
    currentUser: updated,
    users: state.users.map((u) => (u.id === updated.id ? updated : u)),
  }));
};

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  users: getInitialMockUsers(),
  isAuthenticated: false,

  login: (input) => {
    const errors = validateLoginInput(input);
    const firstError = Object.values(errors)[0];
    if (firstError) return { ok: false, message: firstError };

    const user = findUserByCredentials(get().users, input);
    if (!user) return { ok: false, message: "Incorrect email, mobile number, or password." };

    set({ currentUser: user, isAuthenticated: true });
    return { ok: true, nextRoute: resolveLoginRoute(user) };
  },

  register: (input) => {
    const emailLow = input.email.trim().toLowerCase();
    const mobileTrim = input.mobileNumber.replace(/\s/g, "");
    const exists = get().users.some(
      (u) => u.email === emailLow || u.mobileNumber.replace(/\s/g, "") === mobileTrim
    );
    if (exists) return { ok: false, message: "An account with this email or mobile number already exists." };

    const { user, error } = createRegisteredUser(input);
    if (!user) return { ok: false, message: error ?? "Registration failed." };

    set((state) => ({
      users: [...state.users, user],
      currentUser: user,
      isAuthenticated: true,
    }));
    return { ok: true };
  },

  logout: () => set({ currentUser: null, isAuthenticated: false }),

  verifyOtp: (otp) => {
    if (otp !== "123456") return { ok: false, message: "Incorrect OTP. Hint: use 123456." };
    updateCurrentUser(get, set, {
      mobileVerificationStatus: "demo_verified",
      onboardingStep: STEP.MYKAD_SCAN,
    });
    return { ok: true };
  },

  completeMyKadScan: (data) => {
    updateCurrentUser(get, set, {
      identityVerificationStatus: "demo_verified",
      onboardingStep: STEP.SELFIE,
      mockNricLast4: data?.mockNricLast4 ?? undefined,
      nationality: data?.nationality ?? "Malaysian",
      ageConfirmed: data?.ageConfirmed ?? true,
    });
  },

  completeSelfieVerification: () => {
    updateCurrentUser(get, set, {
      selfieVerificationStatus: "demo_verified",
      onboardingStep: STEP.EKYC_STATUS,
    });
  },

  completeEkycReview: () => {
    updateCurrentUser(get, set, {
      onboardingStep: STEP.FINANCIAL_PROFILE,
    });
  },

  completeFinancialProfile: (profile: FinancialProfile) => {
    updateCurrentUser(get, set, {
      financialProfile: profile,
      onboardingStep: STEP.SMARTGX_SETUP,
    });
  },

  completeSmartGXSetup: () => {
    updateCurrentUser(get, set, { onboardingStep: STEP.SECURITY_SETUP });
  },

  completeSecuritySetup: (passcode, biometricEnabled) => {
    updateCurrentUser(get, set, {
      passcode,
      biometricEnabled,
      securitySetupStatus: "completed",
      onboardingStep: STEP.ACTIVATION,
    });
  },

  activateDemoAccount: () => {
    updateCurrentUser(get, set, {
      accountActivationStatus: "completed",
      onboardingStep: STEP.COMPLETE,
      hasCompletedOnboarding: true,
    });
  },
}));
