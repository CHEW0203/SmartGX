import { Link, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenShell } from "../src/components/common/ScreenShell";
import { useAuthStore } from "../src/store/authStore";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";

const menu = [
  { label: "Transactions", href: "/transactions" as const },
  { label: "Savings", href: "/savings" as const },
  { label: "Debt Risk", href: "/debt-risk" as const },
  { label: "Rewards", href: "/rewards" as const },
  { label: "Campaigns", href: "/campaigns" as const },
  { label: "Security", href: "/security" as const },
  { label: "Profile", href: "/profile" as const },
];

export default function DashboardScreen() {
  const user = useAuthStore((state) => state.currentUser);
  const logout = useAuthStore((state) => state.logout);

  if (!user) {
    router.replace("/auth/login");
    return null;
  }

  return (
    <ScreenShell title={`Hi, ${user.name}`} subtitle="SmartGX Step 1 navigation scaffold">
      <Text style={styles.info}>Logged in as {user.email}</Text>
      <View style={styles.grid}>
        {menu.map((item) => (
          <Link key={item.href} href={item.href} style={styles.link}>{item.label}</Link>
        ))}
      </View>
      <Pressable
        style={styles.logout}
        onPress={() => {
          logout();
          router.replace("/auth/login");
        }}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  info: { color: colors.textSecondary, marginBottom: spacing.sm },
  grid: { gap: spacing.sm },
  link: { color: colors.primary, fontSize: 16, fontWeight: "600" },
  logout: { marginTop: spacing.md },
  logoutText: { color: colors.danger, fontWeight: "700" },
});
