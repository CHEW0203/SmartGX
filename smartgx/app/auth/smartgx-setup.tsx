import { Redirect, router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { StepHeader } from "../../src/components/auth/StepHeader";
import { PrimaryButton } from "../../src/components/common/PrimaryButton";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { SmartCard } from "../../src/components/common/SmartCard";
import { getOnboardingRoute, STEP } from "../../src/features/auth/onboarding.route";
import { useAuth } from "../../src/hooks/useAuth";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

const FEATURES = [
  {
    icon: "💰",
    title: "Save Automatically",
    description:
      "SmartGX allocates your income into spending, Bonus Pocket, emergency fund, and goals the moment it arrives.",
  },
  {
    icon: "🧠",
    title: "Spend with Awareness",
    description:
      "AI detects risky spending patterns and gives contextual nudges before your cashflow becomes unsafe.",
  },
  {
    icon: "🛡️",
    title: "Avoid Future-Money Debt",
    description:
      "SmartGX warns you before you rely too much on credit, BNPL, or FlexiCredit-style borrowing.",
  },
  {
    icon: "🏆",
    title: "Build Financial Habits",
    description:
      "Saving streaks, missions, campaigns, and rewards help make good financial behaviour consistent.",
  },
];

const ALLOCATION = [
  { label: "Spending Wallet", pct: 60, color: colors.primary },
  { label: "Bonus Pocket", pct: 20, color: colors.success },
  { label: "Emergency Fund", pct: 10, color: colors.warning },
  { label: "Goal Savings", pct: 10, color: colors.aiInsight },
];

export default function SmartGXSetupScreen() {
  const { currentUser, completeSmartGXSetup } = useAuth();

  if (!currentUser) return <Redirect href="/auth/login" />;
  if (currentUser.onboardingStep !== STEP.SMARTGX_SETUP) {
    return <Redirect href={getOnboardingRoute(currentUser.onboardingStep) as never} />;
  }

  const onAccept = () => {
    completeSmartGXSetup();
    router.replace("/auth/security-setup");
  };

  const income = currentUser.financialProfile?.monthlyIncome ?? 0;

  return (
    <ScreenShell>
      <View style={styles.container}>
        <StepHeader step={STEP.SMARTGX_SETUP} />

        <View style={styles.heading}>
          <Text style={styles.title}>SmartGX AI Setup</Text>
          <Text style={styles.subtitle}>
            Here is what SmartGX will do for you automatically once you start using the app.
          </Text>
        </View>

        {FEATURES.map((f) => (
          <SmartCard key={f.title}>
            <View style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.description}</Text>
              </View>
            </View>
          </SmartCard>
        ))}

        <SmartCard elevated>
          <Text style={styles.allocTitle}>Default Income Allocation</Text>
          {income > 0 && (
            <Text style={styles.allocSubtitle}>
              Based on your income of RM {income.toLocaleString("ms-MY")}
            </Text>
          )}
          <View style={styles.allocList}>
            {ALLOCATION.map((a) => {
              const amount = income > 0 ? (income * a.pct) / 100 : null;
              return (
                <View key={a.label} style={styles.allocRow}>
                  <View style={[styles.allocDot, { backgroundColor: a.color }]} />
                  <Text style={styles.allocLabel}>{a.label}</Text>
                  <Text style={styles.allocPct}>{a.pct}%</Text>
                  {amount !== null && (
                    <Text style={[styles.allocAmt, { color: a.color }]}>
                      RM {amount.toLocaleString("ms-MY")}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
          <Text style={styles.allocNote}>
            You can adjust allocation percentages later in your profile settings.
          </Text>
        </SmartCard>

        <PrimaryButton label="Accept & Continue" onPress={onAccept} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  heading: { gap: spacing.xs },
  title: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: typography.title,
  },
  subtitle: { color: colors.textSecondary, lineHeight: 20 },
  featureRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  featureIcon: { fontSize: 24 },
  featureText: { flex: 1, gap: spacing.xs },
  featureTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.subheading,
  },
  featureDesc: { color: colors.textSecondary, lineHeight: 20 },
  allocTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.subheading,
  },
  allocSubtitle: { color: colors.textSecondary },
  allocList: { gap: spacing.sm },
  allocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  allocDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  allocLabel: { color: colors.textPrimary, flex: 1, fontWeight: "600" },
  allocPct: { color: colors.textSecondary, fontWeight: "700", minWidth: 36, textAlign: "right" },
  allocAmt: { fontWeight: "700", minWidth: 80, textAlign: "right" },
  allocNote: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 18 },
});
