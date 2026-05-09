import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DigitInput } from "../../src/components/auth/DigitInput";
import { PrimaryButton } from "../../src/components/common/PrimaryButton";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { SmartCard } from "../../src/components/common/SmartCard";
import { validatePasscode } from "../../src/features/auth/auth.rules";
import { weakPinReason } from "../../src/features/security/pin.rules";
import { useAuth } from "../../src/hooks/useAuth";
import { useActivityStore } from "../../src/store/activityStore";
import { useNotificationStore } from "../../src/store/notificationStore";
import { useSecurityStore } from "../../src/store/securityStore";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

type Phase = "create" | "confirm";

export default function AppPinSetupScreen() {
  const { currentUser, isAuthenticated, setAppPasscode } = useAuth();
  const pinSetFromServer = useSecurityStore((s) => s.pinSetFromServer);
  const [phase, setPhase] = useState<Phase>("create");
  const [passcode, setPasscode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  if (!isAuthenticated || !currentUser) return <Redirect href="/auth/login" />;
  if (pinSetFromServer) return <Redirect href="/dashboard" />;
  const pin = currentUser.passcode;
  if (pin && pin.length === 6 && /^\d{6}$/.test(pin)) return <Redirect href="/dashboard" />;

  const onNext = () => {
    const weak = weakPinReason(passcode);
    if (weak) {
      setError(weak);
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
    const res = setAppPasscode(passcode);
    if (!res.ok) {
      setError(res.message ?? "Could not save PIN.");
      return;
    }
    setError("");
    useSecurityStore.getState().clearPinFailures();
    useNotificationStore.getState().addNotification({
      id: `pin-setup-${Date.now()}`,
      title: "PIN secured",
      message: "Your SmartGX PIN is set. It is required for payments and transfers.",
      time: "Just now",
      read: false,
      type: "info",
    });
    useActivityStore.getState().addActivity({
      id: `act-pin-setup-${Date.now()}`,
      type: "security_pin",
      title: "PIN setup completed",
      description: "Your 6-digit SmartGX PIN is active.",
      timestamp: new Date().toISOString(),
      route: "/security",
    });
    router.replace("/dashboard" as never);
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
        <View style={styles.heading}>
          <Text style={styles.title}>Create your SmartGX PIN</Text>
          <Text style={styles.subtitle}>
            Choose a 6-digit PIN for transfers, payments, and sensitive actions. You can change it later in Security Center.
          </Text>
        </View>

        <SmartCard elevated>
          {phase === "create" ? (
            <>
              <Text style={styles.phaseTitle}>New PIN</Text>
              <DigitInput value={passcode} onChange={setPasscode} autoFocus />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Continue" onPress={onNext} disabled={passcode.length !== 6} />
            </>
          ) : (
            <>
              <Text style={styles.phaseTitle}>Confirm PIN</Text>
              <DigitInput value={confirm} onChange={setConfirm} autoFocus />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Save PIN" onPress={onConfirm} disabled={confirm.length !== 6} />
              <Pressable onPress={onRestart}>
                <Text style={styles.restart}>Start over</Text>
              </Pressable>
            </>
          )}
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
  phaseTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: typography.subheading, textAlign: "center" },
  error: { color: colors.danger, fontWeight: "600", textAlign: "center" },
  restart: { color: colors.aiInsight, fontWeight: "600", textAlign: "center" },
});
