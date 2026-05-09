import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { DigitInput } from "../../src/components/auth/DigitInput";
import { StepHeader } from "../../src/components/auth/StepHeader";
import { PrimaryButton } from "../../src/components/common/PrimaryButton";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { SmartCard } from "../../src/components/common/SmartCard";
import { validatePasscode } from "../../src/features/auth/auth.rules";
import { getOnboardingRoute, STEP } from "../../src/features/auth/onboarding.route";
import { useAuth } from "../../src/hooks/useAuth";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

type Phase = "create" | "confirm";

export default function SecuritySetupScreen() {
  const { currentUser, completeSecuritySetup } = useAuth();
  const [phase, setPhase] = useState<Phase>("create");
  const [passcode, setPasscode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [biometric, setBiometric] = useState(false);
  const [error, setError] = useState("");

  if (!currentUser) return <Redirect href="/auth/login" />;
  if (currentUser.onboardingStep !== STEP.SECURITY_SETUP) {
    return <Redirect href={getOnboardingRoute(currentUser.onboardingStep) as never} />;
  }

  const onNextPhase = () => {
    if (passcode.length !== 6) {
      setError("Enter all 6 digits.");
      return;
    }
    setError("");
    setPhase("confirm");
  };

  const onConfirm = () => {
    const err = validatePasscode(passcode, confirm);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    completeSecuritySetup(passcode, biometric);
    router.replace("/auth/activation");
  };

  const onRestart = () => {
    setPhase("create");
    setPasscode("");
    setConfirm("");
    setError("");
  };

  return (
    <ScreenShell>
      <View style={styles.container}>
        <StepHeader step={STEP.SECURITY_SETUP} />

        <View style={styles.heading}>
          <Text style={styles.title}>Security Setup</Text>
          <Text style={styles.subtitle}>
            Set up your 6-digit app passcode and optional biometric login to secure your SmartGX
            account.
          </Text>
        </View>

        <SmartCard elevated>
          {phase === "create" ? (
            <>
              <Text style={styles.phaseTitle}>Create your app passcode</Text>
              <Text style={styles.phaseHint}>Enter a 6-digit passcode you will remember.</Text>
              <DigitInput value={passcode} onChange={setPasscode} autoFocus />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Next" onPress={onNextPhase} disabled={passcode.length !== 6} />
            </>
          ) : (
            <>
              <Text style={styles.phaseTitle}>Confirm your passcode</Text>
              <Text style={styles.phaseHint}>Re-enter the same 6-digit passcode.</Text>
              <DigitInput value={confirm} onChange={setConfirm} autoFocus />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Confirm" onPress={onConfirm} disabled={confirm.length !== 6} />
              <Pressable onPress={onRestart}>
                <Text style={styles.restart}>Start over</Text>
              </Pressable>
            </>
          )}
        </SmartCard>

        <SmartCard>
          <View style={styles.biometricRow}>
            <View style={styles.biometricText}>
              <Text style={styles.biometricTitle}>Biometric Login</Text>
              <Text style={styles.biometricDesc}>
                Use fingerprint or Face ID to sign in faster when your device supports it.
              </Text>
            </View>
            <Switch
              value={biometric}
              onValueChange={setBiometric}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={biometric ? "#FFFFFF" : colors.textMuted}
            />
          </View>
        </SmartCard>

        <SmartCard>
          <Text style={styles.securityTitle}>Account Protection</Text>
          {[
            "Your account locks after 5 failed passcode attempts.",
            "Transaction approval requires passcode confirmation.",
            "Card freeze can be activated instantly from the app.",
            "All sessions are monitored for suspicious activity.",
          ].map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Text style={styles.bullet}>·</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
          <Text style={styles.securityNote}>
            Keep your PIN private. SmartGX will never ask for it by message or phone call.
          </Text>
        </SmartCard>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  heading: { gap: spacing.xs },
  title: { color: colors.textPrimary, fontWeight: "800", fontSize: typography.title },
  subtitle: { color: colors.textSecondary, lineHeight: 20 },
  phaseTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.subheading,
    textAlign: "center",
  },
  phaseHint: { color: colors.textSecondary, textAlign: "center" },
  error: { color: colors.danger, fontWeight: "600", textAlign: "center" },
  restart: { color: colors.aiInsight, fontWeight: "600", textAlign: "center" },
  biometricRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  biometricText: { flex: 1, gap: spacing.xs },
  biometricTitle: { color: colors.textPrimary, fontWeight: "700" },
  biometricDesc: { color: colors.textSecondary, lineHeight: 18 },
  securityTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: typography.subheading },
  bulletRow: { flexDirection: "row", gap: spacing.sm },
  bullet: { color: colors.aiInsight, fontWeight: "700", fontSize: 18, lineHeight: 20 },
  bulletText: { color: colors.textSecondary, flex: 1, lineHeight: 20 },
  securityNote: { color: colors.textMuted, fontSize: typography.caption },
});
