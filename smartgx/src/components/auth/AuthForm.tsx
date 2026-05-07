import type { ReactNode } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/radius";
import { spacing } from "../../theme/spacing";

interface AuthFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  error?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  helperText?: string;
}

export const AuthField = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = "default",
  error,
  autoCapitalize = "none",
  helperText,
}: AuthFieldProps) => {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}
    </View>
  );
};

interface AuthFormProps {
  children: ReactNode;
}

export const AuthForm = ({ children }: AuthFormProps) => {
  return <View style={styles.form}>{children}</View>;
};

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  fieldContainer: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: "600",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
