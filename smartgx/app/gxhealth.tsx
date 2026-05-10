import { Redirect, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { useAuth } from "../src/hooks/useAuth";
import type { HealthFactor, HealthReport, HealthTrend } from "../src/features/health/health.types";
import { useHealthData } from "../src/hooks/useHealthData";
import { colors } from "../src/theme/colors";
import { radius } from "../src/theme/radius";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";

/* ─── Barcode icon (taskbar Scan) ─────────────────────────────────── */

function BarcodeIcon({ size = 26, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9V3H9"    stroke={color} strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 3H21V9"  stroke={color} strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 15V21H9"  stroke={color} strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 15V21H15" stroke={color} strokeWidth="2"  strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 8V16"    stroke={color} strokeWidth="1"   strokeLinecap="round" />
      <Path d="M8 8V16"    stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M10 8V16"   stroke={color} strokeWidth="1"   strokeLinecap="round" />
      <Path d="M12 8V16"   stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M14 8V16"   stroke={color} strokeWidth="1"   strokeLinecap="round" />
      <Path d="M16 8V16"   stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M18 8V16"   stroke={color} strokeWidth="1"   strokeLinecap="round" />
      <Path d="M5 12H19"   stroke={color} strokeWidth="0.8" strokeLinecap="round" strokeDasharray="2 1" />
    </Svg>
  );
}

/* ─── Score ring (SVG arc) ────────────────────────────────────────── */

const RING_R      = 72;
const RING_STROKE = 10;
const RING_SIZE   = (RING_R + RING_STROKE) * 2 + 8;
const RING_CIRC   = 2 * Math.PI * RING_R;

function ScoreRing({ score, color }: { score: number; color: string }) {
  const offset = RING_CIRC * (1 - score / 100);
  const cx     = RING_SIZE / 2;
  const cy     = RING_SIZE / 2;
  return (
    <Svg width={RING_SIZE} height={RING_SIZE}>
      <Circle cx={cx} cy={cy} r={RING_R} stroke="rgba(255,255,255,0.08)" strokeWidth={RING_STROKE} fill="none" />
      <Circle
        cx={cx} cy={cy} r={RING_R}
        stroke={color}
        strokeWidth={RING_STROKE}
        fill="none"
        strokeDasharray={`${RING_CIRC} ${RING_CIRC}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${cx},${cy}`}
      />
    </Svg>
  );
}

/* ─── Factor progress bar ─────────────────────────────────────────── */

function FactorBar({ score, color }: { score: number; color: string }) {
  return (
    <View style={styles.factorBarTrack}>
      <View
        style={[
          styles.factorBarFill,
          { width: `${score}%` as never, backgroundColor: color },
        ]}
      />
    </View>
  );
}

/* ─── Trend meta ──────────────────────────────────────────────────── */

const TREND_META: Record<HealthTrend, { label: string; color: string; bg: string }> = {
  improving: { label: "↑ Improving",  color: "#22C55E", bg: "rgba(34,197,94,0.15)" },
  stable:    { label: "→ Stable",     color: "#F59E0B", bg: "rgba(245,158,11,0.15)" },
  declining: { label: "↓ Declining",  color: "#EF4444", bg: "rgba(239,68,68,0.15)" },
};

/* ─── Taskbar ─────────────────────────────────────────────────────── */

type NavTab = {
  label: string;
  primary?: boolean;
  active?: boolean;
  route?: string;
  renderIcon: (color: string, size?: number) => React.ReactNode;
};

const NAV_TABS: NavTab[] = [
  {
    label: "Home",
    route: "/dashboard",
    renderIcon: (c, s = 22) => (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.6 5.4 21 6 21H9M19 10L21 12M19 10V20C19 20.6 18.6 21 18 21H15M9 21V15C9 14.4 9.4 14 10 14H14C14.6 14 15 14.4 15 15V21M9 21H15" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    label: "Saving",
    route: "/savings",
    renderIcon: (c, s = 22) => (
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
  {
    label: "Scan",
    primary: true,
    renderIcon: (c, s = 26) => <BarcodeIcon size={s} color={c} />,
  },
  {
    label: "GXHealth",
    active: true,
    route: "/gxhealth",
    renderIcon: (c, s = 22) => (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M12 21C12 21 4 13.5 4 8.5C4 5.42 6.42 3 9.5 3C11.04 3 12 4 12 4C12 4 12.96 3 14.5 3C17.58 3 20 5.42 20 8.5C20 13.5 12 21 12 21Z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M9 11L11 13L15 9" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    label: "Transaction",
    route: "/transactions",
    renderIcon: (c, s = 22) => (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M3 8C3 6.9 3.9 6 5 6H19C20.1 6 21 6.9 21 8V16C21 17.1 20.1 18 19 18H5C3.9 18 3 17.1 3 16V8Z" stroke={c} strokeWidth="1.8" />
        <Path d="M15.5 12C15.5 13.93 13.93 15.5 12 15.5C10.07 15.5 8.5 13.93 8.5 12C8.5 10.07 10.07 8.5 12 8.5C13.93 8.5 15.5 10.07 15.5 12Z" stroke={c} strokeWidth="1.5" />
        <Path d="M5 9.5H6.5V11H5V9.5Z" stroke={c} strokeWidth="1.2" strokeLinejoin="round" />
        <Path d="M17.5 13H19V14.5H17.5V13Z" stroke={c} strokeWidth="1.2" strokeLinejoin="round" />
      </Svg>
    ),
  },
];

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function GXHealthScreen() {
  const { currentUser } = useAuth();
  const report: HealthReport = useHealthData();

  if (!currentUser) return <Redirect href="/auth/login" />;

  const trend = TREND_META[report.trend];

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0529" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Hero ── */}
        <LinearGradient
          colors={["#1A0845", "#0F0529", "#070B14"]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.hero}
        >
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18L9 12L15 6" stroke="#C4B5FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>

          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>GXHealth</Text>
            <Text style={styles.heroSubtitle}>Your financial health at a glance</Text>
          </View>

          {/* Score ring with score + status overlaid */}
          <View style={styles.scoreContainer}>
            <ScoreRing score={report.score} color={report.statusColor} />
            <View style={styles.scoreOverlay} pointerEvents="none">
              <Text style={[styles.scoreNumber, { color: report.statusColor }]}>
                {report.score}
              </Text>
              <Text style={styles.scoreMax}>/100</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    borderColor:       report.statusColor + "55",
                    backgroundColor:   report.statusColor + "20",
                  },
                ]}
              >
                <Text style={[styles.statusBadgeText, { color: report.statusColor }]}>
                  {report.status}
                </Text>
              </View>
            </View>
          </View>

          {/* Trend pill */}
          <View style={styles.trendRow}>
            <View
              style={[
                styles.trendPill,
                { backgroundColor: trend.bg, borderColor: trend.color + "44" },
              ]}
            >
              <Text style={[styles.trendText, { color: trend.color }]}>
                {trend.label} this week
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── AI Analysis card ── */}
        <View style={styles.section}>
          <View style={styles.aiCard}>
            <View style={styles.aiCardHeader}>
              {/* Spark / AI icon */}
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2L14.5 9.5H22L16 14.5L18.5 22L12 17L5.5 22L8 14.5L2 9.5H9.5L12 2Z" fill="#A78BFA" />
              </Svg>
              <Text style={styles.aiCardLabel}>AI Analysis</Text>
            </View>
            {report.gxHealthAiStructured ? (
              <>
                <Text style={styles.aiCardText}>{report.gxHealthAiStructured.summary}</Text>
                <Text style={styles.aiSectionLabel}>Why this GXHealth score</Text>
                <Text style={styles.aiCardText}>{report.gxHealthAiStructured.scoreExplanation}</Text>
                {report.gxHealthAiStructured.positiveSignals.length > 0 ? (
                  <>
                    <Text style={styles.aiSectionLabel}>Positive signals</Text>
                    {report.gxHealthAiStructured.positiveSignals.map((line, i) => (
                      <Text key={`p-${i}`} style={styles.aiBulletText}>
                        • {line}
                      </Text>
                    ))}
                  </>
                ) : null}
                {report.gxHealthAiStructured.riskSignals.length > 0 ? (
                  <>
                    <Text style={styles.aiSectionLabel}>Risk signals</Text>
                    {report.gxHealthAiStructured.riskSignals.map((line, i) => (
                      <Text key={`r-${i}`} style={styles.aiBulletText}>
                        • {line}
                      </Text>
                    ))}
                  </>
                ) : null}
                {report.gxHealthAiStructured.priorityAction ? (
                  <>
                    <Text style={styles.aiSectionLabel}>Priority</Text>
                    <Text style={styles.aiCardText}>{report.gxHealthAiStructured.priorityAction}</Text>
                  </>
                ) : null}
                <Text style={styles.aiConfidence}>
                  Confidence: {report.gxHealthAiStructured.confidence}
                </Text>
              </>
            ) : (
              <Text style={styles.aiCardText}>{report.gxHealthAiBody || report.aiAnalysis}</Text>
            )}
          </View>
        </View>

        {/* ── Key Factors ── */}
        <View style={styles.section}>
          <View style={styles.factorsCard}>
            {report.factors.map((factor: HealthFactor, i: number) => (
              <View key={factor.key}>
                {i > 0 && <View style={styles.factorDivider} />}
                <View style={styles.factorRow}>
                  <View style={styles.factorLeft}>
                    {/* Name + status label row */}
                    <View style={styles.factorNameRow}>
                      <Text style={styles.factorLabel}>{factor.label}</Text>
                      <View
                        style={[
                          styles.factorStatusPill,
                          {
                            backgroundColor: factor.statusColor + "1A",
                            borderColor:     factor.statusColor + "55",
                          },
                        ]}
                      >
                        <Text style={[styles.factorStatusText, { color: factor.statusColor }]}>
                          {factor.statusLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Progress bar — driven by calculated score */}
                    <FactorBar score={factor.score} color={factor.statusColor} />

                    {/* Behaviour explanation */}
                    <Text style={styles.factorExplanation}>{factor.behaviorExplanation}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Recommended Actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended Actions</Text>
          <View style={styles.actionsCard}>
            {(report.gxHealthAiStructured?.recommendedActions?.length
              ? report.gxHealthAiStructured.recommendedActions
              : report.suggestions.map((s) => ({ title: s, reason: "", impact: "" }))
            ).map((item, i) => (
              <View key={i} style={styles.actionRow}>
                <View style={[styles.actionDot, { backgroundColor: report.statusColor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionText}>{item.title}</Text>
                  {item.reason ? <Text style={styles.actionSubText}>{item.reason}</Text> : null}
                  {item.impact ? <Text style={styles.actionImpactText}>{item.impact}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Weekly Trend ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Trend</Text>
          <View style={styles.trendCard}>
            <View
              style={[
                styles.trendIndicator,
                { backgroundColor: trend.bg, borderColor: trend.color + "55" },
              ]}
            >
              <Text style={[styles.trendIndicatorText, { color: trend.color }]}>
                {trend.label}
              </Text>
            </View>
            <Text style={styles.trendDescription}>
              {report.trend === "improving"
                ? "Your financial health has improved compared to last week. Maintain your current habits to keep climbing."
                : report.trend === "stable"
                ? "Your health score is holding steady. Small, consistent changes to spending and saving can push it higher."
                : "Your score has declined recently. Review the recommended actions above and focus on your top spending category."}
            </Text>
          </View>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* ── Fixed bottom taskbar ── */}
      <View style={styles.tabBar}>
        {NAV_TABS.map((tab) =>
          tab.primary ? (
            <View key={tab.label} style={styles.tabPrimaryWrap}>
              <Pressable
                style={styles.tabScanBtn}
                onPress={() => router.push("/scan" as never)}
              >
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
              {tab.renderIcon(tab.active ? "#A78BFA" : colors.textMuted)}
              <Text style={[styles.tabLabel, tab.active && styles.tabLabelActive]}>
                {tab.label}
              </Text>
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
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
    alignItems: "center",
  },
  backBtn: {
    alignSelf: "flex-start",
    padding: spacing.xs,
    marginBottom: -spacing.xs,
  },
  heroHeader: {
    alignItems: "center",
    gap: spacing.xs,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: typography.title,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    color: "#C4B5FD",
    fontSize: typography.body,
    opacity: 0.85,
  },

  /* Score ring */
  scoreContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  scoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    paddingHorizontal: spacing.sm,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: "800",
    lineHeight: 52,
    letterSpacing: -2,
  },
  scoreMax: {
    color: "rgba(255,255,255,0.4)",
    fontSize: typography.caption,
    fontWeight: "600",
    marginTop: -2,
  },
  statusBadge: {
    marginTop: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: RING_SIZE - RING_STROKE * 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.15,
    textAlign: "center",
  },

  /* Trend row (hero) */
  trendRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  trendPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  trendText: {
    fontSize: typography.caption,
    fontWeight: "600",
  },

  /* Sections */
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.subheading,
    marginBottom: spacing.xs,
  },

  /* AI Analysis card */
  aiCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  aiCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  aiCardLabel: {
    color: "#A78BFA",
    fontSize: typography.caption,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  aiCardText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 23,
  },
  aiSectionLabel: {
    color: "#C4B5FD",
    fontSize: typography.caption,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  aiBulletText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
  },
  aiConfidence: {
    color: colors.textMuted,
    fontSize: typography.caption,
    marginTop: spacing.xs,
  },
  actionSubText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
    marginTop: 2,
  },
  actionImpactText: {
    color: "#A78BFA",
    fontSize: typography.caption,
    lineHeight: 20,
    marginTop: 2,
  },

  /* Factors card */
  factorsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  factorDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  factorRow: {
    padding: spacing.lg,
  },
  factorLeft: {
    gap: spacing.sm,
  },
  factorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  factorLabel: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: "700",
  },
  factorStatusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  factorStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  factorBarTrack: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 3,
    overflow: "hidden",
  },
  factorBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  factorExplanation: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },

  /* Recommended Actions */
  actionsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  actionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 7,
    flexShrink: 0,
  },
  actionText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
  },

  /* Weekly trend card */
  trendCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  trendIndicator: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  trendIndicatorText: {
    fontSize: typography.body,
    fontWeight: "700",
  },
  trendDescription: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
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
  tabLabelActive: {
    color: "#A78BFA",
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
    backgroundColor: colors.taskbarScan,
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
