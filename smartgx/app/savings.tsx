import { useState, useRef } from "react";
import { Redirect, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { useAuth } from "../src/hooks/useAuth";
import { useSavingsStore } from "../src/store/savingsStore";
import { useAccountStore } from "../src/store/accountStore";
import { useNotificationStore } from "../src/store/notificationStore";
import { useActivityStore } from "../src/store/activityStore";
import { useGamificationStore } from "../src/store/gamificationStore";
import {
  calcAllocation,
  getAIRecommendation,
  ruleTotal,
} from "../src/features/savings/savings.engine";
import type { AllocationRule, SavingsActivity } from "../src/features/savings/savings.types";
import { formatRM } from "../src/lib/currency";
import { safeNumber } from "../src/lib/number";
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

/** Fixed sample income for allocation % preview only (does not follow live income). */
const ALLOCATION_PREVIEW_INCOME_RM = 1200;

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
    label: "Transaction", route: "/transactions",
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

export default function SavingsScreen() {
  const { currentUser } = useAuth();
  const {
    allocationRule, setAllocationRule,
    userAllocationRule, setUserAllocationRule,
    useAIAllocation, setUseAIAllocation,
    roundUpEnabled, roundUpTotal, toggleRoundUp, roundUpDestination, setRoundUpDestination,
    savingsBuckets, manualSave, manualActivities, addManualActivity,
    latestAutoAllocation,
  } = useSavingsStore();
  const accountStore      = useAccountStore();
  const { addNotification } = useNotificationStore();
  const { addActivity } = useActivityStore();
  const currentStreak = useGamificationStore((s) => s.currentStreak);
  const streakMilestonesClaimed = useGamificationStore((s) => s.streakMilestonesClaimed);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveAmount, setSaveAmount] = useState("");
  const [saveDest, setSaveDest] = useState<"bonus" | "emergency" | "goals">("bonus");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveAmtRef = useRef<TextInput>(null);
  const [localRule, setLocalRule] = useState<AllocationRule>(() => ({ ...allocationRule }));
  const [ruleApplied, setRuleApplied] = useState(false);

  if (!currentUser) return <Redirect href="/auth/login" />;

  const declaredMonthlyIncome = safeNumber(currentUser.financialProfile?.monthlyIncome, 0);
  /** Same idea as GXHealth: last income / allocation amount wins when profile income is unset (0). */
  const allocationPreviewIncome = safeNumber(latestAutoAllocation?.amount, declaredMonthlyIncome);

  const lastAllocation = latestAutoAllocation
    ? {
        income: latestAutoAllocation.amount,
        spendingWallet: latestAutoAllocation.breakdown.spendingWallet,
        bonusPocket: latestAutoAllocation.breakdown.bonus,
        emergencyFund: latestAutoAllocation.breakdown.emergency,
        goalSavings: latestAutoAllocation.breakdown.goals,
      }
    : calcAllocation(allocationPreviewIncome, allocationRule);
  const savedFromThisIncome = latestAutoAllocation
    ? Math.round((lastAllocation.bonusPocket + lastAllocation.emergencyFund + lastAllocation.goalSavings) * 100) / 100
    : 0;
  const aiRec          = getAIRecommendation({
    currentRule:      allocationRule,
    monthlyIncome:    allocationPreviewIncome,
    monthlySpend:     allocationPreviewIncome * 0.63,
    emergencyBalance: allocationPreviewIncome * 0.10,
    debtRatio:        0.05,
  });

  const bonusBalance     = savingsBuckets.bonus;
  const emergencyBalance = savingsBuckets.emergency;
  const goalBalance      = savingsBuckets.goals;
  const totalSavings     = bonusBalance + emergencyBalance + goalBalance;
  const BASE_ANNUAL_RATE = 0.02;
  const bonusDailyInterest = bonusBalance * (BASE_ANNUAL_RATE / 365);
  const emergencyDailyInterest = emergencyBalance * (BASE_ANNUAL_RATE / 365);
  const goalDailyInterest = goalBalance * (BASE_ANNUAL_RATE / 365);
  const totalDailyInterest = bonusDailyInterest + emergencyDailyInterest + goalDailyInterest;
  const streakMilestones = [
    { id: "streak-3", name: "3-Day Saving Streak Reward", reward: 1, target: 3 },
    { id: "streak-7", name: "7-Day Saving Streak Reward", reward: 3, target: 7 },
    { id: "streak-14", name: "14-Day Saving Streak Reward", reward: 8, target: 14 },
    { id: "streak-30", name: "30-Day Saving Streak Reward", reward: 20, target: 30 },
  ];
  const activeRewardProgress = streakMilestones.find((m) => !streakMilestonesClaimed.includes(m.id));
  const activeRewardCurrent = activeRewardProgress ? Math.min(currentStreak, activeRewardProgress.target) : 0;
  const activeRewardRemaining = activeRewardProgress ? Math.max(0, activeRewardProgress.target - activeRewardCurrent) : 0;

  const parsedSaveAmt = parseFloat(saveAmount.replace(/[^0-9.]/g, "")) || 0;

  function handleManualSave() {
    if (parsedSaveAmt <= 0) { setSaveError("Enter a valid amount."); return; }
    if (parsedSaveAmt > accountStore.mainBalance) {
      setSaveError(`Insufficient balance. Available: RM${accountStore.mainBalance.toFixed(2)}`);
      return;
    }
    const destLabel =
      saveDest === "bonus" ? "Bonus Pocket" : saveDest === "emergency" ? "Emergency Fund" : "Goals";
    accountStore.debitPay(parsedSaveAmt);
    manualSave(saveDest, parsedSaveAmt);
    const isoNow = new Date().toISOString();
    // Add to recent activity
    addManualActivity({
      id:     `act-manual-${Date.now()}`,
      label:  `Saved RM${parsedSaveAmt.toFixed(2)} to ${destLabel}`,
      pocket: destLabel,
      amount: parsedSaveAmt,
      date:   isoNow.slice(0, 10),
      occurredAt: isoNow,
      type:   "manual",
    });
    addActivity({
      id: `act-manual-save-${Date.now()}`,
      type: "manual_save",
      title: "Manual Save",
      description: destLabel,
      amount: parsedSaveAmt,
      direction: "credit",
      timestamp: isoNow,
      route: "/savings",
    });
    addNotification({
      id:      `notif-save-${Date.now()}`,
      title:   "Manual save successful",
      message: `RM${parsedSaveAmt.toFixed(2)} saved to ${destLabel}. Keep it up!`,
      time:    "8 May 2026 · Now",
      read:    false,
      type:    "insight",
    });
    setSaveSuccess(true);
  }

  function closeSaveModal() {
    setShowSaveModal(false);
    setSaveAmount(""); setSaveError(""); setSaveSuccess(false);
    setSaveDest("bonus");
  }

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

      {/* ── Manual Save Modal ── */}
      <Modal visible={showSaveModal} transparent animationType="slide" onRequestClose={closeSaveModal}>
        <View style={sv.overlay}>
          <View style={sv.sheet}>
            <View style={sv.handle} />
            {saveSuccess ? (
              <View style={sv.successWrap}>
                <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="12" r="10" fill="rgba(34,197,94,0.15)" stroke="#22C55E" strokeWidth="1.5" />
                  <Path d="M8 12L11 15L16 9" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={sv.successTitle}>Saved Successfully!</Text>
                <Text style={sv.successMsg}>
                  RM{parsedSaveAmt.toFixed(2)} added to{" "}
                  {saveDest === "bonus" ? "Bonus Pocket" : saveDest === "emergency" ? "Emergency Fund" : "Goals"}.
                </Text>
                <Pressable
                  style={[sv.primaryBtn, sv.successDoneBtn]}
                  onPress={closeSaveModal}
                >
                  <Text style={sv.primaryBtnText}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <View style={sv.form}>
                <Text style={sv.title}>Manual Save</Text>
                <Text style={sv.balance}>
                  Available: <Text style={{ color: "#22C55E" }}>RM{accountStore.mainBalance.toFixed(2)}</Text>
                </Text>

                {/* Destination */}
                <Text style={sv.label}>Save to</Text>
                <View style={sv.destRow}>
                  {(["bonus", "emergency", "goals"] as const).map((d) => (
                    <Pressable
                      key={d}
                      style={[sv.destChip, saveDest === d && sv.destChipActive]}
                      onPress={() => setSaveDest(d)}
                    >
                      <Text style={[sv.destChipText, saveDest === d && { color: "#A78BFA" }]}>
                        {d === "bonus" ? "Bonus" : d === "emergency" ? "Emergency" : "Goals"}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Amount */}
                <Text style={sv.label}>Amount</Text>
                <View style={sv.amountWrap}>
                  <Text style={sv.amountPrefix}>RM</Text>
                  <TextInput
                    ref={saveAmtRef}
                    style={sv.amountInput}
                    value={saveAmount}
                    onChangeText={(v) => { setSaveAmount(v); setSaveError(""); }}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                  />
                </View>
                {saveError ? <Text style={sv.errorText}>{saveError}</Text> : null}

                <View style={sv.btnRow}>
                  <Pressable style={sv.cancelBtn} onPress={closeSaveModal}>
                    <Text style={sv.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[sv.primaryBtn, parsedSaveAmt <= 0 && sv.btnDisabled]}
                    onPress={handleManualSave}
                  >
                    <Text style={[sv.primaryBtnText, parsedSaveAmt <= 0 && { opacity: 0.4 }]}>Save Now</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Hero ── */}
        <LinearGradient
          colors={["#3B1578", "#2D0D6B", "#1A0845", "#070B14"]}
          locations={[0, 0.4, 0.75, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.hero}
        >
          <Pressable style={styles.backBtn} onPress={() => router.push("/dashboard" as never)}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18L9 12L15 6" stroke="#C4B5FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>

          <Text style={styles.heroTitle}>Savings & Automation</Text>
          <Text style={styles.heroSub}>SmartGX auto-allocates and grows your money</Text>

          <Text style={styles.totalLabel}>Total savings</Text>
          <Text style={styles.totalAmount}>{formatRM(totalSavings)}</Text>
          <View style={styles.dailyInterestHeroPill}>
            <Text style={styles.dailyInterestHeroLabel}>Estimated daily interest</Text>
            <Text style={styles.dailyInterestHeroAmount}>{formatRM(totalDailyInterest)} / day</Text>
          </View>

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

        {/* ── Manual Save button ── */}
        <View style={styles.section}>
          <Pressable style={sv.manualSaveBtn} onPress={() => setShowSaveModal(true)}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5V19M5 12H19" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
            </Svg>
            <Text style={sv.manualSaveBtnText}>Manual Save</Text>
          </Pressable>
          <Pressable style={styles.withdrawShortcutBtn} onPress={() => router.push("/addmoney?mode=withdraw" as never)}>
            <Text style={styles.withdrawShortcutText}>Withdraw from Saving</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>Bucket Interest Overview</Text>
            <View style={styles.interestGrid}>
              <View style={styles.interestItem}>
                <Text style={styles.interestBucket}>Bonus</Text>
                <Text style={styles.interestBal}>{formatRM(bonusBalance)}</Text>
                <Text style={styles.interestMeta}>Base rate 2.00% p.a.</Text>
                <Text style={styles.interestMeta}>Est. {formatRM(bonusDailyInterest)}/day</Text>
                <View style={styles.rewardProgressBox}>
                  <Text style={styles.rewardProgressTitle}>Bonus Reward Progress</Text>
                  {activeRewardProgress ? (
                    <View style={{ gap: 2 }}>
                      <Text style={styles.rewardProgressLineStrong}>{activeRewardProgress.name}</Text>
                      <Text style={styles.rewardProgressLine}>RM{activeRewardProgress.reward.toFixed(2)} reward in progress</Text>
                      <Text style={styles.rewardProgressLine}>
                        {activeRewardCurrent} / {activeRewardProgress.target} saving days completed
                      </Text>
                      <Text style={styles.rewardProgressLine}>
                        {activeRewardRemaining} more saving day{activeRewardRemaining === 1 ? "" : "s"} to unlock
                      </Text>
                      <Text style={styles.rewardProgressStatus}>
                        Status: {activeRewardRemaining === 0 ? "Ready to claim" : "In progress"}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 2 }}>
                      <Text style={styles.rewardProgressLineStrong}>No active reward progress yet</Text>
                      <Text style={styles.rewardProgressLine}>
                        Complete saving streaks or missions to unlock rewards.
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.boostHint}>
                  Already credited rewards stay in Bonus balance.
                </Text>
              </View>
              <View style={styles.interestItem}>
                <Text style={styles.interestBucket}>Emergency</Text>
                <Text style={styles.interestBal}>{formatRM(emergencyBalance)}</Text>
                <Text style={styles.interestMeta}>Base rate 2.00% p.a.</Text>
                <Text style={styles.interestMeta}>Est. {formatRM(emergencyDailyInterest)}/day</Text>
              </View>
              <View style={styles.interestItem}>
                <Text style={styles.interestBucket}>Goals</Text>
                <Text style={styles.interestBal}>{formatRM(goalBalance)}</Text>
                <Text style={styles.interestMeta}>Base rate 2.00% p.a.</Text>
                <Text style={styles.interestMeta}>Est. {formatRM(goalDailyInterest)}/day</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Latest Auto Allocation ── */}
        {latestAutoAllocation && (
          <View style={styles.section}>
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.detectedBadge}>
                  <Text style={styles.detectedBadgeText}>✓ Income Detected</Text>
                </View>
                <View style={[
                  styles.confidencePill,
                  latestAutoAllocation.confidence === "high"
                    ? { backgroundColor: "#22C55E22", borderColor: "#22C55E55" }
                    : { backgroundColor: "#F59E0B22", borderColor: "#F59E0B55" },
                ]}>
                  <Text style={[styles.confidenceText, { color: latestAutoAllocation.confidence === "high" ? "#22C55E" : "#F59E0B" }]}>
                    {latestAutoAllocation.confidence === "high"
                      ? "High confidence"
                      : latestAutoAllocation.confidence === "medium"
                        ? "Medium confidence"
                        : "Low confidence"}
                  </Text>
                </View>
              </View>
              <Text style={styles.salarySource}>{latestAutoAllocation.source}</Text>
              <Text style={styles.salaryAmount}>{formatRM(latestAutoAllocation.amount)}</Text>
              <Text style={styles.salaryDate}>
                {latestAutoAllocation.incomeType === "salary"
                  ? "Salary"
                  : latestAutoAllocation.incomeType === "allowance"
                    ? "Allowance"
                    : latestAutoAllocation.incomeType === "part_time"
                      ? "Part-time Income"
                      : latestAutoAllocation.incomeType === "freelance_income"
                        ? "Freelance Income"
                      : "Cash Income"}{" "}
                · Received {latestAutoAllocation.receivedAt.slice(0, 10)}
              </Text>
              <Text style={styles.salaryDate}>Reason: {latestAutoAllocation.detectionReason}</Text>
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
              <View style={styles.savedFromIncomeRow}>
                <Text style={styles.savedFromIncomeLabel}>Saved from this income</Text>
                <Text style={styles.savedFromIncomeValue}>{formatRM(savedFromThisIncome)}</Text>
              </View>
              <View style={styles.divider} />
              <Text style={styles.allocCurrentRuleLine}>
                My allocation rule: {allocationRule.spendingWallet}% / {allocationRule.bonusPocket}% / {allocationRule.emergencyFund}% / {allocationRule.goalSavings}%
              </Text>
              <Pressable style={styles.allocLinkBtn} onPress={() => router.push("/dashboard" as never)}>
                <Text style={styles.allocLinkText}>View from Dashboard</Text>
              </Pressable>
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
              <Text style={styles.previewLabel}>
                Preview: {formatRM(ALLOCATION_PREVIEW_INCOME_RM)}
              </Text>
              <View style={styles.allocGrid}>
                {[
                  { label: "Spending",  amount: ALLOCATION_PREVIEW_INCOME_RM * localRule.spendingWallet / 100, color: PC.spending },
                  { label: "Bonus",     amount: ALLOCATION_PREVIEW_INCOME_RM * localRule.bonusPocket    / 100, color: PC.bonus },
                  { label: "Emergency", amount: ALLOCATION_PREVIEW_INCOME_RM * localRule.emergencyFund  / 100, color: PC.emergency },
                  { label: "Goals",     amount: ALLOCATION_PREVIEW_INCOME_RM * localRule.goalSavings    / 100, color: PC.goal },
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
                <Text style={styles.roundupTotal}>{formatRM(roundUpTotal)}</Text>
                <Text style={styles.roundupLabel}>Total round-up saved</Text>
                <Text style={styles.roundupHint}>
                  {roundUpEnabled
                    ? `Round-up destination: ${roundUpDestination === "bonus" ? "Bonus" : roundUpDestination === "emergency" ? "Emergency" : "Goals"}`
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
                <View style={styles.destSelectorRow}>
                  {(["bonus", "emergency", "goals"] as const).map((d) => (
                    <Pressable
                      key={d}
                      style={[styles.destSelectorChip, roundUpDestination === d && styles.destSelectorChipActive]}
                      onPress={() => setRoundUpDestination(d)}
                    >
                      <Text style={[styles.destSelectorText, roundUpDestination === d && { color: "#A78BFA" }]}>
                        {d === "bonus" ? "Bonus" : d === "emergency" ? "Emergency" : "Goals"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.roundupExampleText}>
                  Example: RM12.40 → RM13.00 · RM0.60 saved to selected destination
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Recent Activity ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.card}>
            {manualActivities.length === 0 ? (
              <Text style={styles.activityEmpty}>No saving activity yet.</Text>
            ) : (
              manualActivities.map((act: SavingsActivity, i: number) => (
                <View key={act.id}>
                  {i > 0 && <View style={styles.thinDivider} />}
                  <View style={styles.activityRow}>
                    <View style={[styles.activityDot, { backgroundColor: activityColor(act.type) }]} />
                    <View style={styles.activityBody}>
                      <Text style={styles.activityLabel}>{act.label}</Text>
                      <Text style={styles.activityPocket}>{act.pocket} · {act.date}</Text>
                    </View>
                    <Text style={[styles.activityAmount, { color: activityColor(act.type) }]}>
                      {act.type === "withdrawal" ? "−" : "+"}{formatRM(act.amount)}
                    </Text>
                  </View>
                </View>
              ))
            )}
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

/* ─── Manual save modal styles ───────────────────────────────────── */

const sv = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  sheet:      { width: "100%", backgroundColor: "#0C0920", borderRadius: 20, borderWidth: 1, borderColor: "rgba(167,139,250,0.2)", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28 },
  handle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "center", marginBottom: 20, display: "none" },
  form:       { gap: 18 },
  title:      { color: "#FFFFFF", fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 4 },
  balance:    { color: colors.textMuted, fontSize: typography.body, textAlign: "center", marginTop: -12 },
  label:      { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: -6 },
  destRow:    { flexDirection: "row", gap: 10, alignItems: "stretch" },
  destChip:   { flex: 1, minHeight: 48, paddingHorizontal: 6, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  destChipActive: { borderColor: "#7C3AED", backgroundColor: "rgba(124,58,237,0.12)" },
  destChipText:   { color: colors.textSecondary, fontSize: 12, fontWeight: "700", textAlign: "center" },
  // Amount input: large, easy to tap, no squeezing
  amountWrap:   { flexDirection: "row", alignItems: "center", borderRadius: 14, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1.5, borderColor: "rgba(167,139,250,0.3)", paddingHorizontal: 16, height: 64 },
  amountPrefix: { color: "#A78BFA", fontSize: 22, fontWeight: "800", paddingRight: 6 },
  amountInput:  { flex: 1, color: "#FFFFFF", fontSize: 28, fontWeight: "800", letterSpacing: -0.5, paddingVertical: 0 },
  errorText:    { color: "#EF4444", fontSize: typography.caption, marginTop: -8 },
  btnRow:       { flexDirection: "row", gap: 10 },
  cancelBtn:    { flex: 1, paddingVertical: 15, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  cancelBtnText:{ color: colors.textMuted, fontSize: typography.body, fontWeight: "600" },
  primaryBtn:   { flex: 1, paddingVertical: 15, borderRadius: 12, backgroundColor: "#7C3AED", alignItems: "center" },
  primaryBtnText:{ color: "#FFFFFF", fontSize: typography.body, fontWeight: "700" },
  btnDisabled:  { backgroundColor: "rgba(124,58,237,0.35)" },
  successDoneBtn: { alignSelf: "stretch", width: "100%", flex: 0, minHeight: 48 },
  successWrap:  { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl, width: "100%" },
  successTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  successMsg:   { color: colors.textSecondary, fontSize: typography.body, textAlign: "center", lineHeight: 22 },
  // Main screen Manual Save button
  manualSaveBtn:    { backgroundColor: "#7C3AED", borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  manualSaveBtnText:{ color: "#FFFFFF", fontSize: typography.body, fontWeight: "700" },
});

/* ─── Helper ──────────────────────────────────────────────────────── */

function activityColor(type: SavingsActivity["type"]): string {
  switch (type) {
    case "auto":       return "#A78BFA";
    case "manual":     return "#38BDF8";
    case "roundup":    return "#22C55E";
    case "goal":       return "#F59E0B";
    case "withdrawal": return "#FB923C";
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
  dailyInterestHeroPill: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.45)",
    backgroundColor: "rgba(56,189,248,0.12)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: "flex-start",
  },
  dailyInterestHeroLabel: { color: "#BAE6FD", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  dailyInterestHeroAmount: { color: "#22D3EE", fontSize: typography.body, fontWeight: "800", marginTop: 2 },
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
  allocCurrentRuleLine: {
    color: "#E9D5FF",
    fontSize: typography.caption,
    fontWeight: "800",
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  allocLinkBtn: {
    marginTop: spacing.sm,
    alignSelf: "flex-end",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.35)",
    backgroundColor: "rgba(167,139,250,0.12)",
  },
  allocLinkText: { color: "#A78BFA", fontSize: 11, fontWeight: "800" },

  /* Alloc grid — compact RM amounts */
  allocGrid:     { flexDirection: "row", justifyContent: "space-between" },
  allocCell:     { alignItems: "center", flex: 1 },
  allocAmountSm: { fontSize: 12, fontWeight: "700", letterSpacing: -0.2 },
  allocCellLabel:{ color: colors.textMuted, fontSize: 10, marginTop: 2 },
  savedFromIncomeRow: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
    backgroundColor: "rgba(34,197,94,0.12)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  savedFromIncomeLabel: { color: "#BBF7D0", fontSize: typography.caption, fontWeight: "700" },
  savedFromIncomeValue: { color: "#22C55E", fontSize: typography.body, fontWeight: "900" },

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
  withdrawShortcutBtn: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)",
    backgroundColor: "rgba(245,158,11,0.14)",
  },
  withdrawShortcutText: { color: "#FCD34D", fontWeight: "800", fontSize: typography.body },
  interestGrid: { gap: spacing.sm },
  interestItem: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.3)",
    backgroundColor: "rgba(17,14,31,0.75)",
    padding: spacing.md,
    gap: 2,
  },
  interestBucket: { color: "#EDE9FE", fontSize: typography.body, fontWeight: "800" },
  interestBal: { color: "#FFFFFF", fontSize: typography.subheading, fontWeight: "900" },
  interestMeta: { color: "#B6A8D9", fontSize: typography.caption, fontWeight: "600" },
  pendingBoostPill: {
    marginTop: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)",
    backgroundColor: "rgba(245,158,11,0.14)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  pendingBoostText: { color: "#FCD34D", fontSize: 11, fontWeight: "800" },
  boostHint: { color: "#D8C8A2", fontSize: 11, marginTop: 2 },
  rewardProgressBox: {
    marginTop: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
    backgroundColor: "rgba(245,158,11,0.10)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 3,
  },
  rewardProgressTitle: { color: "#FCD34D", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 },
  rewardProgressLineStrong: { color: "#FFF7E5", fontSize: 12, fontWeight: "800" },
  rewardProgressLine: { color: "#E8D7B0", fontSize: 11, fontWeight: "600" },
  rewardProgressStatus: { color: "#FBBF24", fontSize: 11, fontWeight: "800", marginTop: 2 },

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
  destSelectorRow:    { flexDirection: "row", gap: 8, marginBottom: spacing.sm },
  destSelectorChip:   { flex: 1, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingVertical: 7, alignItems: "center" },
  destSelectorChipActive: { borderColor: "#7C3AED", backgroundColor: "rgba(124,58,237,0.12)" },
  destSelectorText:   { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  roundupExampleText: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 18 },

  /* Activity */
  activityRow:    { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  activityDot:    { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  activityBody:   { flex: 1, gap: 2 },
  activityLabel:  { color: colors.textPrimary, fontSize: typography.body, fontWeight: "600" },
  activityPocket: { color: colors.textMuted, fontSize: typography.caption },
  activityAmount: { fontSize: typography.body, fontWeight: "800" },
  activityEmpty:  { color: colors.textMuted, fontSize: typography.caption, textAlign: "center", paddingVertical: spacing.sm },

  /* Taskbar */
  tabBar:          { flexDirection: "row", backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, paddingHorizontal: spacing.sm, alignItems: "flex-end" },
  tabItem:         { flex: 1, alignItems: "center", paddingBottom: spacing.sm, gap: 3 },
  tabLabel:        { color: colors.textMuted, fontSize: 10, fontWeight: "600" },
  tabLabelActive:  { color: "#A78BFA" },
  tabLabelPrimary: { color: "#A78BFA", fontSize: 10, fontWeight: "700" },
  tabPrimaryWrap:  { flex: 1, alignItems: "center", marginTop: -20, paddingBottom: spacing.xs, gap: 3 },
  tabScanBtn:      { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.taskbarScan, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.background },
  tabSafeArea:     { backgroundColor: colors.surface, height: 16 },
});
