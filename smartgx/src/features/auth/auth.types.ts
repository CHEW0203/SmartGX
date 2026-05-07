export type UserType = "student" | "fresh_graduate" | "early_career";

export type IncomeType = "allowance" | "part_time" | "salary" | "cash_income";

export type SpendingCategory =
  | "food"
  | "transport"
  | "shopping"
  | "entertainment"
  | "bills"
  | "education";

export type SavingGoal =
  | "emergency_fund"
  | "education"
  | "travel"
  | "device_purchase"
  | "investment_starter"
  | "debt_repayment";

export type VerificationStatus =
  | "not_started"
  | "pending"
  | "demo_verified"
  | "failed"
  | "completed";

export interface FinancialProfile {
  userType: UserType;
  incomeType: IncomeType;
  monthlyIncome: number;
  spendingCategories: SpendingCategory[];
  primarySavingGoal: SavingGoal;
  allocationAccepted: boolean;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  password: string;
  mobileNumber: string;
  // Onboarding tracking
  onboardingStep: number; // 3–11 (11 = all complete)
  hasCompletedOnboarding: boolean;
  // Verification statuses
  mobileVerificationStatus: VerificationStatus;
  identityVerificationStatus: VerificationStatus; // MyKad
  selfieVerificationStatus: VerificationStatus;
  securitySetupStatus: VerificationStatus;
  accountActivationStatus: VerificationStatus;
  // Financial profile (added in step 7)
  financialProfile?: FinancialProfile;
  // Security (added in step 9)
  passcode?: string;
  biometricEnabled: boolean;
  // MyKad optional fields (step 4)
  mockNricLast4?: string;
  nationality: string;
  ageConfirmed: boolean;
}

export interface LoginInput {
  emailOrMobile: string;
  password: string;
}

export interface RegisterInput {
  fullName: string;
  mobileNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthState {
  currentUser: AuthUser | null;
  users: AuthUser[];
  isAuthenticated: boolean;
  login: (input: LoginInput) => { ok: boolean; message?: string; nextRoute?: string };
  register: (input: RegisterInput) => { ok: boolean; message?: string };
  logout: () => void;
  verifyOtp: (otp: string) => { ok: boolean; message?: string };
  completeMyKadScan: (data?: {
    mockNricLast4?: string;
    nationality?: string;
    ageConfirmed?: boolean;
  }) => void;
  completeSelfieVerification: () => void;
  completeEkycReview: () => void;
  completeFinancialProfile: (profile: FinancialProfile) => void;
  completeSmartGXSetup: () => void;
  completeSecuritySetup: (passcode: string, biometricEnabled: boolean) => void;
  activateDemoAccount: () => void;
}
