import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AuthField, AuthForm } from "./AuthForm";
import { PrimaryButton } from "../common/PrimaryButton";
import { SmartCard } from "../common/SmartCard";
import { SectionTitle } from "../common/SectionTitle";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

interface LoginCardProps {
  email: string;
  password: string;
  emailError?: string;
  passwordError?: string;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onLogin: () => void;
  formError?: string;
  isSubmitting?: boolean;
}

export const LoginCard = ({
  email,
  password,
  emailError,
  passwordError,
  onChangeEmail,
  onChangePassword,
  onLogin,
  formError,
  isSubmitting,
}: LoginCardProps) => {
  return (
    <SmartCard>
      <SectionTitle title="Welcome back" subtitle="Sign in to continue managing your money with SmartGX." />
      <AuthForm>
        <AuthField
          label="Email"
          value={email}
          onChangeText={onChangeEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          error={emailError}
        />
        <AuthField
          label="Password"
          value={password}
          onChangeText={onChangePassword}
          placeholder="At least 8 characters"
          secureTextEntry
          error={passwordError}
        />
      </AuthForm>
      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      <PrimaryButton label={isSubmitting ? "Signing in..." : "Login"} onPress={onLogin} disabled={isSubmitting} />
      <View style={styles.footer}>
        <Text style={styles.footerText}>New to SmartGX?</Text>
        <Link href="/auth/register" style={styles.link}>
          Create an account
        </Link>
      </View>
    </SmartCard>
  );
};

const styles = StyleSheet.create({
  formError: {
    color: colors.danger,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  footerText: {
    color: colors.textSecondary,
  },
  link: {
    color: colors.aiInsight,
    fontWeight: "700",
  },
});
