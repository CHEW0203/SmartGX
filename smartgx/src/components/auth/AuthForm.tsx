import { useState } from "react";
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
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#4A5568"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        underlineColorAndroid="transparent"
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}
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
    color: "#C4B5FD",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: "#0A0F1E",
    borderWidth: 1.5,
    borderColor: "#1E2A42",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: "#F1F5F9",
    fontSize: 15,
    // Prevent Android system default background
  },
  inputFocused: {
    borderColor: "#7C3AED",
    backgroundColor: "#0C1228",
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
