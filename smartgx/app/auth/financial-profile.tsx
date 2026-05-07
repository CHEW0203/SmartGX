import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AuthField } from "../../src/components/auth/AuthForm";
import { StepHeader } from "../../src/components/auth/StepHeader";
import { PrimaryButton } from "../../src/components/common/PrimaryButton";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { SmartCard } from "../../src/components/common/SmartCard";
import type {
  FinancialProfile,
  IncomeType,
  SavingGoal,
  SpendingCategory,
  UserType,
} from "../../src/features/auth/auth.types";
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

const INCOME_TYPES: { label: string; value: IncomeType }[] = [
  { label: "Allowance", value: "allowance" },
  { label: "Part-time", value: "part_time" },
  { label: "Salary", value: "salary" },
  { label: "Cash Income", value: "cash_income" },
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

export default function FinancialProfileScreen() {
  const { currentUser, completeFinancialProfile } = useAuth();
  const [userType, setUserType] = useState<UserType>("student");
  const [incomeType, setIncomeType] = useState<IncomeType>("allowance");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [spendingCategories, setSpendingCategories] = useState<SpendingCategory[]>([]);
  const [savingGoal, setSavingGoal] = useState<SavingGoal>("emergency_fund");
  const [error, setError] = useState("");

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
    const income = Number(monthlyIncome) || 0;
    if (income <= 0) {
      setError("Please enter your monthly income or allowance.");
      return;
    }
    setError("");
    const profile: FinancialProfile = {
      userType,
      incomeType,
      monthlyIncome: income,
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
            Help SmartGX understand your financial situation so it can personalise AI guidance
            for your spending, saving, and debt prevention.
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
            label="My income type"
            options={INCOME_TYPES}
            value={incomeType}
            onSelect={setIncomeType}
          />
          <AuthField
            label="Monthly income or allowance (RM)"
            value={monthlyIncome}
            onChangeText={setMonthlyIncome}
            keyboardType="numeric"
            placeholder="e.g. 1200"
            helperText={Number(monthlyIncome) > 0 ? `Amount: ${formatRM(Number(monthlyIncome))}` : undefined}
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
