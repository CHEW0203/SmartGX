import type { User } from "@supabase/supabase-js";
import { getSupabase } from "../../lib/supabase";
import { STEP } from "../../features/auth/onboarding.route";
import type { RegisterInput } from "../../features/auth/auth.types";

function accountNoFor(userId: string) {
  const tail = userId.replace(/-/g, "").slice(0, 10).toUpperCase();
  return `SGX${tail}`;
}

/** Creates default SmartGX rows for a new auth user. Call only when a session exists (RLS). */
export async function createDefaultUserData(user: User, registerInput: RegisterInput): Promise<{ ok: true } | { ok: false; message: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: "Database not configured." };

  const uid = user.id;
  const email = registerInput.email.trim().toLowerCase();
  const extras = {
    onboardingStep: STEP.VERIFY_OTP,
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

  const profileRow = {
    auth_user_id: uid,
    full_name: registerInput.fullName.trim(),
    email,
    phone: registerInput.mobileNumber.trim(),
    employment_status: "student",
    monthly_income: 0,
    mykad_verified: false,
    profile_extras: extras,
  };

  const accountRow = {
    user_id: uid,
    account_no: accountNoFor(uid),
    main_balance: 50,
    flexi_limit: 3000,
    flexi_used: 0,
    status: "active",
  };

  const savingsRow = {
    user_id: uid,
    bonus_balance: 0,
    emergency_balance: 0,
    goals_balance: 0,
    allocation_spending_pct: 60,
    allocation_bonus_pct: 20,
    allocation_emergency_pct: 10,
    allocation_goals_pct: 10,
    pending_bonus_reward_amount: 0,
    pending_bonus_progress: 0,
    pending_bonus_target: 0,
    round_up_enabled: true,
    round_up_total: 0,
    round_up_destination: "bonus",
    use_ai_allocation: false,
    savings_state: {
      manualIncomes: [],
      manualActivities: [],
      withdrawalHistory: [],
      latestAutoAllocation: null,
      allocationRule: { spendingWallet: 60, bonusPocket: 20, emergencyFund: 10, goalSavings: 10 },
      userAllocationRule: { spendingWallet: 60, bonusPocket: 20, emergencyFund: 10, goalSavings: 10 },
      pendingBonusBoost: 3,
    },
  };

  const securityRow = {
    user_id: uid,
    pin_hash: null as string | null,
    pin_set: false,
    emergency_lock_active: false,
    security_score: 50,
    trusted_device: true,
    wrong_pin_attempts: 0,
    security_extras: {},
  };

  const gxRow = {
    user_id: uid,
    score: 70,
    analysis: "",
    recommended_actions: [],
  };

  const streakRow = {
    user_id: uid,
    current_streak: 0,
    longest_streak: 0,
    last_saved_date: null as string | null,
    saved_this_month: 0,
    streak_milestones_claimed: [],
    auto_credited_milestones: [],
  };

  const treeRow = {
    user_id: uid,
    level: 1,
    exp: 0,
    health: 62,
    water: 3,
    smart_score: 420,
    rank_movement: 0,
    tree_state: "healthy",
    score_breakdown: {
      gxHealth: 0,
      streak: 0,
      missions: 0,
      savingsGrowth: 0,
      debtBehavior: 0,
      repayment: 0,
      total: 420,
    },
    last_synced_at: null as string | null,
  };

  const flexiRow = {
    user_id: uid,
    status: "not_applied",
    approved_limit: 0,
    available_credit: 0,
    used_credit: 0,
    annual_interest_rate: 6,
    auto_repayment_enabled: true,
    application_data: {},
    documents: { epfStatement: "not_uploaded", businessBank6Months: "not_uploaded", myKad: "not_uploaded" },
    flexi_state: {},
  };

  const defaultCampaigns = [
    { campaign_id: "smartsave", progress: 0, target: 300, status: "not_started", reward_credited: false, metadata: {} },
    { campaign_id: "roundup_boost", progress: 0, target: 10, status: "not_started", reward_credited: false, metadata: {} },
    { campaign_id: "debt_free", progress: 0, target: 30, status: "not_started", reward_credited: false, metadata: {} },
    { campaign_id: "friend_streak", progress: 0, target: 2, status: "not_started", reward_credited: false, metadata: {} },
    { campaign_id: "emergency_builder", progress: 0, target: 100, status: "not_started", reward_credited: false, metadata: {} },
  ];

  try {
    const { error: e1 } = await sb.from("users_profile").insert(profileRow);
    if (e1) throw e1;
    const { error: e2 } = await sb.from("accounts").insert(accountRow);
    if (e2) throw e2;
    const { error: e3 } = await sb.from("savings").insert(savingsRow);
    if (e3) throw e3;
    const { error: e4 } = await sb.from("security_settings").insert(securityRow);
    if (e4) throw e4;
    const { error: e5 } = await sb.from("gxhealth").insert(gxRow);
    if (e5) throw e5;
    const { error: e6 } = await sb.from("streaks").insert(streakRow);
    if (e6) throw e6;
    const { error: e7 } = await sb.from("money_tree").insert(treeRow);
    if (e7) throw e7;
    const { error: e8 } = await sb.from("flexicredit_accounts").insert(flexiRow);
    if (e8) throw e8;

    for (const c of defaultCampaigns) {
      const { error: ce } = await sb.from("campaign_progress").insert({
        user_id: uid,
        campaign_id: c.campaign_id,
        progress: c.progress,
        target: c.target,
        status: c.status,
        reward_credited: c.reward_credited,
        metadata: c.metadata,
      });
      if (ce) throw ce;
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create profile.";
    if (__DEV__) console.warn("[SmartGX] bootstrap error", e);
    return { ok: false, message: msg };
  }
}
