import { Redirect, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useAuth } from "../src/hooks/useAuth";
import { useSavingsStore } from "../src/store/savingsStore";
import { calcAllocation, detectSalary, MOCK_INCOME_TRANSACTIONS } from "../src/features/savings/savings.engine";
import { formatRM } from "../src/lib/currency";
import { buildHealthInput, computeHealthReport } from "../src/features/health/health.engine";
import { colors } from "../src/theme/colors";
import { radius } from "../src/theme/radius";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";

/* ─── SVG Icon Components ─────────────────────────────────────────── */

function AddIncomeIcon({ size = 22, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M5 12H19" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

function TransferArrowsIcon({ size = 22, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Top arrow — pointing left */}
      <Path d="M18 8H6" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M10 4L6 8L10 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Bottom arrow — pointing right */}
      <Path d="M6 16H18" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M14 12L18 16L14 20" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CardIcon({ size = 22, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Card body */}
      <Rect x="2" y="5" width="20" height="14" rx="2.5" stroke={color} strokeWidth="2" />
      {/* Top stripe */}
      <Path d="M2 10H22" stroke={color} strokeWidth="2.5" />
      {/* Card number hints */}
      <Path d="M6 15H9" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M11 15H14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function BarcodeIcon({ size = 26, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Corner brackets */}
      <Path d="M3 9V3H9"   stroke={color} strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 3H21V9" stroke={color} strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 15V21H9" stroke={color} strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 15V21H15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Barcode vertical lines */}
      <Path d="M6 8V16"   stroke={color} strokeWidth="1"   strokeLinecap="round" />
      <Path d="M8 8V16"   stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M10 8V16"  stroke={color} strokeWidth="1"   strokeLinecap="round" />
      <Path d="M12 8V16"  stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M14 8V16"  stroke={color} strokeWidth="1"   strokeLinecap="round" />
      <Path d="M16 8V16"  stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M18 8V16"  stroke={color} strokeWidth="1"   strokeLinecap="round" />
      {/* Horizontal scan line */}
      <Path d="M5 12H19"  stroke={color} strokeWidth="0.8" strokeLinecap="round" strokeDasharray="2 1" />
    </Svg>
  );
}

/* ─── Action & Nav data ───────────────────────────────────────────── */

type ActionItem = {
  label: string;
  route?: string;
  renderIcon: (color?: string) => React.ReactNode;
};

const ACTIONS: ActionItem[] = [
  { label: "Add Money",  renderIcon: (c) => <AddIncomeIcon color={c} /> },
  { label: "Transfer",  renderIcon: (c) => <TransferArrowsIcon color={c} /> },
  { label: "Card",      renderIcon: (c) => <CardIcon color={c} /> },
];

type NavTab = {
  label: string;
  primary?: boolean;
  route?: string;
  renderIcon: (color: string, size?: number) => React.ReactNode;
};

