import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

export const AppHeader = ({ title, subtitle }: AppHeaderProps) => {
  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <View style={styles.brandDot} />
        <Text style={styles.brand}>SmartGX</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.aiInsight,
  },
  brand: {
    color: colors.aiInsight,
    fontWeight: "800",
    fontSize: typography.caption,
    letterSpacing: 1.2,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: typography.title,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 20,
  },
});
