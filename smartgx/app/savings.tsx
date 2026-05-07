import { useState } from "react";
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
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../src/hooks/useAuth";
import { useSavingsStore } from "../src/store/savingsStore";
import {
  calcAllocation,
  calcRoundUp,
  detectSalary,
  getAIRecommendation,
  MOCK_INCOME_TRANSACTIONS,
  MOCK_SAVINGS_ACTIVITY,
  MOCK_SPEND_AMOUNTS,
  ruleTotal,
} from "../src/features/savings/savings.engine";
import type { AllocationRule, SavingsActivity } from "../src/features/savings/savings.types";
import { formatRM } from "../src/lib/currency";
import { colors } from "../src/theme/colors";
import { radius } from "../src/theme/radius";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";

/* ─── Pocket colour palette ───────────────────────────────────────── */

const PC = {
  spending:  "#E879F9",
  bonus:     "#A78BFA",
  emergency: "#22C55E",
  goal:      "#38BDF8",
} as const;

/* ─── Icon helpers ────────────────────────────────────────────────── */

function BarcodeIcon({ size = 26, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9V3H9"     stroke={color} strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 3H21V9"   stroke={color} strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 15V21H9"   stroke={color} strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 15V21H15" stroke={color} strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 8V16"      stroke={color} strokeWidth="1"   strokeLinecap="round" />
      <Path d="M8 8V16"      stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M10 8V16"     stroke={color} strokeWidth="1"   strokeLinecap="round" />
      <Path d="M12 8V16"     stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M14 8V16"     stroke={color} strokeWidth="1"   strokeLinecap="round" />
      <Path d="M16 8V16"     stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M18 8V16"     stroke={color} strokeWidth="1"   strokeLinecap="round" />
      <Path d="M5 12H19"     stroke={color} strokeWidth="0.8" strokeLinecap="round" strokeDasharray="2 1" />
    </Svg>
  );
}

function PiggyBankIcon({ size = 22, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Body */}
      <Path
        d="M5 12C5 9.24 7.24 7 10 7H14C16.76 7 19 9.24 19 12C19 14.76 16.76 17 14 17H10C7.24 17 5 14.76 5 12Z"
        stroke={color} strokeWidth="1.8"
      />
      {/* Snout / right ear bubble */}
      <Path d="M19 11C20.1 11 21 11.4 21 12C21 12.6 20.1 13 19 13" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      {/* Left ear arc */}
      <Path d="M9 7C9 5.9 9.6 5 10.5 5H12C12.6 5 13 5.4 13 6V7" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* Coin slot */}
      <Path d="M15 7V5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Eye */}
      <Path d="M11 12H11.01" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Legs */}
      <Path d="M9 17L8.5 20"  stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M15 17L15.5 20" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

/* ─── Allocation row (+/− control) ───────────────────────────────── */

