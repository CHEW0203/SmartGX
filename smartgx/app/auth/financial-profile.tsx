import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AuthField } from "../../src/components/auth/AuthForm";
import { StepHeader } from "../../src/components/auth/StepHeader";
import { PrimaryButton } from "../../src/components/common/PrimaryButton";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { SmartCard } from "../../src/components/common/SmartCard";
import type {
  EmploymentStatus,
  FinancialProfile,
  SavingGoal,
  SpendingCategory,
  UserType,
} from "../../src/features/auth/auth.types";
import { employmentStatusToIncomeType } from "../../src/features/auth/auth.types";
import { getOnboardingRoute, STEP } from "../../src/features/auth/onboarding.route";
import { useAuth } from "../../src/hooks/useAuth";
import { formatRM } from "../../src/lib/currency";
import { colors } from "../../src/theme/colors";
import { radius } from "../../src/theme/radius";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

const USER_TYPES: { label: string; value: UserType }[] = [
  { label: "Student", value: "student" },
  { label: "Fresh Graduate", value: "fresh_graduate" },
  { label: "Early-Career", value: "early_career" },
];

const EMPLOYMENT: { label: string; value: EmploymentStatus }[] = [
  { label: "Student", value: "student" },
  { label: "Unemployed", value: "unemployed" },
  { label: "Part-time", value: "part_time" },
  { label: "Full-time", value: "full_time" },
  { label: "Self-employed", value: "self_employed" },
  { label: "Business Owner", value: "business_owner" },
  { label: "Other", value: "other" },
];

const SPENDING_CATS: { label: string; value: SpendingCategory }[] = [
  { label: "Food", value: "food" },
  { label: "Transport", value: "transport" },
  { label: "Shopping", value: "shopping" },
  { label: "Entertainment", value: "entertainment" },
  { label: "Bills", value: "bills" },
  { label: "Education", value: "education" },
];

const SAVING_GOALS: { label: string; value: SavingGoal }[] = [
  { label: "Emergency Fund", value: "emergency_fund" },
  { label: "Education", value: "education" },
  { label: "Travel", value: "travel" },
  { label: "Device Purchase", value: "device_purchase" },
  { label: "Investment Starter", value: "investment_starter" },
  { label: "Debt Repayment", value: "debt_repayment" },
];

function defaultEmployment(userType: UserType): EmploymentStatus {
  if (userType === "student") return "student";
  if (userType === "fresh_graduate") return "unemployed";
  return "full_time";
}

/** Allow empty -> 0, or decimals; reject letters/symbols like "abc" or "1,200". */
function parseMonthlyIncomeRm(raw: string): { ok: true; value: number } | { ok: false; message: string } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: 0 };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return { ok: false, message: "Enter numbers only for income (e.g. 1200 or 1200.50)." };
  const n = Number(t);
  if (Number.isNaN(n)) return { ok: false, message: "Income must be a valid number." };
  if (n < 0) return { ok: false, message: "Income cannot be negative." };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

export default function FinancialProfileScreen() {
  const { currentUser, completeFinancialProfile } = useAuth();
  const [userType, setUserType] = useState<UserType>("student");
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>("student");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [spendingCategories, setSpendingCategories] = useState<SpendingCategory[]>([]);
  const [savingGoal, setSavingGoal] = useState<SavingGoal>("emergency_fund");
  const [error, setError] = useState("");

  useEffect(() => {
    setEmploymentStatus(defaultEmployment(userType));
  }, [userType]);

  if (!currentUser) return <Redirect href="/auth/login" />;
  if (currentUser.onboardingStep !== STEP.FINANCIAL_PROFILE) {
    return <Redirect href={getOnboardingRoute(currentUser.onboardingStep) as never} />;
  }

  const toggleCategory = (cat: SpendingCategory) => {
    setSpendingCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const onContinue = () => {
    const parsed = parseMonthlyIncomeRm(monthlyIncome);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    setError("");
    const derivedIncomeType = employmentStatusToIncomeType(employmentStatus);
    const profile: FinancialProfile = {
      userType,
      employmentStatus,
      incomeType: derivedIncomeType,
      monthlyIncome: parsed.value,
      spendingCategories,
      primarySavingGoal: savingGoal,
      allocationAccepted: true,
    };
    completeFinancialProfile(profile);
    router.replace("/auth/smartgx-setup");
  };

  return (
    <ScreenShell>
      <View style={styles.container}>
        <StepHeader step={STEP.FINANCIAL_PROFILE} />

        <View style={styles.heading}>
          <Text style={styles.title}>Financial Profile</Text>
          <Text style={styles.subtitle}>
            Help SmartGX understand your situation so AI guidance fits your saving, spending, and debt avoidance goals.
          </Text>
        </View>

        <SmartCard>
          <ChipGroup
            label="I am a"
            options={USER_TYPES}
            value={userType}
            onSelect={setUserType}
          />
          <ChipGroup
            label="Employment status"
            options={EMPLOYMENT}
            value={employmentStatus}
            onSelect={setEmploymentStatus}
          />
          <AuthField
            label="Monthly income (RM) — optional"
            value={monthlyIncome}
            onChangeText={(t) => {
              setMonthlyIncome(t);
              if (error) setError("");
            }}
            keyboardType="numeric"
            placeholder="Leave blank if you have no steady income yet"
            helperText={
              monthlyIncome.trim()
                ? (() => {
                    const r = parseMonthlyIncomeRm(monthlyIncome);
                    return r.ok && r.value > 0 ? `Amount: ${formatRM(r.value)}` : undefined;
                  })()
                : "Defaults to RM0 until you enter an amount."
            }
            error={error}
          />
        </SmartCard>

        <SmartCard>
          <Text style={styles.groupLabel}>Main spending categories (select all that apply)</Text>
          <View style={styles.chipWrap}>
            {SPENDING_CATS.map((cat) => {
              const active = spendingCategories.includes(cat.value);
              return (
                <Chip
                  key={cat.value}
                  label={cat.label}
                  active={active}
                  onPress={() => toggleCategory(cat.value)}
                />
              );
            })}
          </View>
        </SmartCard>

        <SmartCard>
          <ChipGroup
            label="My primary saving goal"
            options={SAVING_GOALS}
            value={savingGoal}
            onSelect={setSavingGoal}
          />
        </SmartCard>

        <PrimaryButton label="Continue to SmartGX Setup" onPress={onContinue} />
      </View>
    </ScreenShell>
  );
}

interface ChipGroupProps<T extends string> {
  label: string;
  options: { label: string; value: T }[];
  value: T;
  onSelect: (v: T) => void;
}
const ChipGroup = <T extends string>({ label, options, value, onSelect }: ChipGroupProps<T>) => (
  <View style={styles.chipGroupContainer}>
    <Text style={styles.groupLabel}>{label}</Text>
    <View style={styles.chipWrap}>
      {options.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.label}
          active={value === opt.value}
          onPress={() => onSelect(opt.value)}
        />
      ))}
    </View>
  </View>
);

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}
const Chip = ({ label, active, onPress }: ChipProps) => (
  <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  heading: { gap: spacing.xs },
  title: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: typography.title,
  },
  subtitle: { color: colors.textSecondary, lineHeight: 20 },
  chipGroupContainer: { gap: spacing.sm },
  groupLabel: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.body,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.inputBg,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: { color: colors.textSecondary, fontWeight: "600" },
  chipTextActive: { color: colors.textPrimary },
});
