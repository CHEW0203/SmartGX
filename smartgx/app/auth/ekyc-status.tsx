import { Redirect, router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { StepHeader } from "../../src/components/auth/StepHeader";
import { VerificationItem } from "../../src/components/auth/VerificationItem";
import { PrimaryButton } from "../../src/components/common/PrimaryButton";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { SmartCard } from "../../src/components/common/SmartCard";
import { getOnboardingRoute, STEP } from "../../src/features/auth/onboarding.route";
import { useAuth } from "../../src/hooks/useAuth";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

export default function EkycStatusScreen() {
  const { currentUser, completeEkycReview } = useAuth();

  if (!currentUser) return <Redirect href="/auth/login" />;
  if (currentUser.onboardingStep !== STEP.EKYC_STATUS) {
    return <Redirect href={getOnboardingRoute(currentUser.onboardingStep) as never} />;
  }

  const onContinue = () => {
    completeEkycReview();
    router.replace("/auth/financial-profile");
  };

  return (
    <ScreenShell>
      <View style={styles.container}>
        <StepHeader step={STEP.EKYC_STATUS} />

        <View style={styles.heading}>
          <Text style={styles.title}>eKYC Review</Text>
          <Text style={styles.subtitle}>
            Your identity verification steps are reviewed below. All steps show as demo verified.
          </Text>
        </View>

        <SmartCard elevated>
          <View style={styles.statusHeader}>
            <View style={styles.statusDot} />
            <Text style={styles.statusLabel}>eKYC Status: Demo Verified</Text>
          </View>
          <VerificationItem label="Personal details submitted" status="demo_verified" />
          <VerificationItem label="Mobile number verified" status={currentUser.mobileVerificationStatus} />
          <VerificationItem label="MyKad front scanned" status={currentUser.identityVerificationStatus} />
          <VerificationItem label="MyKad back scanned" status={currentUser.identityVerificationStatus} />
          <VerificationItem label="Selfie verified" status={currentUser.selfieVerificationStatus} />
        </SmartCard>

        <SmartCard>
          <Text style={styles.disclaimerTitle}>Prototype Notice</Text>
          <Text style={styles.disclaimerBody}>
            In a real digital bank, eKYC verification is conducted by certified identity verification
            providers. This prototype simulates the process for demonstration purposes only.
            No real identity documents were processed or stored.
          </Text>
        </SmartCard>

        <PrimaryButton
          label="Continue to Financial Profile"
          onPress={onContinue}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  heading: {
    gap: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: typography.title,
  },
  subtitle: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  statusLabel: {
    color: colors.success,
    fontWeight: "700",
    fontSize: typography.subheading,
  },
  disclaimerTitle: {
    color: colors.warning,
    fontWeight: "700",
  },
  disclaimerBody: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
