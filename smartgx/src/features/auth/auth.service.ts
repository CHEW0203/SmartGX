import { validateRegisterInput } from "./auth.rules";
import { getOnboardingRoute, STEP } from "./onboarding.route";
import type { AuthUser, LoginInput, RegisterInput } from "./auth.types";
import { useSecurityStore } from "../../store/securityStore";

export const getInitialMockUsers = (): AuthUser[] => [];

export const findUserByCredentials = (
  users: AuthUser[],
  input: LoginInput
): AuthUser | null => {
  const id = input.emailOrMobile.trim().toLowerCase();
  return (
    users.find(
      (item) =>
        (item.email.toLowerCase() === id ||
          item.mobileNumber.replace(/\s/g, "") === id) &&
        item.password === input.password
    ) ?? null
  );
};

export const resolveLoginRoute = (user: AuthUser): string => {
  if (!user.hasCompletedOnboarding) return getOnboardingRoute(user.onboardingStep);
  if (useSecurityStore.getState().pinSetFromServer) return "/dashboard";
  const pin = user.passcode;
  if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) return "/auth/app-pin-setup";
  return "/dashboard";
};

export const createRegisteredUser = (
  input: RegisterInput
): { user?: AuthUser; error?: string } => {
  const validation = validateRegisterInput(input);
  const firstError = Object.values(validation)[0];
  if (firstError) return { error: firstError };

  const user: AuthUser = {
    id: `u-${Date.now()}`,
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    mobileNumber: input.mobileNumber.trim(),
    onboardingStep: STEP.VERIFY_OTP, // just completed step 2
    hasCompletedOnboarding: false,
    mobileVerificationStatus: "not_started",
    identityVerificationStatus: "not_started",
    selfieVerificationStatus: "not_started",
    securitySetupStatus: "not_started",
    accountActivationStatus: "not_started",
    biometricEnabled: false,
    nationality: "Malaysian",
    ageConfirmed: false,
  };
  return { user };
};
