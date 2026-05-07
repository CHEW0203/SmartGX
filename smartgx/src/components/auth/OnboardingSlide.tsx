import { StyleSheet, Text, View } from "react-native";
import { SmartCard } from "../common/SmartCard";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

interface OnboardingSlideProps {
  title: string;
  message: string;
  index: number;
}

export const OnboardingSlide = ({ title, message, index }: OnboardingSlideProps) => {
  return (
    <SmartCard>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Step {index + 1}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </SmartCard>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  badgeText: {
    color: colors.aiInsight,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontSize: typography.caption,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.heading,
    fontWeight: "700",
  },
  message: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
  },
});
