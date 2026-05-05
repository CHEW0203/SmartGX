import { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

interface ScreenShellProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export const ScreenShell = ({ title, subtitle, children }: ScreenShellProps) => (
  <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
    <View style={styles.body}>{children}</View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xs },
  title: { fontSize: typography.heading, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: typography.body, color: colors.textSecondary },
  body: { padding: spacing.lg, gap: spacing.md },
});
