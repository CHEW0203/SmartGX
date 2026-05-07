import { Redirect, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AuthField } from "../../src/components/auth/AuthForm";
import { PrimaryButton } from "../../src/components/common/PrimaryButton";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { SmartCard } from "../../src/components/common/SmartCard";
import { validateLoginInput } from "../../src/features/auth/auth.rules";
import { useAuth } from "../../src/hooks/useAuth";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

export default function LoginScreen() {
  const { login, isAuthenticated } = useAuth();
  const [emailOrMobile, setEmailOrMobile] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ emailOrMobile?: string; password?: string }>({});
  const [formError, setFormError] = useState("");

  if (isAuthenticated) {
    return <Redirect href="/dashboard" />;
  }

  const onLogin = () => {
    setFormError("");
    const validation = validateLoginInput({ emailOrMobile, password });
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    const result = login({ emailOrMobile, password });
    if (!result.ok) {
      setFormError(result.message ?? "Login failed.");
      return;
    }
    if (result.nextRoute) {
      router.replace(result.nextRoute as never);
    }
  };

  return (
    <ScreenShell>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.logoRow}>
            <View style={styles.logoDot} />
            <Text style={styles.logoText}>SmartGX</Text>
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in to continue your financial resilience journey.
          </Text>
        </View>

        <SmartCard>
          <AuthField
            label="Email or Mobile Number"
            value={emailOrMobile}
            onChangeText={setEmailOrMobile}
            keyboardType="email-address"
            placeholder="you@example.com or +60123456789"
            error={errors.emailOrMobile}
          />
          <AuthField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="At least 8 characters"
            error={errors.password}
          />
          <Text onPress={() => router.push("/auth/forgot-password")} style={styles.forgotLink}>
            Forgot password?
          </Text>
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          <PrimaryButton label="Login" onPress={onLogin} />
        </SmartCard>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to SmartGX?</Text>
          <Text onPress={() => router.push("/auth/register")} style={styles.link}>
            Create Account
          </Text>
        </View>

        <SmartCard>
          <Text style={styles.hintTitle}>Test Accounts</Text>
          <Text style={styles.hintBody}>
            Student: <Text style={styles.hintCode}>jason@student.my</Text>{"\n"}
            Fresh Graduate: <Text style={styles.hintCode}>aina@freshgrad.my</Text>{"\n"}
            Password: <Text style={styles.hintCode}>password123</Text>
          </Text>
        </SmartCard>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  hero: { gap: spacing.sm },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.aiInsight },
  logoText: {
    color: colors.aiInsight,
    fontWeight: "800",
    fontSize: typography.caption,
    letterSpacing: 1.2,
  },
  title: { color: colors.textPrimary, fontWeight: "800", fontSize: typography.title },
  subtitle: { color: colors.textSecondary, lineHeight: 20 },
  forgotLink: { color: colors.aiInsight, fontWeight: "600", textAlign: "right" },
  formError: { color: colors.danger, fontWeight: "600" },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    alignItems: "center",
  },
  footerText: { color: colors.textSecondary },
  link: { color: colors.aiInsight, fontWeight: "700" },
  hintTitle: { color: colors.warning, fontWeight: "700" },
  hintBody: { color: colors.textSecondary, lineHeight: 22 },
  hintCode: { color: colors.aiInsight, fontWeight: "700" },
});
