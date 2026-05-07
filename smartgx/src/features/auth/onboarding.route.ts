export const STEP = {
  REGISTER: 2,
  VERIFY_OTP: 3,
  MYKAD_SCAN: 4,
  SELFIE: 5,
  EKYC_STATUS: 6,
  FINANCIAL_PROFILE: 7,
  SMARTGX_SETUP: 8,
  SECURITY_SETUP: 9,
  ACTIVATION: 10,
  COMPLETE: 11,
} as const;

export const TOTAL_STEPS = 10;

export const STEP_LABELS: Record<number, string> = {
  2: "Create Account",
  3: "Mobile Verification",
  4: "Identity Verification",
  5: "Selfie Verification",
  6: "eKYC Review",
  7: "Financial Profile",
  8: "SmartGX Setup",
  9: "Security Setup",
  10: "Account Activation",
};

export const getOnboardingRoute = (step: number): string => {
  if (step <= 2) return "/auth/register";
  if (step === 3) return "/auth/verify-otp";
  if (step === 4) return "/auth/mykad-scan";
  if (step === 5) return "/auth/selfie";
  if (step === 6) return "/auth/ekyc-status";
  if (step === 7) return "/auth/financial-profile";
  if (step === 8) return "/auth/smartgx-setup";
  if (step === 9) return "/auth/security-setup";
  if (step === 10) return "/auth/activation";
  return "/dashboard";
};
