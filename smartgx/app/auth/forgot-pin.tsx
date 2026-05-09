import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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

type Phase = "identity" | "selfie" | "pin" | "confirm" | "done";

export default function ForgotPinScreen() {
  const { currentUser, isAuthenticated, setAppPasscode } = useAuth();
  const [phase, setPhase] = useState<Phase>("identity");
  const [nricLast4, setNricLast4] = useState("");
  const [idError, setIdError] = useState("");
  const [passcode, setPasscode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pinError, setPinError] = useState("");

  if (!isAuthenticated || !currentUser) return <Redirect href="/auth/login" />;

  const expectedLast4 = currentUser.mockNricLast4 ?? "5566";

  const onIdentityNext = () => {
    if (nricLast4.trim() !== expectedLast4) {
      setIdError("Details do not match our records. Check your MyKad last 4 digits.");
      return;
    }
    setIdError("");
    setPhase("selfie");
  };

  const onSelfieVerified = () => {
    setPhase("pin");
    setPasscode("");
    setConfirm("");
    setPinError("");
  };

  const onPinNext = () => {
    const w = weakPinReason(passcode);
    if (w) {
      setPinError(w);
      return;
    }
    setPinError("");
    setPhase("confirm");
  };

  const onFinish = () => {
    const err = validatePasscode(passcode, confirm);
    if (err) {
      setPinError(err);
      return;
    }
    const res = setAppPasscode(passcode);
    if (!res.ok) {
      setPinError(res.message ?? "Could not update PIN.");
      return;
    }
    useSecurityStore.getState().resetSensitiveLockFromForgot();
    useNotificationStore.getState().addNotification({
      id: `forgot-pin-${Date.now()}`,
      title: "PIN updated",
      message: "Your SmartGX PIN was reset after identity verification.",
      time: "Just now",
      read: false,
      type: "info",
    });
    useActivityStore.getState().addActivity({
      id: `act-forgot-pin-${Date.now()}`,
      type: "security_pin",
      title: "PIN reset",
      description: "PIN updated after verification",
      timestamp: new Date().toISOString(),
      route: "/security",
    });
    setPhase("done");
  };

  return (
    <ScreenShell>
      <View style={styles.wrap}>
        <Text style={styles.title}>Reset SmartGX PIN</Text>
        <Text style={styles.sub}>Verify your identity, then choose a new 6-digit PIN.</Text>

        {phase === "identity" && (
          <SmartCard>
            <Text style={styles.cardTitle}>MyKad verification</Text>
            <Text style={styles.hint}>Enter the last 4 digits of your MyKad number on file.</Text>
            <TextInput
              style={styles.input}
              value={nricLast4}
              onChangeText={(t) => { setNricLast4(t.replace(/\D/g, "").slice(0, 4)); setIdError(""); }}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="Last 4 digits"
              placeholderTextColor={colors.textMuted}
            />
            {idError ? <Text style={styles.err}>{idError}</Text> : null}
            <PrimaryButton label="Continue" onPress={onIdentityNext} disabled={nricLast4.length !== 4} />
          </SmartCard>
        )}

        {phase === "selfie" && (
          <SmartCard>
            <Text style={styles.cardTitle}>Selfie check</Text>
            <Text style={styles.hint}>SmartGX compares your selfie to your MyKad photo.</Text>
            <PrimaryButton label="Start selfie capture" onPress={onSelfieVerified} />
            <Pressable onPress={() => setPhase("identity")}>
              <Text style={styles.link}>Back</Text>
            </Pressable>
          </SmartCard>
        )}

        {phase === "pin" && (
          <SmartCard>
            <Text style={styles.cardTitle}>New PIN</Text>
            <DigitInput value={passcode} onChange={setPasscode} />
            {pinError ? <Text style={styles.err}>{pinError}</Text> : null}
            <PrimaryButton label="Next" onPress={onPinNext} disabled={passcode.length !== 6} />
            <Pressable onPress={() => setPhase("selfie")}>
              <Text style={styles.link}>Back</Text>
            </Pressable>
          </SmartCard>
        )}

        {phase === "confirm" && (
          <SmartCard>
            <Text style={styles.cardTitle}>Confirm PIN</Text>
            <DigitInput value={confirm} onChange={setConfirm} />
            {pinError ? <Text style={styles.err}>{pinError}</Text> : null}
            <PrimaryButton label="Save new PIN" onPress={onFinish} disabled={confirm.length !== 6} />
            <Pressable onPress={() => { setPhase("pin"); setPinError(""); }}>
              <Text style={styles.link}>Back</Text>
            </Pressable>
          </SmartCard>
        )}

        {phase === "done" && (
          <SmartCard>
            <Text style={styles.cardTitle}>PIN updated</Text>
            <Text style={styles.hint}>You can use your new PIN for payments and transfers.</Text>
            <PrimaryButton label="Back to Security" onPress={() => router.replace("/security" as never)} />
          </SmartCard>
        )}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  title: { color: colors.textPrimary, fontSize: typography.title, fontWeight: "800" },
  sub: { color: colors.textSecondary, lineHeight: 20 },
  cardTitle: { color: colors.textPrimary, fontWeight: "800", fontSize: typography.subheading, marginBottom: spacing.sm },
  hint: { color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.sm,
  },
  err: { color: colors.danger, fontWeight: "600", marginBottom: spacing.sm },
  link: { color: colors.aiInsight, fontWeight: "700", textAlign: "center", marginTop: spacing.sm },
});
