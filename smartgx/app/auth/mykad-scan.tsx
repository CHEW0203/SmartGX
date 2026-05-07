import { Redirect, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScanPlaceholder } from "../../src/components/auth/ScanPlaceholder";
import { StepHeader } from "../../src/components/auth/StepHeader";
import { AuthField } from "../../src/components/auth/AuthForm";
import { PrimaryButton } from "../../src/components/common/PrimaryButton";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { SmartCard } from "../../src/components/common/SmartCard";
import { getOnboardingRoute, STEP } from "../../src/features/auth/onboarding.route";
import { useAuth } from "../../src/hooks/useAuth";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

export default function MyKadScanScreen() {
  const { currentUser, completeMyKadScan } = useAuth();
  const [frontScanned, setFrontScanned] = useState(false);
  const [backScanned, setBackScanned] = useState(false);
  const [nricLast4, setNricLast4] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [nricError, setNricError] = useState("");

  if (!currentUser) return <Redirect href="/auth/login" />;
  if (currentUser.onboardingStep !== STEP.MYKAD_SCAN) {
    return <Redirect href={getOnboardingRoute(currentUser.onboardingStep) as never} />;
  }

  const canContinue = frontScanned && backScanned;

  const onContinue = () => {
    if (nricLast4 && !/^\d{4}$/.test(nricLast4)) {
      setNricError("Must be exactly 4 digits if entered.");
      return;
    }
    setNricError("");
    completeMyKadScan({
      mockNricLast4: nricLast4 || undefined,
      nationality: "Malaysian",
      ageConfirmed: true,
    });
    router.replace("/auth/selfie");
  };

  return (
    <ScreenShell>
      <View style={styles.container}>
        <StepHeader step={STEP.MYKAD_SCAN} />

        <Text style={styles.title}>MyKad / NRIC Verification</Text>
        <Text style={styles.subtitle}>
          Scan both sides of your MyKad. This is simulated in prototype mode.
        </Text>

        <ScanPlaceholder
          type="card_front"
          scanned={frontScanned}
          label="Front of MyKad"
          onSimulate={() => setFrontScanned(true)}
          onRetake={() => setFrontScanned(false)}
        />
        <ScanPlaceholder
          type="card_back"
          scanned={backScanned}
          label="Back of MyKad"
          onSimulate={() => setBackScanned(true)}
          onRetake={() => setBackScanned(false)}
        />

        <SmartCard>
          <Text style={styles.cardTitle}>Optional Details</Text>
          <AuthField
            label="NRIC last 4 digits (optional)"
            value={nricLast4}
            onChangeText={setNricLast4}
            keyboardType="numeric"
            placeholder="1234"
            helperText="Demo only. Do not enter your real NRIC."
            error={nricError}
          />
          <View style={styles.checkRow}>
            <Text
              onPress={() => setAgeConfirmed((v) => !v)}
              style={[styles.checkBox, ageConfirmed && styles.checkBoxChecked]}
            >
              {ageConfirmed ? "✓" : " "}
            </Text>
            <Text style={styles.checkLabel}>I confirm I am 18 years old or above.</Text>
          </View>
        </SmartCard>

        <PrimaryButton
          label="Continue to Selfie Verification"
          onPress={onContinue}
          disabled={!canContinue}
        />
        {!canContinue && (
          <Text style={styles.hint}>Simulate both front and back scans to continue.</Text>
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
  cardTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.subheading,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.inputBg,
    textAlign: "center",
    color: colors.textPrimary,
    fontWeight: "700",
    lineHeight: 22,
  },
  checkBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    color: "#FFF",
  },
  checkLabel: {
    color: colors.textPrimary,
    flex: 1,
  },
  hint: {
    color: colors.textMuted,
    textAlign: "center",
    fontSize: typography.caption,
  },
});
