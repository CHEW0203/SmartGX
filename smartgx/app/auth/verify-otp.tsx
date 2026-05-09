import { Redirect, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DigitInput } from "../../src/components/auth/DigitInput";
import { StepHeader } from "../../src/components/auth/StepHeader";
import { PrimaryButton } from "../../src/components/common/PrimaryButton";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { SmartCard } from "../../src/components/common/SmartCard";
import { validateOtp } from "../../src/features/auth/auth.rules";
import { getOnboardingRoute, STEP } from "../../src/features/auth/onboarding.route";
import { useAuth } from "../../src/hooks/useAuth";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

export default function VerifyOtpScreen() {
  const { currentUser, verifyOtp } = useAuth();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  if (!currentUser) return <Redirect href="/auth/login" />;
  if (currentUser.onboardingStep !== STEP.VERIFY_OTP) {
    return <Redirect href={getOnboardingRoute(currentUser.onboardingStep) as never} />;
  }

  const onSendOtp = () => {
    setOtp("");
    setOtpSent(true);
    setError("");
  };

  const onVerify = () => {
    const validationError = validateOtp(otp);
    if (validationError) {
      setError(validationError);
      return;
    }
    const result = verifyOtp(otp);
    if (!result.ok) {
      setError(result.message ?? "Incorrect OTP.");
      return;
    }
    router.replace("/auth/mykad-scan");
  };

  return (
    <ScreenShell>
      <View style={styles.container}>
        <StepHeader step={STEP.VERIFY_OTP} />

        <View style={styles.heading}>
          <Text style={styles.title}>Mobile Number Verification</Text>
          <Text style={styles.subtitle}>
            A 6-digit OTP will be sent to{" "}
            <Text style={styles.highlight}>{currentUser.mobileNumber}</Text>.
          </Text>
        </View>

        <SmartCard>
          <Text style={styles.otpHint}>
            {otpSent
              ? "Enter the 6-digit OTP sent to your registered mobile number."
              : "Tap Send OTP to receive your verification code."}
          </Text>
          {otpSent ? (
            <>
              <DigitInput value={otp} onChange={setOtp} length={6} secure={false} autoFocus />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Verify OTP" onPress={onVerify} disabled={otp.length !== 6} />
              <PrimaryButton label="Resend OTP" onPress={onSendOtp} variant="ghost" />
            </>
          ) : (
            <PrimaryButton label="Send OTP" onPress={onSendOtp} />
          )}
        </SmartCard>

        {otpSent ? (
          <>
            <SmartCard>
              <Text style={styles.disclaimerTitle}>Did not receive a code?</Text>
              <Text style={styles.disclaimerBody}>
                Tap Resend OTP. If it still does not arrive, check your mobile number and try again.
              </Text>
            </SmartCard>

            <SmartCard>
              <Text style={styles.defaultOtpTitle}>Default OTP (verify demo)</Text>
              <Text style={styles.defaultOtpCode}>123456</Text>
              <Text style={styles.defaultOtpHint}>
                Use this code to verify. In production this would come from SMS.
              </Text>
            </SmartCard>
          </>
        ) : null}
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
  highlight: {
    color: colors.aiInsight,
    fontWeight: "700",
  },
  otpHint: {
    color: colors.textSecondary,
    textAlign: "center",
  },
  error: {
    color: colors.danger,
    fontWeight: "600",
    textAlign: "center",
  },
  disclaimerTitle: {
    color: colors.warning,
    fontWeight: "700",
  },
  disclaimerBody: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  defaultOtpTitle: {
    color: colors.textSecondary,
    fontWeight: "700",
    textAlign: "center",
    fontSize: typography.caption,
  },
  defaultOtpCode: {
    color: colors.aiInsight,
    fontWeight: "800",
    fontSize: 28,
    textAlign: "center",
    letterSpacing: 4,
    marginVertical: spacing.sm,
  },
  defaultOtpHint: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: "center",
  },
});
