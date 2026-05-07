import { Redirect, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScanPlaceholder } from "../../src/components/auth/ScanPlaceholder";
import { StepHeader } from "../../src/components/auth/StepHeader";
import { PrimaryButton } from "../../src/components/common/PrimaryButton";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { SmartCard } from "../../src/components/common/SmartCard";
import { getOnboardingRoute, STEP } from "../../src/features/auth/onboarding.route";
import { useAuth } from "../../src/hooks/useAuth";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

const TIPS = [
  "Ensure good lighting on your face",
  "Remove glasses and face coverings",
  "Look directly at the camera",
  "Keep a neutral expression",
];

export default function SelfieScreen() {
  const { currentUser, completeSelfieVerification } = useAuth();
  const [scanned, setScanned] = useState(false);

  if (!currentUser) return <Redirect href="/auth/login" />;
  if (currentUser.onboardingStep !== STEP.SELFIE) {
    return <Redirect href={getOnboardingRoute(currentUser.onboardingStep) as never} />;
  }

  const onContinue = () => {
    completeSelfieVerification();
    router.replace("/auth/ekyc-status");
  };

  return (
    <ScreenShell>
      <View style={styles.container}>
        <StepHeader step={STEP.SELFIE} />

        <Text style={styles.title}>Selfie Verification</Text>
        <Text style={styles.subtitle}>
          Take a clear selfie to verify your identity. This is simulated in prototype mode.
        </Text>

        <ScanPlaceholder
          type="selfie"
          scanned={scanned}
          label="Face capture"
          onSimulate={() => setScanned(true)}
          onRetake={() => setScanned(false)}
        />

        <SmartCard>
          <Text style={styles.tipsTitle}>Tips for a good selfie</Text>
          {TIPS.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <Text style={styles.tipDot}>·</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </SmartCard>

        <PrimaryButton
          label="Continue to eKYC Review"
          onPress={onContinue}
          disabled={!scanned}
        />
        {!scanned && (
          <Text style={styles.hint}>Simulate selfie verification to continue.</Text>
        )}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
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
  tipsTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.subheading,
  },
  tipRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tipDot: {
    color: colors.aiInsight,
    fontWeight: "700",
    fontSize: 18,
    lineHeight: 20,
  },
  tipText: {
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  hint: {
    color: colors.textMuted,
    textAlign: "center",
    fontSize: typography.caption,
  },
});
