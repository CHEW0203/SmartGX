import type { User } from "@supabase/supabase-js";
import { getSupabase } from "../../lib/supabase";
import { STEP } from "./onboarding.route";
import type { AuthUser, FinancialProfile, LoginInput, RegisterInput } from "./auth.types";
import type { VerificationStatus } from "./auth.types";

export interface UsersProfileRow {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  phone: string;
  employment_status: string;
  monthly_income: number;
  mykad_verified: boolean;
  profile_extras: Record<string, unknown>;
}

export async function fetchUsersProfile(authUserId: string): Promise<UsersProfileRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("users_profile").select("*").eq("auth_user_id", authUserId).maybeSingle();
  if (error || !data) return null;
  return data as UsersProfileRow;
}

export function mapProfileToAuthUser(profile: UsersProfileRow, sessionUser: User): AuthUser {
  const x = profile.profile_extras ?? {};
  const onboardingStep = typeof x.onboardingStep === "number" ? x.onboardingStep : STEP.VERIFY_OTP;
  const fp = x.financialProfile as FinancialProfile | undefined;
  const mergedFinancial: FinancialProfile | undefined = fp
    ? {
        ...fp,
        monthlyIncome: fp.monthlyIncome ?? Number(profile.monthly_income) ?? 0,
        employmentStatus: fp.employmentStatus ?? (profile.employment_status as FinancialProfile["employmentStatus"]),
      }
    : Number(profile.monthly_income) > 0 || profile.employment_status
      ? {
          userType: "student",
          employmentStatus: profile.employment_status as FinancialProfile["employmentStatus"],
          incomeType: "allowance",
          monthlyIncome: Number(profile.monthly_income),
          spendingCategories: [],
          primarySavingGoal: "emergency_fund",
          allocationAccepted: false,
        }
      : undefined;

  return {
    id: sessionUser.id,
    fullName: profile.full_name,
    email: profile.email,
    password: "",
    mobileNumber: profile.phone,
    onboardingStep,
    hasCompletedOnboarding: Boolean(x.hasCompletedOnboarding),
    mobileVerificationStatus: (x.mobileVerificationStatus as VerificationStatus) ?? "not_started",
    identityVerificationStatus: (x.identityVerificationStatus as VerificationStatus) ?? "not_started",
    selfieVerificationStatus: (x.selfieVerificationStatus as VerificationStatus) ?? "not_started",
    securitySetupStatus: (x.securitySetupStatus as VerificationStatus) ?? "not_started",
    accountActivationStatus: (x.accountActivationStatus as VerificationStatus) ?? "not_started",
    financialProfile: mergedFinancial,
    passcode: undefined,
    biometricEnabled: Boolean(x.biometricEnabled),
    mockNricLast4: x.mockNricLast4 as string | undefined,
    nationality: (x.nationality as string) ?? "Malaysian",
    ageConfirmed: Boolean(x.ageConfirmed),
  };
}

export async function supabaseSignIn(input: LoginInput): Promise<{ ok: true; user: User } | { ok: false; message: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: "SmartGX cloud is not configured. Add Supabase keys to .env and restart." };

  const id = input.emailOrMobile.trim().toLowerCase();
  if (!id.includes("@")) {
    return { ok: false, message: "Sign in with the email address you used to register." };
  }

  const { data, error } = await sb.auth.signInWithPassword({ email: id, password: input.password });
  if (error || !data.user) {
    return { ok: false, message: error?.message ?? "Could not sign in." };
  }
  return { ok: true, user: data.user };
}

export async function supabaseSignUp(
  input: RegisterInput
): Promise<
  | { ok: true; user: User; session: import("@supabase/supabase-js").Session | null }
  | { ok: false; message: string }
> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: "SmartGX cloud is not configured." };

  const email = input.email.trim().toLowerCase();
  const { data, error } = await sb.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        phone: input.mobileNumber.trim(),
      },
    },
  });

  if (error || !data.user) {
    return { ok: false, message: error?.message ?? "Could not create account." };
  }
  return { ok: true, user: data.user, session: data.session };
}

export async function supabaseSignOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

export async function upsertProfileExtras(authUserId: string, patch: Record<string, unknown>): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const existing = await fetchUsersProfile(authUserId);
  const nextExtras = { ...(existing?.profile_extras ?? {}), ...patch };
  const { error } = await sb
    .from("users_profile")
    .update({ profile_extras: nextExtras, updated_at: new Date().toISOString() })
    .eq("auth_user_id", authUserId);
  return !error;
}

export async function upsertFinancialProfileInDb(authUserId: string, profile: FinancialProfile): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const existing = await fetchUsersProfile(authUserId);
  const nextExtras = { ...(existing?.profile_extras ?? {}), financialProfile: profile };
  const { error } = await sb
    .from("users_profile")
    .update({
      profile_extras: nextExtras,
      monthly_income: profile.monthlyIncome,
      employment_status: profile.employmentStatus ?? "student",
      updated_at: new Date().toISOString(),
    })
    .eq("auth_user_id", authUserId);
  return !error;
}
