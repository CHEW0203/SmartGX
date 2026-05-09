export type UserType = "student" | "fresh_graduate" | "early_career";

export type IncomeType = "allowance" | "part_time" | "salary" | "cash_income";

export type EmploymentStatus =
  | "student"
  | "unemployed"
  | "part_time"
  | "full_time"
  | "self_employed"
  | "business_owner"
  | "other";

export function employmentStatusToIncomeType(e: EmploymentStatus): IncomeType {
  switch (e) {
    case "student":
    case "unemployed":
      return "allowance";
    case "part_time":
      return "part_time";
    case "full_time":
    case "business_owner":
      return "salary";
    case "self_employed":
      return "part_time";
    default:
      return "cash_income";
  }
}

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
  /** Older sessions may omit this — default in UI helpers when missing */
  employmentStatus?: EmploymentStatus;
  incomeType: IncomeType;
  /** Prefer 0 when the user skips income — students / unemployed-friendly. */
  monthlyIncome: number;
  /** Optional monthly budget cap (RM), when user has set one */
  monthlyBudget?: number;
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
  login: (input: LoginInput) => Promise<{ ok: boolean; message?: string; nextRoute?: string }>;
  register: (input: RegisterInput) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
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
  /** Set or replace 6-digit app PIN (post-login / Security Center). */
  setAppPasscode: (passcode: string) => { ok: boolean; message?: string };
  changeAppPasscode: (currentPasscode: string, newPasscode: string, confirmNew: string) => { ok: boolean; message?: string };
  activateDemoAccount: () => void;
}
