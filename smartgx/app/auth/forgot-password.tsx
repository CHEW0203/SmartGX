import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AuthField } from "../../src/components/auth/AuthForm";
import { PrimaryButton } from "../../src/components/common/PrimaryButton";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { SmartCard } from "../../src/components/common/SmartCard";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

export default function ForgotPasswordScreen() {
  const [emailOrMobile, setEmailOrMobile] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = () => {
    setSubmitted(true);
  };

  return (
    <ScreenShell>
      <View style={styles.container}>
        <View style={styles.heading}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your registered email or mobile number to receive a reset instruction.
          </Text>
        </View>

        <SmartCard>
          <AuthField
            label="Email or Mobile Number"
            value={emailOrMobile}
            onChangeText={setEmailOrMobile}
            keyboardType="email-address"
            placeholder="you@example.com or +60123456789"
          />
          <PrimaryButton label="Send Reset Link" onPress={onSubmit} disabled={!emailOrMobile.trim()} />
          {submitted ? (
            <Text style={styles.success}>
              If this account exists, reset instructions have been sent (prototype simulation).
            </Text>
          ) : null}
        </SmartCard>

        <PrimaryButton label="Back to Login" onPress={() => router.replace("/auth/login")} variant="outline" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  heading: { gap: spacing.xs },
  title: { color: colors.textPrimary, fontWeight: "800", fontSize: typography.title },
  subtitle: { color: colors.textSecondary, lineHeight: 20 },
  success: { color: colors.success, fontWeight: "600", lineHeight: 20 },
});