const NAV_TABS: NavTab[] = [
  { label: "Home",    renderIcon: (c, s = 22) => (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.6 5.4 21 6 21H9M19 10L21 12M19 10V20C19 20.6 18.6 21 18 21H15M9 21V15C9 14.4 9.4 14 10 14H14C14.6 14 15 14.4 15 15V21M9 21H15" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  { label: "Saving", route: "/savings", renderIcon: (c, s = 22) => (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M5 12C5 9.24 7.24 7 10 7H14C16.76 7 19 9.24 19 12C19 14.76 16.76 17 14 17H10C7.24 17 5 14.76 5 12Z" stroke={c} strokeWidth="1.8" />
        <Path d="M19 11C20.1 11 21 11.4 21 12C21 12.6 20.1 13 19 13" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
        <Path d="M9 7C9 5.9 9.6 5 10.5 5H12C12.6 5 13 5.4 13 6V7" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M15 7V5" stroke={c} strokeWidth="2" strokeLinecap="round" />
        <Path d="M11 12H11.01" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
        <Path d="M9 17L8.5 20"  stroke={c} strokeWidth="1.8" strokeLinecap="round" />
        <Path d="M15 17L15.5 20" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      </Svg>
    ),
  },
  { label: "Scan", primary: true, renderIcon: (c, s = 26) => <BarcodeIcon size={s} color={c} /> },
  { label: "GXHealth", route: "/gxhealth", renderIcon: (c, s = 22) => (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M12 21C12 21 4 13.5 4 8.5C4 5.42 6.42 3 9.5 3C11.04 3 12 4 12 4C12 4 12.96 3 14.5 3C17.58 3 20 5.42 20 8.5C20 13.5 12 21 12 21Z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M9 11L11 13L15 9" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  { label: "Profile", route: "/profile", renderIcon: (c, s = 22) => (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M20 21V19C20 17.9 19.1 17 18 17H6C4.9 17 4 17.9 4 19V21" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 13C14.21 13 16 11.21 16 9C16 6.79 14.21 5 12 5C9.79 5 8 6.79 8 9C8 11.21 9.79 13 12 13Z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
];

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function DashboardScreen() {
  const { currentUser } = useAuth();
  const { allocationRule, roundUpEnabled, roundUpTotal } = useSavingsStore();

  if (!currentUser) return <Redirect href="/auth/login" />;

  const monthlyIncome = currentUser.financialProfile?.monthlyIncome ?? 3000;

  // Use detected salary as income basis — same source as savings.tsx for consistent numbers
  const detectedSalary   = detectSalary(MOCK_INCOME_TRANSACTIONS);
  const incomeBase       = detectedSalary?.amount ?? monthlyIncome;
  const lastAllocation   = calcAllocation(incomeBase, allocationRule);
  const bonusBalance     = lastAllocation.bonusPocket + 200;          // +200 manual top-up
  const emergencyBalance = lastAllocation.emergencyFund + (roundUpEnabled ? roundUpTotal : 0);
  const goalBalance      = lastAllocation.goalSavings;
  const totalSavings     = bonusBalance + emergencyBalance + goalBalance;
  const spendingWallet   = lastAllocation.spendingWallet;
  const totalBalance     = spendingWallet + totalSavings;

  // Profile avatar: first letter of full name, or "U" as ultimate fallback
  const avatarLetter = (currentUser.fullName ?? currentUser.id ?? "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  // GXHealth preview — use same incomeBase for consistency
  const healthReport = computeHealthReport(
    buildHealthInput({ monthlyIncome: incomeBase })
  );

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1E0D4E" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Hero: soft gradient, greeting, balance ── */}
        <LinearGradient
          colors={["#3B1578", "#2D0D6B", "#1E0A50", "#12082E"]}
          locations={[0, 0.35, 0.7, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.hero}
        >
          {/* Subtle top tint overlay for depth */}
          <View style={styles.heroTint} pointerEvents="none" />

          {/* Top bar */}
          <View style={styles.topBar}>
            <View>
              <Text style={styles.brand}>SmartGX</Text>
              <Text style={styles.greeting}>Good afternoon, Jason</Text>
              <Text style={styles.welcome}>Your financial overview today</Text>
            </View>

            {/* Profile avatar — letter fallback */}
            <Pressable
              style={styles.profileButton}
              onPress={() => router.push("/profile" as never)}
            >
              <Text style={styles.profileAvatarLetter}>{avatarLetter}</Text>
            </Pressable>
          </View>

          {/* Balance — text in gradient, no hard card */}
          <View style={styles.balanceArea}>
            <Text style={styles.balanceLabel}>Total balance</Text>
            <Text style={styles.totalBalance}>{formatRM(totalBalance)}</Text>
            <View style={styles.heroPillRow}>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>SmartGX secured · Balance info</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ── Shortcuts ── */}
        <View style={styles.actionsWrap}>
          {ACTIONS.map((item) => (
            <Pressable
              key={item.label}
              style={styles.actionItem}
              onPress={() => item.route && router.push(item.route as never)}
            >
              <View style={styles.actionIconWrap}>
                {item.renderIcon("#FFFFFF")}
              </View>
              <Text style={styles.actionLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Everyday Account section ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your everyday account</Text>
          <View style={styles.accountGrid}>
            <View style={styles.accountCard}>
              <Text style={styles.accountLabel}>Main account</Text>
              <Text style={styles.accountAmount}>{formatRM(spendingWallet + emergencyBalance)}</Text>
              <Text style={styles.accountHint}>View transactions</Text>
            </View>
            <Pressable
              style={styles.accountCard}
              onPress={() => router.push("/savings" as never)}
            >
              <Text style={styles.accountLabel}>Saving Pockets</Text>
              <Text style={styles.accountAmount}>{formatRM(totalSavings)}</Text>
              <Text style={styles.accountHint}>Bonus · Emergency · Goals →</Text>
            </Pressable>
          </View>
        </View>

        {/* ── GXHealth preview card ── */}
        <View style={styles.section}>
          <Pressable
            style={styles.healthCard}
            onPress={() => router.push("/gxhealth" as never)}
          >
            {/* Left: score ring mini */}
            <View style={styles.healthRingWrap}>
              <Svg width={56} height={56} viewBox="0 0 56 56">
                <Circle cx={28} cy={28} r={22} stroke="rgba(255,255,255,0.08)" strokeWidth={5} fill="none" />
                <Circle
                  cx={28} cy={28} r={22}
                  stroke={healthReport.statusColor}
                  strokeWidth={5}
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 22} ${2 * Math.PI * 22}`}
                  strokeDashoffset={2 * Math.PI * 22 * (1 - healthReport.score / 100)}
                  strokeLinecap="round"
                  rotation="-90"
                  origin="28,28"
                />
              </Svg>
              <View style={styles.healthRingScore}>
                <Text style={[styles.healthRingNum, { color: healthReport.statusColor }]}>
                  {healthReport.score}
                </Text>
              </View>
            </View>

            {/* Middle: text */}
            <View style={styles.healthCardBody}>
              <View style={styles.healthCardTitleRow}>
                <Text style={styles.healthCardTitle}>GXHealth</Text>
                <View style={[styles.healthStatusPill, { backgroundColor: healthReport.statusColor + "22", borderColor: healthReport.statusColor + "55" }]}>
                  <Text style={[styles.healthStatusPillText, { color: healthReport.statusColor }]}>
                    {healthReport.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.healthCardHint} numberOfLines={2}>
                {healthReport.aiAnalysis}
              </Text>
            </View>

            {/* Right: chevron */}
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M9 18L15 12L9 6" stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Fixed bottom taskbar ── */}
      <View style={styles.tabBar}>
        {NAV_TABS.map((tab) =>
          tab.primary ? (
            <View key={tab.label} style={styles.tabPrimaryWrap}>
              <Pressable style={styles.tabScanBtn}>
                {tab.renderIcon("#FFFFFF", 26)}
              </Pressable>
              <Text style={styles.tabLabelPrimary}>{tab.label}</Text>
            </View>
          ) : (
            <Pressable
              key={tab.label}
              style={styles.tabItem}
              onPress={() => tab.route && router.push(tab.route as never)}
            >
              {tab.renderIcon(colors.textMuted)}
              <Text style={styles.tabLabel}>{tab.label}</Text>
            </Pressable>
          )
        )}
      </View>

      <View style={styles.tabSafeArea} />
    </SafeAreaView>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 90,
  },

  /* Hero */
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 44,
    gap: spacing.xl,
    overflow: "hidden",
  },
  heroTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(90, 30, 180, 0.06)",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brand: {
    color: "#C4B5FD",
    fontWeight: "800",
    fontSize: typography.caption,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
    opacity: 0.85,
  },
  greeting: {
    color: "#FFFFFF",
    fontSize: typography.heading,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  welcome: {
    color: "#BFB0E8",
    fontSize: typography.body,
    marginTop: 2,
    opacity: 0.8,
  },

  /* Profile avatar */
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(109, 40, 217, 0.45)",
    borderWidth: 1.5,
    borderColor: "rgba(196, 181, 253, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarLetter: {
    color: "#EDE9FE",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 20,
  },

  /* Balance */
  balanceArea: {
    gap: spacing.sm,
  },
  balanceLabel: {
    color: "#C4B5FD",
    fontSize: typography.body,
    opacity: 0.9,
  },
  totalBalance: {
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
  },
  heroPillRow: {
    flexDirection: "row",
  },
  heroPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(139, 92, 246, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.22)",
  },
  heroPillText: {
    color: "#C4B5FD",
    fontSize: typography.caption,
    opacity: 0.85,
  },

  /* Actions */
  actionsWrap: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  actionItem: {
    alignItems: "center",
    gap: spacing.sm,
  },
  actionIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: "600",
    textAlign: "center",
  },

  /* Everyday account */
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.subheading,
  },
  accountGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  accountCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  accountLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  accountAmount: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: typography.subheading,
  },
  accountHint: {
    color: colors.textSecondary,
    fontSize: typography.caption,
  },

  /* GXHealth preview card */
  healthCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  healthRingWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  healthRingScore: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  healthRingNum: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 16,
  },
  healthCardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  healthCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  healthCardTitle: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: "700",
  },
  healthStatusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  healthStatusPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  healthCardHint: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },

  /* Taskbar */
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: "flex-end",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingBottom: spacing.sm,
    gap: 3,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  tabLabelPrimary: {
    color: "#A78BFA",
    fontSize: 10,
    fontWeight: "700",
  },
  tabPrimaryWrap: {
    flex: 1,
    alignItems: "center",
    marginTop: -20,
    paddingBottom: spacing.xs,
    gap: 3,
  },
  tabScanBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.background,
  },
  tabSafeArea: {
    backgroundColor: colors.surface,
    height: 16,
  },
});
