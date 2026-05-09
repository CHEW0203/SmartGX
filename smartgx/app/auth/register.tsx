import { Redirect, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AuthField } from "../../src/components/auth/AuthForm";
import { StepHeader } from "../../src/components/auth/StepHeader";
import { PrimaryButton } from "../../src/components/common/PrimaryButton";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { SmartCard } from "../../src/components/common/SmartCard";
import { validateRegisterInput } from "../../src/features/auth/auth.rules";
import type { RegisterInput } from "../../src/features/auth/auth.types";
import { resolveLoginRoute } from "../../src/features/auth/auth.service";
import { STEP } from "../../src/features/auth/onboarding.route";
import { useAuth } from "../../src/hooks/useAuth";
import { useAuthStore } from "../../src/store/authStore";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

const blank: RegisterInput = {
  fullName: "",
  mobileNumber: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export default function RegisterScreen() {
  const { register, isAuthenticated, currentUser } = useAuth();
  const [form, setForm] = useState<RegisterInput>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
  const [formError, setFormError] = useState("");

  if (isAuthenticated && currentUser) {
    return <Redirect href={resolveLoginRoute(currentUser) as never} />;
  }

  const onChange = <K extends keyof RegisterInput>(key: K, value: RegisterInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const onRegister = async () => {
    setFormError("");
    const validation = validateRegisterInput(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      setFormError("Please review the highlighted fields.");
      return;
    }
    const result = await register(form);
    if (!result.ok) {
      setFormError(result.message ?? "Registration failed.");
      return;
    }
    const user = useAuthStore.getState().currentUser;
    router.replace((user ? resolveLoginRoute(user) : "/auth/verify-otp") as never);
  };

  return (
    <ScreenShell>
      <View style={styles.container}>
        <StepHeader step={STEP.REGISTER} />

        <View style={styles.heading}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Complete SmartGX's 10-step digital banking onboarding. Identity
            verification and your financial profile are set up in the following steps.
          </Text>
        </View>

        <SmartCard>
          <AuthField
            label="Full legal name"
            value={form.fullName}
            onChangeText={(v) => onChange("fullName", v)}
            autoCapitalize="words"
            placeholder="As on your MyKad"
            error={errors.fullName}
          />
          <AuthField
            label="Mobile number"
            value={form.mobileNumber}
            onChangeText={(v) => onChange("mobileNumber", v)}
            keyboardType="phone-pad"
            placeholder="+60123456789"
            error={errors.mobileNumber}
            helperText="Malaysian format: +60 or 01"
          />
          <AuthField
            label="Email address"
            value={form.email}
            onChangeText={(v) => onChange("email", v)}
            keyboardType="email-address"
            placeholder="you@example.com"
            error={errors.email}
          />
          <AuthField
            label="Password"
            value={form.password}
            onChangeText={(v) => onChange("password", v)}
            secureTextEntry
            placeholder="At least 8 characters"
            error={errors.password}
          />
          <AuthField
            label="Confirm password"
            value={form.confirmPassword}
            onChangeText={(v) => onChange("confirmPassword", v)}
            secureTextEntry
            placeholder="Repeat your password"
            error={errors.confirmPassword}
          />
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          <PrimaryButton label="Create Account & Continue" onPress={onRegister} />
        </SmartCard>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Text onPress={() => router.push("/auth/login")} style={styles.link}>
            Login
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          This is a prototype demonstration only. No real banking account will be created.
        </Text>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  heading: { gap: spacing.xs },
  title: { color: colors.textPrimary, fontWeight: "800", fontSize: typography.title },
  subtitle: { color: colors.textSecondary, lineHeight: 20 },
  formError: { color: colors.danger, fontWeight: "600" },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    alignItems: "center",
  },
  footerText: { color: colors.textSecondary },
  link: { color: colors.aiInsight, fontWeight: "700" },
  disclaimer: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: "center",
    lineHeight: 18,
  },
});