function AllocationRow({
  label, value, onIncrease, onDecrease, color, disabled,
}: {
  label: string; value: number;
  onIncrease: () => void; onDecrease: () => void;
  color: string; disabled?: boolean;
}) {
  const dimmed = disabled ? 0.4 : 1;
  return (
    <View style={rowSt.row}>
      <Text style={[rowSt.label, { opacity: dimmed }]}>{label}</Text>
      <View style={rowSt.controls}>
        <Pressable style={[rowSt.btn, { opacity: dimmed }]} onPress={onDecrease} disabled={disabled}>
          <Text style={rowSt.btnText}>−</Text>
        </Pressable>
        <View style={[rowSt.pill, { borderColor: color + "55", backgroundColor: color + "1A" }]}>
          <Text style={[rowSt.pillText, { color }]}>{value}%</Text>
        </View>
        <Pressable style={[rowSt.btn, { opacity: dimmed }]} onPress={onIncrease} disabled={disabled}>
          <Text style={rowSt.btnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const rowSt = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  label:    { color: colors.textSecondary, fontSize: typography.body, fontWeight: "600", flex: 1 },
  controls: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btn:      { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  btnText:  { color: colors.textPrimary, fontSize: 16, lineHeight: 20, fontWeight: "600" },
  pill:     { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, minWidth: 50, alignItems: "center" },
  pillText: { fontSize: 13, fontWeight: "800" },
});

/* ─── Taskbar ─────────────────────────────────────────────────────── */

type NavTab = {
  label: string; primary?: boolean; active?: boolean;
  route?: string;
  renderIcon: (color: string, size?: number) => React.ReactNode;
};

const NAV_TABS: NavTab[] = [
  {
    label: "Home", route: "/dashboard",
    renderIcon: (c, s = 22) => (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.6 5.4 21 6 21H9M19 10L21 12M19 10V20C19 20.6 18.6 21 18 21H15M9 21V15C9 14.4 9.4 14 10 14H14C14.6 14 15 14.4 15 15V21M9 21H15" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    label: "Saving", active: true, route: "/savings",
    renderIcon: (c, s = 22) => <PiggyBankIcon size={s} color={c} />,
  },
  {
    label: "Scan", primary: true,
    renderIcon: (c, s = 26) => <BarcodeIcon size={s} color={c} />,
  },
  {
    label: "GXHealth", route: "/gxhealth",
    renderIcon: (c, s = 22) => (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M12 21C12 21 4 13.5 4 8.5C4 5.42 6.42 3 9.5 3C11.04 3 12 4 12 4C12 4 12.96 3 14.5 3C17.58 3 20 5.42 20 8.5C20 13.5 12 21 12 21Z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M9 11L11 13L15 9" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    label: "Profile", route: "/profile",
    renderIcon: (c, s = 22) => (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M20 21V19C20 17.9 19.1 17 18 17H6C4.9 17 4 17.9 4 19V21" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 13C14.21 13 16 11.21 16 9C16 6.79 14.21 5 12 5C9.79 5 8 6.79 8 9C8 11.21 9.79 13 12 13Z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
];

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function SavingsScreen() {
  const { currentUser } = useAuth();
  const {
    allocationRule, setAllocationRule,
    userAllocationRule, setUserAllocationRule,
    useAIAllocation, setUseAIAllocation,
    roundUpEnabled, roundUpTotal, toggleRoundUp,
  } = useSavingsStore();

  if (!currentUser) return <Redirect href="/auth/login" />;

  const monthlyIncome = currentUser.financialProfile?.monthlyIncome ?? 3000;

  const detectedSalary = detectSalary(MOCK_INCOME_TRANSACTIONS);
  const lastAllocation = calcAllocation(detectedSalary?.amount ?? monthlyIncome, allocationRule);
  const roundUpStats   = calcRoundUp(MOCK_SPEND_AMOUNTS);
  const aiRec          = getAIRecommendation({
    currentRule:      allocationRule,
    monthlyIncome,
    monthlySpend:     monthlyIncome * 0.63,
    emergencyBalance: monthlyIncome * 0.10,
    debtRatio:        0.05,
  });

  const bonusBalance     = lastAllocation.bonusPocket + 200;
  const emergencyBalance = lastAllocation.emergencyFund + (roundUpEnabled ? roundUpTotal : 0);
  const goalBalance      = lastAllocation.goalSavings;
  const totalSavings     = bonusBalance + emergencyBalance + goalBalance;

  // ── Allocation editor state ──
  // localRule mirrors the displayed percentages; persisted state lives in the store.
  const [localRule,   setLocalRule]   = useState<AllocationRule>({ ...allocationRule });
  const [ruleApplied, setRuleApplied] = useState(false);

  // Derive alias so JSX stays readable
  const useAI = useAIAllocation;

  const total   = ruleTotal(localRule);
  const totalOk = total === 100;

  function adjust(key: keyof AllocationRule, delta: number) {
    if (useAI) return;
    setLocalRule((prev) => ({ ...prev, [key]: Math.max(0, Math.min(100, prev[key] + delta)) }));
    setRuleApplied(false);
  }

  function toggleAI() {
    if (!useAI) {
      // Turning ON — snapshot user's current rule, apply AI rule
      setUserAllocationRule(localRule);    // persist manual rule in store
      setLocalRule({ ...aiRec.rule });     // show AI percentages in UI
      setAllocationRule(aiRec.rule);       // update active rule in store
      setRuleApplied(true);
    } else {
      // Turning OFF — restore user's last manually confirmed rule
      setLocalRule({ ...userAllocationRule });
      setAllocationRule(userAllocationRule);
      setRuleApplied(false);
    }
    setUseAIAllocation(!useAI);            // persist toggle state in store
  }

  function applyRule() {
    if (!totalOk || useAI) return;
    setAllocationRule(localRule);
    setUserAllocationRule(localRule);      // persist as manual baseline
    setRuleApplied(true);
  }

  // Apply button states
  const applyBtnStyle = useAI || ruleApplied
    ? styles.applyBtnSuccess
    : !totalOk
    ? styles.applyBtnDisabled
    : styles.applyBtnActive;

  const applyBtnLabel = useAI
    ? "✓ AI Rule Applied"
    : ruleApplied
    ? "✓ Rule Updated"
    : !totalOk
    ? `Total must equal 100% (now ${total}%)`
    : "Confirm Allocation Change";

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#12082E" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Hero ── */}
        <LinearGradient
          colors={["#3B1578", "#2D0D6B", "#1A0845", "#070B14"]}
          locations={[0, 0.4, 0.75, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.hero}
        >
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18L9 12L15 6" stroke="#C4B5FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>

          <Text style={styles.heroTitle}>Savings & Automation</Text>
          <Text style={styles.heroSub}>SmartGX auto-allocates and grows your money</Text>

          <Text style={styles.totalLabel}>Total savings</Text>
          <Text style={styles.totalAmount}>{formatRM(totalSavings)}</Text>

          <View style={styles.pocketPills}>
            {[
              { label: "Bonus",     amount: bonusBalance,     color: PC.bonus },
              { label: "Emergency", amount: emergencyBalance, color: PC.emergency },
              { label: "Goals",     amount: goalBalance,      color: PC.goal },
            ].map((p) => (
              <View key={p.label} style={[styles.pocketPill, { borderColor: p.color + "44", backgroundColor: p.color + "18" }]}>
                <Text style={[styles.pocketPillLabel, { color: p.color }]}>{p.label}</Text>
                <Text style={styles.pocketPillAmount}>{formatRM(p.amount)}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* ── Salary Detection ── */}
        {detectedSalary && (
          <View style={styles.section}>
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.detectedBadge}>
                  <Text style={styles.detectedBadgeText}>✓ Salary Detected</Text>
                </View>
                <View style={[
                  styles.confidencePill,
                  detectedSalary.confidence === "high"
                    ? { backgroundColor: "#22C55E22", borderColor: "#22C55E55" }
                    : { backgroundColor: "#F59E0B22", borderColor: "#F59E0B55" },
                ]}>
                  <Text style={[styles.confidenceText, { color: detectedSalary.confidence === "high" ? "#22C55E" : "#F59E0B" }]}>
                    {detectedSalary.confidence === "high" ? "High confidence" : "Medium confidence"}
                  </Text>
                </View>
              </View>
              <Text style={styles.salarySource}>{detectedSalary.source}</Text>
              <Text style={styles.salaryAmount}>{formatRM(detectedSalary.amount)}</Text>
              <Text style={styles.salaryDate}>Received · {detectedSalary.receivedOn}</Text>
              <View style={styles.divider} />
              <Text style={styles.subLabel}>Auto-allocation applied</Text>
              <View style={styles.allocGrid}>
                {[
                  { label: "Spending",  amount: lastAllocation.spendingWallet, color: PC.spending },
                  { label: "Bonus",     amount: lastAllocation.bonusPocket,    color: PC.bonus },
                  { label: "Emergency", amount: lastAllocation.emergencyFund,  color: PC.emergency },
                  { label: "Goals",     amount: lastAllocation.goalSavings,    color: PC.goal },
                ].map((a) => (
                  <View key={a.label} style={styles.allocCell}>
                    <Text style={[styles.allocAmountSm, { color: a.color }]}>{formatRM(a.amount)}</Text>
                    <Text style={styles.allocCellLabel}>{a.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ── My Allocation Rule ── */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>My Allocation Rule</Text>

            <AllocationRow
              label="Spending Wallet" value={localRule.spendingWallet} color={PC.spending} disabled={useAI}
              onIncrease={() => adjust("spendingWallet",  5)} onDecrease={() => adjust("spendingWallet", -5)}
            />
            <View style={styles.thinDivider} />
            <AllocationRow
              label="Bonus Pocket"   value={localRule.bonusPocket}    color={PC.bonus}     disabled={useAI}
              onIncrease={() => adjust("bonusPocket",     5)} onDecrease={() => adjust("bonusPocket",    -5)}
            />
            <View style={styles.thinDivider} />
            <AllocationRow
              label="Emergency Fund" value={localRule.emergencyFund}  color={PC.emergency} disabled={useAI}
              onIncrease={() => adjust("emergencyFund",   5)} onDecrease={() => adjust("emergencyFund",  -5)}
            />
            <View style={styles.thinDivider} />
            <AllocationRow
              label="Goal Savings"   value={localRule.goalSavings}    color={PC.goal}      disabled={useAI}
              onIncrease={() => adjust("goalSavings",     5)} onDecrease={() => adjust("goalSavings",    -5)}
            />

            {/* Total */}
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Total</Text>
              <Text style={[styles.totalRowValue, { color: totalOk ? "#22C55E" : "#EF4444" }]}>
                {total}% {totalOk ? "✓" : `— ${100 - total > 0 ? "+" : ""}${100 - total}% needed`}
              </Text>
            </View>

            {/* AI toggle */}
            <View style={styles.aiToggleRow}>
              <View style={styles.aiToggleLeft}>
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 2L14.5 9.5H22L16 14.5L18.5 22L12 17L5.5 22L8 14.5L2 9.5H9.5L12 2Z" fill="#A78BFA" />
                </Svg>
                <Text style={styles.aiToggleLabel}>Use AI-customized allocation</Text>
              </View>
              <Pressable
                style={[styles.aiToggleBtn, useAI && styles.aiToggleBtnOn]}
                onPress={toggleAI}
              >
                <Text style={[styles.aiToggleBtnText, useAI && styles.aiToggleBtnTextOn]}>
                  {useAI ? "On" : "Off"}
                </Text>
              </Pressable>
            </View>

            {useAI && (
              <View style={styles.aiExplainBox}>
                <Text style={styles.aiExplainText}>{aiRec.insight}</Text>
              </View>
            )}

            {/* Live preview */}
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Preview for {formatRM(monthlyIncome)}</Text>
              <View style={styles.allocGrid}>
                {[
                  { label: "Spending",  amount: monthlyIncome * localRule.spendingWallet / 100, color: PC.spending },
                  { label: "Bonus",     amount: monthlyIncome * localRule.bonusPocket    / 100, color: PC.bonus },
                  { label: "Emergency", amount: monthlyIncome * localRule.emergencyFund  / 100, color: PC.emergency },
                  { label: "Goals",     amount: monthlyIncome * localRule.goalSavings    / 100, color: PC.goal },
                ].map((a) => (
                  <View key={a.label} style={styles.allocCell}>
                    <Text style={[styles.allocAmountSm, { color: a.color }]}>{formatRM(a.amount)}</Text>
                    <Text style={styles.allocCellLabel}>{a.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Apply button */}
            <Pressable
              style={[styles.applyBtn, applyBtnStyle]}
              onPress={applyRule}
              disabled={useAI || ruleApplied || !totalOk}
            >
              <Text style={[styles.applyBtnText, (useAI || ruleApplied || !totalOk) && styles.applyBtnTextMuted]}>
                {applyBtnLabel}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Round-up Saving ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Round-up Saving</Text>
          <View style={styles.card}>
            <View style={styles.roundupRow}>
              <View style={styles.roundupLeft}>
                <Text style={styles.roundupTotal}>{formatRM(roundUpEnabled ? roundUpStats.totalSaved : 0)}</Text>
                <Text style={styles.roundupLabel}>Total round-up saved</Text>
                <Text style={styles.roundupHint}>
                  {roundUpEnabled
                    ? `${roundUpStats.transactionCount} transactions rounded up to nearest RM`
                    : "Round-up saving is currently off"}
                </Text>
              </View>
              <Pressable
                style={[styles.toggleBtn, roundUpEnabled && styles.toggleBtnOn]}
                onPress={toggleRoundUp}
              >
                <Text style={[styles.toggleBtnText, roundUpEnabled && styles.toggleBtnTextOn]}>
                  {roundUpEnabled ? "On" : "Off"}
                </Text>
              </Pressable>
            </View>
            {roundUpEnabled && (
              <View style={styles.roundupExample}>
                <Text style={styles.roundupExampleText}>
                  Example: RM12.40 → RM13.00 · RM0.60 saved to Bonus Pocket
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Recent Activity ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.card}>
            {MOCK_SAVINGS_ACTIVITY.map((act: SavingsActivity, i: number) => (
              <View key={act.id}>
                {i > 0 && <View style={styles.thinDivider} />}
                <View style={styles.activityRow}>
                  <View style={[styles.activityDot, { backgroundColor: activityColor(act.type) }]} />
                  <View style={styles.activityBody}>
                    <Text style={styles.activityLabel}>{act.label}</Text>
                    <Text style={styles.activityPocket}>{act.pocket} · {act.date}</Text>
                  </View>
                  <Text style={[styles.activityAmount, { color: activityColor(act.type) }]}>
                    +{formatRM(act.amount)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: spacing.xl }} />
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

/* ─── Helper ──────────────────────────────────────────────────────── */

function activityColor(type: SavingsActivity["type"]): string {
  switch (type) {
    case "auto":    return "#A78BFA";
    case "manual":  return "#38BDF8";
    case "roundup": return "#22C55E";
    case "goal":    return "#F59E0B";
  }
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 90 },

  /* Hero */
  hero:             { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  backBtn:          { padding: spacing.xs, alignSelf: "flex-start", marginBottom: spacing.xs },
  heroTitle:        { color: "#FFFFFF", fontSize: typography.title, fontWeight: "800", letterSpacing: -0.3 },
  heroSub:          { color: "#C4B5FD", fontSize: typography.body, opacity: 0.8 },
  totalLabel:       { color: "#C4B5FD", fontSize: typography.body, marginTop: spacing.lg, opacity: 0.85 },
  totalAmount:      { color: "#FFFFFF", fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  pocketPills:      { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  pocketPill:       { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1, gap: 2 },
  pocketPillLabel:  { fontSize: 10, fontWeight: "700" },
  pocketPillAmount: { color: "#FFFFFF", fontSize: typography.caption, fontWeight: "700" },

  /* Sections */
  section:      { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: typography.subheading, marginBottom: spacing.xs },

  /* Card */
  card:             { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg },
  divider:          { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  thinDivider:      { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  cardSectionLabel: { color: colors.textPrimary, fontSize: typography.subheading, fontWeight: "700", marginBottom: spacing.xs },

  /* Salary detection */
  cardHeaderRow:     { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  detectedBadge:     { backgroundColor: "#22C55E22", borderWidth: 1, borderColor: "#22C55E55", borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  detectedBadgeText: { color: "#22C55E", fontSize: 11, fontWeight: "700" },
  confidencePill:    { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  confidenceText:    { fontSize: 10, fontWeight: "600" },
  salarySource:      { color: colors.textMuted, fontSize: typography.caption },
  salaryAmount:      { color: "#FFFFFF", fontSize: typography.title, fontWeight: "800", marginTop: 2 },
  salaryDate:        { color: colors.textMuted, fontSize: typography.caption, marginTop: 2 },
  subLabel:          { color: "#A78BFA", fontSize: typography.caption, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: spacing.sm },

  /* Alloc grid — compact RM amounts */
  allocGrid:     { flexDirection: "row", justifyContent: "space-between" },
  allocCell:     { alignItems: "center", flex: 1 },
  allocAmountSm: { fontSize: 12, fontWeight: "700", letterSpacing: -0.2 },
  allocCellLabel:{ color: colors.textMuted, fontSize: 10, marginTop: 2 },

  /* Rule editor */
  totalRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: spacing.sm, paddingBottom: spacing.xs, marginTop: spacing.xs },
  totalRowLabel: { color: colors.textSecondary, fontSize: typography.body, fontWeight: "700" },
  totalRowValue: { fontSize: typography.body, fontWeight: "800" },

  /* AI toggle */
  aiToggleRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm, marginTop: spacing.xs },
  aiToggleLeft:      { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  aiToggleLabel:     { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  aiToggleBtn:       { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  aiToggleBtnOn:     { backgroundColor: "rgba(167,139,250,0.2)", borderColor: "#7C3AED" },
  aiToggleBtnText:   { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  aiToggleBtnTextOn: { color: "#A78BFA" },
  aiExplainBox:      { marginTop: spacing.xs, backgroundColor: "rgba(167,139,250,0.08)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(167,139,250,0.2)", padding: spacing.md },
  aiExplainText:     { color: "#C4B5FD", fontSize: 12, lineHeight: 18, opacity: 0.92 },

  /* Preview box */
  previewBox:   { marginTop: spacing.md, backgroundColor: colors.backgroundElevated, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  previewLabel: { color: colors.textMuted, fontSize: typography.caption, marginBottom: spacing.xs },

  /* Apply button — 3 states */
  applyBtn:          { marginTop: spacing.lg, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
  applyBtnActive:    { backgroundColor: colors.accent },
  applyBtnDisabled:  { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  applyBtnSuccess:   { backgroundColor: "#1A1A2E", borderWidth: 1, borderColor: "#2D2D4A" },
  applyBtnText:      { color: "#FFFFFF", fontWeight: "700", fontSize: typography.body },
  applyBtnTextMuted: { color: colors.textMuted },

  /* Round-up */
  roundupRow:         { flexDirection: "row", alignItems: "center", gap: spacing.md },
  roundupLeft:        { flex: 1, gap: 3 },
  roundupTotal:       { color: "#22C55E", fontSize: typography.title, fontWeight: "800" },
  roundupLabel:       { color: colors.textPrimary, fontSize: typography.body, fontWeight: "700" },
  roundupHint:        { color: colors.textMuted, fontSize: typography.caption },
  toggleBtn:          { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  toggleBtnOn:        { backgroundColor: "#22C55E22", borderColor: "#22C55E55" },
  toggleBtnText:      { color: colors.textMuted, fontWeight: "700", fontSize: typography.body },
  toggleBtnTextOn:    { color: "#22C55E" },
  roundupExample:     { marginTop: spacing.md, backgroundColor: colors.backgroundElevated, borderRadius: radius.md, padding: spacing.md },
  roundupExampleText: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 18 },

  /* Activity */
  activityRow:    { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  activityDot:    { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  activityBody:   { flex: 1, gap: 2 },
  activityLabel:  { color: colors.textPrimary, fontSize: typography.body, fontWeight: "600" },
  activityPocket: { color: colors.textMuted, fontSize: typography.caption },
  activityAmount: { fontSize: typography.body, fontWeight: "800" },

  /* Taskbar */
  tabBar:          { flexDirection: "row", backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, paddingHorizontal: spacing.sm, alignItems: "flex-end" },
  tabItem:         { flex: 1, alignItems: "center", paddingBottom: spacing.sm, gap: 3 },
  tabLabel:        { color: colors.textMuted, fontSize: 10, fontWeight: "600" },
  tabLabelActive:  { color: "#A78BFA" },
  tabLabelPrimary: { color: "#A78BFA", fontSize: 10, fontWeight: "700" },
  tabPrimaryWrap:  { flex: 1, alignItems: "center", marginTop: -20, paddingBottom: spacing.xs, gap: 3 },
  tabScanBtn:      { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.background },
  tabSafeArea:     { backgroundColor: colors.surface, height: 16 },
});
