import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/radius";
import { shadows } from "../../theme/shadows";
import { spacing } from "../../theme/spacing";

interface SmartCardProps {
  children: ReactNode;
  elevated?: boolean;
}

export const SmartCard = ({ children, elevated = false }: SmartCardProps) => {
  return <View style={[styles.card, elevated && styles.elevated, shadows.card]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  elevated: {
    backgroundColor: colors.surfaceElevated,
  },
});
