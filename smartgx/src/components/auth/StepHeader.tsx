import { StyleSheet, Text, View } from "react-native";
import { ProgressBar } from "../common/ProgressBar";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { STEP_LABELS, TOTAL_STEPS } from "../../features/auth/onboarding.route";

interface StepHeaderProps {
  step: number;
}

export const StepHeader = ({ step }: StepHeaderProps) => {
  const label = STEP_LABELS[step] ?? "";
  const progress = (step - 1) / TOTAL_STEPS;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            Step {step - 1} of {TOTAL_STEPS}
          </Text>
        </View>
        <Text style={styles.stepLabel}>{label}</Text>
      </View>
      <ProgressBar progress={progress} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    backgroundColor: colors.muted,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  badgeText: {
    color: colors.aiInsight,
    fontWeight: "700",
    fontSize: typography.caption,
    letterSpacing: 0.4,
  },
  stepLabel: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: typography.caption,
  },
});
