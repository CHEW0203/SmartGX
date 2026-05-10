import { Redirect, router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { StepHeader } from "../../src/components/auth/StepHeader";
import { VerificationItem } from "../../src/components/auth/VerificationItem";
import { PrimaryButton } from "../../src/components/common/PrimaryButton";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { SmartCard } from "../../src/components/common/SmartCard";
import { getOnboardingRoute, STEP } from "../../src/features/auth/onboarding.route";
import { shouldShowProductGuide } from "../../src/features/auth/auth.service";
import { useAuth } from "../../src/hooks/useAuth";
import { useAuthStore } from "../../src/store/authStore";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

export default function ActivationScreen() {
  const { currentUser, activateDemoAccount } = useAuth();

  if (!currentUser) return <Redirect href="/auth/login" />;
  if (currentUser.onboardingStep !== STEP.ACTIVATION) {
    return <Redirect href={getOnboardingRoute(currentUser.onboardingStep) as never} />;
  }

  const onEnter = () => {
    activateDemoAccount();
    const u = useAuthStore.getState().currentUser;
    if (shouldShowProductGuide(u)) {
      router.replace("/onboarding-guide" as never);
    } else {
      router.replace("/dashboard" as never);
    }
  };

  return (
    <ScreenShell>
      <View style={styles.container}>
        <StepHeader step={STEP.ACTIVATION} />

        <SmartCard elevated>
          <View style={styles.successBlock}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Account Activated</Text>
            <Text style={styles.successSubtitle}>
              Your SmartGX demo account is ready. Welcome, {currentUser.fullName}.
            </Text>
          </View>

          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Demo Account · Active</Text>
          </View>
        </SmartCard>

        <SmartCard>
          <Text style={styles.summaryTitle}>Onboarding Summary</Text>
          <VerificationItem label="Account created" status="demo_verified" />
          <VerificationItem label="Mobile number verified" status={currentUser.mobileVerificationStatus} />
          <VerificationItem label="MyKad verified" status={currentUser.identityVerificationStatus} />
          <VerificationItem label="Selfie verified" status={currentUser.selfieVerificationStatus} />
          <VerificationItem label="Financial profile set" status="demo_verified" />
          <VerificationItem label="SmartGX AI setup" status="demo_verified" />
          <VerificationItem label="Security setup" status={currentUser.securitySetupStatus} />
        </SmartCard>

        <SmartCard>
          <Text style={styles.disclaimerTitle}>Prototype Notice</Text>
          <Text style={styles.disclaimerBody}>
            In a real digital bank, account activation involves secure internal verification and
            may require a funding step or account number generation.{"\n\n"}
            No real SmartGX account was created. No real deposit was processed. No real banking
            operations were performed. This prototype is for demonstration purposes only.
          </Text>
        </SmartCard>

        <PrimaryButton label="Enter SmartGX" onPress={onEnter} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  successBlock: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  successIcon: {
    fontSize: 48,
    color: colors.success,
    fontWeight: "700",
  },
  successTitle: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: typography.heading,
    textAlign: "center",
  },
  successSubtitle: {
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success + "44",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  statusText: { color: colors.success, fontWeight: "700" },
  summaryTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.subheading,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  disclaimerTitle: { color: colors.warning, fontWeight: "700" },
  disclaimerBody: { color: colors.textSecondary, lineHeight: 20 },
});
