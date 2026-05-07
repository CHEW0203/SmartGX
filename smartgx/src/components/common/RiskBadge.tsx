import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/radius";
import { spacing } from "../../theme/spacing";

interface RiskBadgeProps {
  label: "Low" | "Medium" | "High";
}

export const RiskBadge = ({ label }: RiskBadgeProps) => {
  const styleMap = {
    Low: styles.low,
    Medium: styles.medium,
    High: styles.high,
  };

  return (
    <View style={[styles.base, styleMap[label]]}>
      <Text style={styles.text}>{label} Risk</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  text: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  low: { backgroundColor: "rgba(34,197,94,0.18)", borderColor: colors.success },
  medium: { backgroundColor: "rgba(245,158,11,0.18)", borderColor: colors.warning },
  high: { backgroundColor: "rgba(239,68,68,0.18)", borderColor: colors.danger },
});
