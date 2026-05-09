import { create } from "zustand";
import { validateLoginInput } from "../features/auth/auth.rules";
import { resolveLoginRoute } from "../features/auth/auth.service";
import { validateNewPin, weakPinReason } from "../features/security/pin.rules";
import { STEP } from "../features/auth/onboarding.route";
import type { AuthState, AuthUser, FinancialProfile } from "../features/auth/auth.types";
import {
  fetchUsersProfile,
  mapProfileToAuthUser,
  supabaseSignIn,
  supabaseSignOut,
  supabaseSignUp,
  upsertProfileExtras,
  upsertFinancialProfileInDb,
} from "../features/auth/supabaseAuth.service";
import { createDefaultUserData } from "../services/db/userBootstrap";
import { hydrateUserDataStores } from "../services/db/hydrate";
import { resetAllDataStores } from "../services/db/resetStores";
import { persistPinHash } from "../services/db/persist";
import { hashAppPin } from "../services/db/pinCrypto";
import { getSupabase } from "../lib/supabase";
import { useSecurityStore } from "./securityStore";

const updateCurrentUser = (
  get: () => AuthState,
  set: (partial: Partial<AuthState> | ((state: AuthState) => Partial<AuthState>)) => void,
  patch: Partial<AuthUser>
) => {
  const user = get().currentUser;
  if (!user) return;
  const updated = { ...user, ...patch };
  set({ currentUser: updated });
};

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  users: [],
  isAuthenticated: false,

  login: async (input) => {
    const errors = validateLoginInput(input);
    const firstError = Object.values(errors)[0];
    if (firstError) return { ok: false, message: firstError };

    if (!getSupabase()) {
      return { ok: false, message: "SmartGX cloud is not configured. Check .env and restart Expo." };
    }

    const res = await supabaseSignIn(input);
    if (!res.ok) return { ok: false, message: res.message };

    const profile = await fetchUsersProfile(res.user.id);
    if (!profile) {
      return { ok: false, message: "Profile not found. Complete registration or contact support." };
    }

    const authUser = mapProfileToAuthUser(profile, res.user);
    const h = await hydrateUserDataStores(res.user.id);
    if (!h.ok && __DEV__) console.warn("[SmartGX] hydrate after login", h.message);

    set({ currentUser: authUser, isAuthenticated: true, users: [] });

    return { ok: true, nextRoute: resolveLoginRoute(authUser) };
  },

  register: async (input) => {
    if (!getSupabase()) {
      return { ok: false, message: "SmartGX cloud is not configured." };
    }

    const res = await supabaseSignUp(input);
    if (!res.ok) return { ok: false, message: res.message };

    if (!res.session) {
      return {
        ok: false,
        message:
          "Check your email to confirm your account before signing in. (You can disable email confirmation in Supabase Auth settings for development.)",
      };
    }

    const boot = await createDefaultUserData(res.user, input);
    if (!boot.ok) {
      return { ok: false, message: boot.message };
    }

    const profile = await fetchUsersProfile(res.user.id);
    if (!profile) return { ok: false, message: "Could not load new profile." };

    const authUser = mapProfileToAuthUser(profile, res.user);
    await hydrateUserDataStores(res.user.id);

    useSecurityStore.setState({ pinSetFromServer: false, serverPinHash: null });

    set({ currentUser: authUser, isAuthenticated: true, users: [] });

    return { ok: true };
  },

  logout: async () => {
    await supabaseSignOut();
    resetAllDataStores();
    useSecurityStore.setState({ pinSetFromServer: false, serverPinHash: null });
    set({ currentUser: null, isAuthenticated: false, users: [] });
  },

  verifyOtp: (otp) => {
    if (otp !== "123456") return { ok: false, message: "Incorrect OTP. Check the code sent to your device." };
    updateCurrentUser(get, set, {
      mobileVerificationStatus: "demo_verified",
      onboardingStep: STEP.MYKAD_SCAN,
    });
    const u = get().currentUser;
    if (u) {
      void upsertProfileExtras(u.id, {
        mobileVerificationStatus: "demo_verified",
        onboardingStep: STEP.MYKAD_SCAN,
      });
    }
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
    const u = get().currentUser;
    if (u) {
      void upsertProfileExtras(u.id, {
        identityVerificationStatus: "demo_verified",
        onboardingStep: STEP.SELFIE,
        mockNricLast4: data?.mockNricLast4,
        nationality: data?.nationality ?? "Malaysian",
        ageConfirmed: data?.ageConfirmed ?? true,
      });
    }
  },

  completeSelfieVerification: () => {
    updateCurrentUser(get, set, {
      selfieVerificationStatus: "demo_verified",
      onboardingStep: STEP.EKYC_STATUS,
    });
    const u = get().currentUser;
    if (u) void upsertProfileExtras(u.id, { selfieVerificationStatus: "demo_verified", onboardingStep: STEP.EKYC_STATUS });
  },

  completeEkycReview: () => {
    updateCurrentUser(get, set, { onboardingStep: STEP.FINANCIAL_PROFILE });
    const u = get().currentUser;
    if (u) void upsertProfileExtras(u.id, { onboardingStep: STEP.FINANCIAL_PROFILE });
  },

  completeFinancialProfile: (profile: FinancialProfile) => {
    updateCurrentUser(get, set, {
      financialProfile: profile,
      onboardingStep: STEP.SMARTGX_SETUP,
    });
    const u = get().currentUser;
    if (u) {
      void upsertFinancialProfileInDb(u.id, profile);
      void upsertProfileExtras(u.id, { financialProfile: profile, onboardingStep: STEP.SMARTGX_SETUP });
    }
  },

  completeSmartGXSetup: () => {
    updateCurrentUser(get, set, { onboardingStep: STEP.SECURITY_SETUP });
    const u = get().currentUser;
    if (u) void upsertProfileExtras(u.id, { onboardingStep: STEP.SECURITY_SETUP });
  },

  completeSecuritySetup: (passcode, biometricEnabled) => {
    updateCurrentUser(get, set, {
      passcode,
      biometricEnabled,
      securitySetupStatus: "completed",
      onboardingStep: STEP.ACTIVATION,
    });
    const u = get().currentUser;
    if (u) {
      void upsertProfileExtras(u.id, {
        biometricEnabled,
        securitySetupStatus: "completed",
        onboardingStep: STEP.ACTIVATION,
      });
      void (async () => {
        const hash = await hashAppPin(u.id, passcode);
        await persistPinHash(u.id, hash, true);
        useSecurityStore.setState({ pinSetFromServer: true, serverPinHash: hash });
      })();
    }
  },

  setAppPasscode: (passcode) => {
    const weak = weakPinReason(passcode);
    if (weak) return { ok: false, message: weak };
    const user = get().currentUser;
    if (!user) return { ok: false, message: "Not signed in." };
    updateCurrentUser(get, set, {
      passcode,
      securitySetupStatus: "completed",
    });
    void (async () => {
      const hash = await hashAppPin(user.id, passcode);
      await persistPinHash(user.id, hash, true);
      useSecurityStore.setState({ pinSetFromServer: true, serverPinHash: hash });
    })();
    return { ok: true };
  },

  changeAppPasscode: (currentPasscode, newPasscode, confirmNew) => {
    const user = get().currentUser;
    if (!user) return { ok: false, message: "Not signed in." };
    const err = validateNewPin(newPasscode, confirmNew, user.passcode ?? currentPasscode);
    if (err) return { ok: false, message: err };

    void (async () => {
      const hash = await hashAppPin(user.id, newPasscode);
      await persistPinHash(user.id, hash, true);
      useSecurityStore.setState({ serverPinHash: hash, pinSetFromServer: true });
    })();

    updateCurrentUser(get, set, { passcode: newPasscode });
    return { ok: true };
  },

  activateDemoAccount: () => {
    updateCurrentUser(get, set, {
      accountActivationStatus: "completed",
      onboardingStep: STEP.COMPLETE,
      hasCompletedOnboarding: true,
    });
    const u = get().currentUser;
    if (u) {
      void upsertProfileExtras(u.id, {
        accountActivationStatus: "completed",
        onboardingStep: STEP.COMPLETE,
        hasCompletedOnboarding: true,
      });
    }
  },
}));
