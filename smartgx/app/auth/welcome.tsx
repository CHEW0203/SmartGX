import { Redirect, router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "../../src/components/common/PrimaryButton";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { useAuth } from "../../src/hooks/useAuth";
import { colors } from "../../src/theme/colors";
import { radius } from "../../src/theme/radius";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

const FEATURES = [
  { icon: "💰", label: "Auto-save income" },
  { icon: "🧠", label: "AI spending nudges" },
  { icon: "🔒", label: "Secure digital onboarding" },
];

export default function WelcomeScreen() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <ScreenShell scroll={false}>
      <View style={styles.container}>
        {/* ── Brand section ── */}
        <View style={styles.brand}>
          <View style={styles.badge}>
            <Text style={styles.badgeS}>S</Text>
            <Text style={styles.badgeG}>G</Text>
            <Text style={styles.badgeX}>X</Text>
          </View>

          <View style={styles.wordmark}>
            <Text style={styles.wordmarkText}>SmartGX</Text>
            <View style={styles.wordmarkDivider} />
          </View>

          <Text style={styles.headline}>Make every{"\n"}ringgit count.</Text>
          <Text style={styles.subline}>
            An AI-powered financial resilience layer that helps Malaysian youth
            save automatically, spend wisely, and stay debt-free.
          </Text>
        </View>

        {/* ── Feature pills ── */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.pill}>
              <Text style={styles.pillIcon}>{f.icon}</Text>
              <Text style={styles.pillLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <PrimaryButton
            label="Create Account"
            onPress={() => router.push("/auth/register")}
          />
          <PrimaryButton
            label="Login"
            onPress={() => router.push("/auth/login")}
            variant="outline"
          />
        </View>

        {/* ── Disclaimer ── */}
        <Text style={styles.disclaimer}>
          Prototype demonstration only.{"\n"}No real banking operations are
          performed.
        </Text>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },

  /* Brand */
  brand: {
    gap: spacing.md,
  },
  badge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 1,
    marginBottom: spacing.sm,
  },
  badgeS: {
    fontSize: 44,
    fontWeight: "900",
    color: colors.primary,
    letterSpacing: -1,
  },
  badgeG: {
    fontSize: 44,
    fontWeight: "900",
    color: colors.aiInsight,
    letterSpacing: -1,
  },
  badgeX: {
    fontSize: 44,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  wordmark: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  wordmarkText: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: typography.caption,
    letterSpacing: 2,
  },
  wordmarkDivider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  subline: {
    color: colors.textSecondary,
    lineHeight: 22,
    fontSize: typography.body,
  },

  /* Features */
  features: {
    gap: spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  pillIcon: {
    fontSize: 18,
  },
  pillLabel: {
    color: colors.textPrimary,
    fontWeight: "600",
    fontSize: typography.body,
  },

  /* Actions */
  actions: {
    gap: spacing.md,
  },

  /* Disclaimer */
  disclaimer: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: "center",
    lineHeight: 18,
  },
});
