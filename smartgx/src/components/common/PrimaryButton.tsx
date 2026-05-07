import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/radius";
import { shadows } from "../../theme/shadows";
import { spacing } from "../../theme/spacing";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "solid" | "outline" | "ghost";
}

export const PrimaryButton = ({ label, onPress, disabled = false, variant = "solid" }: PrimaryButtonProps) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === "solid" && styles.solid,
        variant === "outline" && styles.outline,
        variant === "ghost" && styles.ghost,
        variant === "solid" && shadows.button,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === "solid" && styles.solidLabel,
          variant === "outline" && styles.outlineLabel,
          variant === "ghost" && styles.ghostLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  solid: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  outline: {
    backgroundColor: "transparent",
    borderColor: colors.borderStrong,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  solidLabel: {
    color: "#FFFFFF",
  },
  outlineLabel: {
    color: colors.textPrimary,
  },
  ghostLabel: {
    color: colors.aiInsight,
  },
});
