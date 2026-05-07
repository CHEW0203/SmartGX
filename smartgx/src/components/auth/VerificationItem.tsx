import { StyleSheet, Text, View } from "react-native";
import type { VerificationStatus } from "../../features/auth/auth.types";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

interface VerificationItemProps {
  label: string;
  status: VerificationStatus;
}

const STATUS_CONFIG: Record<
  VerificationStatus,
  { icon: string; color: string; text: string }
> = {
  not_started: { icon: "○", color: colors.textMuted, text: "Not started" },
  pending: { icon: "◌", color: colors.warning, text: "Pending" },
  demo_verified: { icon: "✓", color: colors.success, text: "Demo Verified" },
  completed: { icon: "✓", color: colors.success, text: "Completed" },
  failed: { icon: "✕", color: colors.danger, text: "Failed" },
};

export const VerificationItem = ({ label, status }: VerificationItemProps) => {
  const config = STATUS_CONFIG[status];
  return (
    <View style={styles.row}>
      <Text style={[styles.icon, { color: config.color }]}>{config.icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.status, { color: config.color }]}>{config.text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  icon: {
    fontSize: 18,
    fontWeight: "700",
    width: 20,
    textAlign: "center",
  },
  label: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: typography.body,
  },
  status: {
    fontWeight: "700",
    fontSize: typography.caption,
  },
});
