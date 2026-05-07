import { StyleSheet, Text, View } from "react-native";
import { AuthField, AuthForm } from "./AuthForm";
import { PrimaryButton } from "../common/PrimaryButton";
import { SmartCard } from "../common/SmartCard";
import { SectionTitle } from "../common/SectionTitle";
import { colors } from "../../theme/colors";
import type { RegisterInput } from "../../features/auth/auth.types";

type RegisterErrors = Partial<Record<keyof RegisterInput, string>>;

interface RegisterCardProps {
  input: RegisterInput;
  errors: RegisterErrors;
  onChange: <K extends keyof RegisterInput>(key: K, value: RegisterInput[K]) => void;
  onRegister: () => void;
  formError?: string;
  isSubmitting?: boolean;
}

export const RegisterCard = ({ input, errors, onChange, onRegister, formError, isSubmitting }: RegisterCardProps) => {
  return (
    <SmartCard>
      <SectionTitle
        title="Create your SmartGX account"
        subtitle="Step 1 of onboarding. Identity verification and financial profile follow next."
      />
      <AuthForm>
        <AuthField
          label="Full legal name"
          value={input.fullName}
          onChangeText={(v) => onChange("fullName", v)}
          autoCapitalize="words"
          placeholder="As on your MyKad"
          error={errors.fullName}
        />
        <AuthField
          label="Mobile number"
          value={input.mobileNumber}
          onChangeText={(v) => onChange("mobileNumber", v)}
          keyboardType="phone-pad"
          placeholder="+60123456789"
          error={errors.mobileNumber}
          helperText="Malaysian format: +60 or 01"
        />
        <AuthField
          label="Email address"
          value={input.email}
          onChangeText={(v) => onChange("email", v)}
          keyboardType="email-address"
          placeholder="you@example.com"
          error={errors.email}
        />
        <AuthField
          label="Password"
          value={input.password}
          onChangeText={(v) => onChange("password", v)}
          secureTextEntry
          placeholder="At least 8 characters"
          error={errors.password}
          helperText="Minimum 8 characters."
        />
        <AuthField
          label="Confirm password"
          value={input.confirmPassword}
          onChangeText={(v) => onChange("confirmPassword", v)}
          secureTextEntry
          placeholder="Repeat your password"
          error={errors.confirmPassword}
        />
      </AuthForm>
      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      <PrimaryButton
        label={isSubmitting ? "Creating..." : "Create Account & Continue"}
        onPress={onRegister}
        disabled={isSubmitting}
      />
    </SmartCard>
  );
};

const styles = StyleSheet.create({
  formError: {
    color: colors.danger,
    fontWeight: "600",
  },
});
