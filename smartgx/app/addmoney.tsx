/**
 * Add Money — banking-style fund-in flow.
 * Steps: enter amount → select source → confirm → success receipt
 */
import { useEffect, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useAccountStore } from "../src/store/accountStore";
import { useTransactionStore } from "../src/store/transactionStore";
import { useNotificationStore } from "../src/store/notificationStore";
import { useAuthStore } from "../src/store/authStore";
import { useActivityStore } from "../src/store/activityStore";
import { useSavingsStore } from "../src/store/savingsStore";
import { useGamificationStore } from "../src/store/gamificationStore";
import { formatRM } from "../src/lib/currency";
import { colors } from "../src/theme/colors";
import { radius } from "../src/theme/radius";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";
import type { Transaction } from "../src/types/transaction";
import { verifyUserPin } from "../src/features/security/sensitiveAction";
import { sensitiveActionBlockedMessage, userHasPinSet } from "../src/store/securityStore";

/* ─── Funding sources ─────────────────────────────────────────────── */

interface FundingSource {
  id:       string;
  name:     string;
  detail:   string;
  type:     string;
  badge:    string;
  badgeColor: string;
  mode?: "deposit" | "saving_withdrawal";
}

const FUNDING_SOURCES: FundingSource[] = [
  { id: "withdraw-saving", name: "Withdraw from Saving", detail: "Move from Bonus / Emergency / Goals", type: "saving", badge: "Internal", badgeColor: "#F59E0B", mode: "saving_withdrawal" },
  { id: "maybank",  name: "Maybank Savings",    detail: "Account •••• 1234", type: "bank",    badge: "Linked",  badgeColor: "#22C55E" },
  { id: "cimb",     name: "CIMB Clicks",        detail: "Account •••• 5678", type: "bank",    badge: "Linked",  badgeColor: "#22C55E" },
  { id: "publicbk", name: "Public Bank",        detail: "DuitNow Transfer",      type: "duitnow", badge: "DuitNow", badgeColor: "#38BDF8" },
  { id: "rhb",      name: "RHB Banking",        detail: "DuitNow Transfer",      type: "duitnow", badge: "DuitNow", badgeColor: "#38BDF8" },
  { id: "hongleong",name: "Hong Leong Bank",    detail: "Account •••• 7721",     type: "bank",    badge: "Linked",  badgeColor: "#22C55E" },
  { id: "ambank",   name: "AmBank",             detail: "Account •••• 9018",     type: "bank",    badge: "Linked",  badgeColor: "#22C55E" },
  { id: "bankislam",name: "Bank Islam",         detail: "DuitNow Transfer",      type: "duitnow", badge: "DuitNow", badgeColor: "#38BDF8" },
  { id: "bsn",      name: "BSN",                detail: "DuitNow Transfer",      type: "duitnow", badge: "DuitNow", badgeColor: "#38BDF8" },
  { id: "alliance", name: "Alliance Bank",      detail: "Account •••• 3382",     type: "bank",    badge: "Linked",  badgeColor: "#22C55E" },
  { id: "tng",      name: "Touch 'n Go eWallet",detail: "Wallet top-up transfer",type: "wallet",  badge: "Linked",  badgeColor: "#22C55E" },
  { id: "duitnow",  name: "DuitNow Transfer",   detail: "From any participating bank", type: "duitnow", badge: "DuitNow", badgeColor: "#38BDF8" },
];

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

type Step = "amount" | "source" | "withdraw" | "confirm" | "success";
type SavingBucket = "bonus" | "emergency" | "goals";

/* ─── Icons ───────────────────────────────────────────────────────── */
function ChevronLeft() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ChevronRight() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18L15 12L9 6" stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function AddMoneyScreen() {
  const params = useLocalSearchParams<{ mode?: string; amount?: string }>();
  const accountStore    = useAccountStore();
  const { addTransaction } = useTransactionStore();
  const { addNotification } = useNotificationStore();
  const { addActivity } = useActivityStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const profileFullName = currentUser?.fullName?.trim() || "SmartGX User";
  const savingsStore = useSavingsStore();
  const currentStreak = useGamificationStore((s) => s.currentStreak);
  const streakMilestonesClaimed = useGamificationStore((s) => s.streakMilestonesClaimed);

  const [step, setStep]             = useState<Step>("amount");
  const [source, setSource]         = useState<FundingSource | null>(null);
  const [amountText, setAmountText] = useState("");
  const [reference]                 = useState("Top up to SmartGX");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [withdrawBucket, setWithdrawBucket] = useState<SavingBucket>("bonus");
  const [warningAccepted, setWarningAccepted] = useState(false);
  const [amountError, setAmountError] = useState("");
  const [txId, setTxId] = useState("");
  const [didResetBonusBoost, setDidResetBonusBoost] = useState(false);
  const [withdrawPinOpen, setWithdrawPinOpen] = useState(false);
  const [withdrawPin, setWithdrawPin] = useState("");
  const [withdrawPinError, setWithdrawPinError] = useState("");
  const [withdrawFlowPrefilled, setWithdrawFlowPrefilled] = useState(false);

  const SGX_ACCOUNT_NO = "1234 5678 9012";

  const handleCopyAccount = async () => {
    await Clipboard.setStringAsync(SGX_ACCOUNT_NO);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2500);
  };

  const parsedAmount = parseFloat(amountText.replace(/[^0-9.]/g, "")) || 0;
  const isSavingWithdraw = source?.mode === "saving_withdrawal";
  const bucketBalance = savingsStore.savingsBuckets[withdrawBucket];
  const totalSavingsBalance =
    savingsStore.savingsBuckets.bonus +
    savingsStore.savingsBuckets.emergency +
    savingsStore.savingsBuckets.goals;
  const streakMilestones = [
    { id: "streak-3", name: "3-Day Saving Streak Reward", reward: 1, target: 3 },
    { id: "streak-7", name: "7-Day Saving Streak Reward", reward: 3, target: 7 },
    { id: "streak-14", name: "14-Day Saving Streak Reward", reward: 8, target: 14 },
    { id: "streak-30", name: "30-Day Saving Streak Reward", reward: 20, target: 30 },
  ];
  const activeBonusReward = streakMilestones.find((m) => !streakMilestonesClaimed.includes(m.id));
  const activeBonusProgress = activeBonusReward ? Math.min(currentStreak, activeBonusReward.target) : 0;

  useEffect(() => {
    if (withdrawFlowPrefilled || params.mode !== "withdraw") return;
    const withdrawSource = FUNDING_SOURCES.find((s) => s.id === "withdraw-saving");
    if (!withdrawSource) return;
    setSource(withdrawSource);
    if (typeof params.amount === "string" && params.amount.trim().length > 0) {
      setAmountText(params.amount);
    }
    setWithdrawFlowPrefilled(true);
  }, [params.amount, params.mode, withdrawFlowPrefilled]);

  const handleSelectSource = (src: FundingSource) => {
    if (parsedAmount <= 0) {
      setAmountError("Enter a valid amount first.");
      setStep("amount");
      return;
    }
    if (src.mode !== "saving_withdrawal" && parsedAmount < 10) {
      setAmountError("Minimum RM10 for bank / external add money.");
      setStep("amount");
      return;
    }
    setSource(src);
    setWarningAccepted(false);
    if (src.mode === "saving_withdrawal") {
      setStep("withdraw");
      return;
    }
    setStep("confirm");
  };

  const handleProceedToConfirm = () => {
    if (parsedAmount <= 0) {
      setAmountError("Enter a valid amount.");
      return;
    }
    if (!source) {
      setAmountError("");
      setStep("source");
      return;
    }
    // From amount/source: go to dedicated withdraw step. When already on withdraw, continue to confirm.
    if (source.mode === "saving_withdrawal" && step !== "withdraw") {
      if (parsedAmount > totalSavingsBalance) {
        setAmountError(
          `Amount cannot exceed total savings (${formatRM(totalSavingsBalance)}).`
        );
        return;
      }
      setAmountError("");
      setStep("withdraw");
      return;
    }
    if (!isSavingWithdraw && parsedAmount < 10) {
      setAmountError("Minimum RM10 for bank / external add money.");
      return;
    }
    if (isSavingWithdraw) {
      if (parsedAmount > totalSavingsBalance) {
        setAmountError(
          `Amount cannot exceed total savings (${formatRM(totalSavingsBalance)}).`
        );
        return;
      }
      if (parsedAmount > bucketBalance) {
        setAmountError(
          `Amount exceeds ${bucketLabel(withdrawBucket)} balance (${formatRM(bucketBalance)}).`
        );
        return;
      }
    }
    setAmountError("");
    setStep("confirm");
  };

  const handleConfirm = () => {
    if (isSavingWithdraw) {
      setWithdrawPin("");
      setWithdrawPinError("");
      setWithdrawPinOpen(true);
      return;
    }
    runAddMoneyTransaction();
  };

  const handleWithdrawPinSubmit = async () => {
    const block = sensitiveActionBlockedMessage();
    if (block) {
      setWithdrawPinError(block);
      setWithdrawPin("");
      return;
    }
    const v = await verifyUserPin(withdrawPin);
    if (!v.ok) {
      setWithdrawPinError(v.message ?? "Incorrect PIN.");
      setWithdrawPin("");
      return;
    }
    setWithdrawPinOpen(false);
    setWithdrawPin("");
    setWithdrawPinError("");
    runAddMoneyTransaction();
  };

  const runAddMoneyTransaction = () => {
    const isoNow = new Date().toISOString();
    const dateOnly = isoNow.slice(0, 10);
    const timeLabel = new Date().toTimeString().slice(0, 5);
    const newTxId = `TX-${Date.now()}`;
    setTxId(newTxId);
    let bonusResetThisWithdrawal = false;
    if (isSavingWithdraw) {
      const result = savingsStore.withdrawFromBucket(withdrawBucket, parsedAmount);
      if (!result.ok) {
        setAmountError(result.reason === "insufficient_balance" ? "Insufficient bucket balance." : "Invalid amount.");
        setStep("amount");
        return;
      }
      accountStore.creditBalance(parsedAmount);
      setDidResetBonusBoost(result.didResetBonusBoost);
      bonusResetThisWithdrawal = result.didResetBonusBoost;
    } else {
      accountStore.creditBalance(parsedAmount);
      setDidResetBonusBoost(false);
    }

    const txn: Transaction = {
      id:              isSavingWithdraw ? `t-saving-withdraw-${Date.now()}` : `t-addmoney-${Date.now()}`,
      userId:          currentUser?.id ?? "",
      merchant:        isSavingWithdraw ? `Saving Withdrawal (${bucketLabel(withdrawBucket)})` : source?.name ?? "Bank Transfer",
      category:        "others",
      amount:          parsedAmount,
      type:            isSavingWithdraw ? "saving_withdrawal" : "income",
      paymentMethod:   "online_transfer",
      transactionDate: dateOnly,
      riskLevel:       "low",
      isSuspicious:    false,
      note:            isSavingWithdraw ? `${bucketLabel(withdrawBucket)} to Main Account` : reference,
      sourceAction:    isSavingWithdraw ? "saving_withdrawal" : "add_money",
      occurredAt:      isoNow,
    };
    addTransaction(txn);

    if (isSavingWithdraw) {
      addNotification({
        id: `notif-saving-withdraw-${Date.now()}`,
        title:
          withdrawBucket === "bonus"
            ? "Bonus Withdrawal Completed"
            : withdrawBucket === "emergency"
              ? "Emergency Saving Reduced"
              : "Goal Saving Reduced",
        message:
          withdrawBucket === "bonus"
            ? `${formatRM(parsedAmount)} was moved from Bonus to Main Account.${bonusResetThisWithdrawal ? " Pending bonus reward progress was reset." : ""}`
            : withdrawBucket === "emergency"
              ? `${formatRM(parsedAmount)} was moved from Emergency to Main Account. Your emergency buffer is now lower.`
              : `${formatRM(parsedAmount)} was moved from Goals to Main Account. Your goal progress decreased.`,
        time: `${dateOnly} · ${timeLabel}`,
        read: false,
        type: "alert",
      });
    } else {
      addNotification({
        id:      `notif-addmoney-${Date.now()}`,
        title:   "Money added successfully",
        message: `${formatRM(parsedAmount)} from ${source?.name} has been credited to your SmartGX account.`,
        time:    `${dateOnly} · ${timeLabel}`,
        read:    false,
        type:    "info",
      });
    }
    addActivity({
      id: isSavingWithdraw ? `act-saving-withdraw-${Date.now()}` : `act-add-money-${Date.now()}`,
      type: isSavingWithdraw ? "saving_withdrawal" : "add_money",
      title: isSavingWithdraw ? `Withdrew ${formatRM(parsedAmount)} from ${bucketLabel(withdrawBucket)}` : "Add Money",
      description: isSavingWithdraw ? `${bucketLabel(withdrawBucket)} to Main Account` : source?.name ?? "Bank Transfer",
      amount: parsedAmount,
      direction: "credit",
      timestamp: isoNow,
      route: isSavingWithdraw ? "/savings" : "/dashboard",
    });
    if (isSavingWithdraw && bonusResetThisWithdrawal) {
      addActivity({
        id: `act-bonus-boost-reset-${Date.now()}`,
        type: "saving_withdrawal",
        title: "Bonus Reward Progress reset",
        description: "Unclaimed Bonus Reward Progress reset after withdrawal",
        timestamp: new Date(Date.now() + 1).toISOString(),
        route: "/savings",
      });
    }

    setStep("success");
  };

  const handleDone = () => router.push("/dashboard" as never);
  const handleAddMore = () => {
    setStep("amount");
    setAmountText("");
    setSource(null);
    setAmountError("");
    setWarningAccepted(false);
  };

  const stepLabels: Record<Step, string> = {
    amount: "Enter Amount",
    source: "Select Source",
    withdraw: "Withdraw Setup",
    confirm: "Confirm",
    success: "Success",
  };
  const stepOrder: Step[] = ["amount", "source", "withdraw", "confirm", "success"];
  const stepIndex = stepOrder.indexOf(step);

  if (!currentUser) return <Redirect href="/auth/login" />;
  if (!userHasPinSet()) return <Redirect href="/auth/app-pin-setup" />;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#3B1578" />

      <Modal visible={withdrawPinOpen} transparent animationType="fade" onRequestClose={() => { setWithdrawPinOpen(false); setWithdrawPin(""); setWithdrawPinError(""); }}>
        <View style={styles.pinOverlay}>
          <View style={styles.pinCard}>
            <Text style={styles.pinTitle}>Confirm with PIN</Text>
            <Text style={styles.pinSub}>Enter your 6-digit SmartGX PIN to withdraw from Saving.</Text>
            <TextInput
              style={styles.pinInput}
              value={withdrawPin}
              onChangeText={(t) => { setWithdrawPin(t.replace(/\D/g, "").slice(0, 6)); setWithdrawPinError(""); }}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              placeholder="••••••"
              placeholderTextColor={colors.textMuted}
            />
            {withdrawPinError ? <Text style={styles.pinErr}>{withdrawPinError}</Text> : null}
            <View style={styles.pinBtns}>
              <Pressable style={styles.pinGhost} onPress={() => { setWithdrawPinOpen(false); setWithdrawPin(""); setWithdrawPinError(""); }}>
                <Text style={styles.pinGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.pinPrimary, withdrawPin.length < 6 && { opacity: 0.45 }]}
                onPress={handleWithdrawPinSubmit}
                disabled={withdrawPin.length < 6}
              >
                <Text style={styles.pinPrimaryText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Gradient hero — matches Saving & Automation style */}
      {step !== "success" && (
        <LinearGradient
          colors={["#3B1578", "#2D0D6B", "#1A0845", "#070B14"]}
          locations={[0, 0.4, 0.75, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.hero}
        >
          <Pressable
            style={styles.backBtn}
            onPress={() => {
              if (step === "amount") { router.push("/dashboard" as never); return; }
              if (step === "withdraw" && params.mode === "withdraw") { setStep("amount"); return; }
              const prev = stepOrder[stepIndex - 1];
              if (prev) setStep(prev);
              else router.push("/dashboard" as never);
            }}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18L9 12L15 6" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text style={styles.heroTitle}>Add Money</Text>
          {/* Step dots inside hero */}
          <View style={styles.stepDotRow}>
            {(["amount", "source", "withdraw", "confirm"] as Step[]).map((s, i) => (
              <View key={s} style={styles.stepDotItem}>
                <View style={[styles.stepDot, stepIndex >= i && styles.stepDotActive]} />
                <Text style={[styles.stepLabelText, stepIndex >= i && { color: "#C4B5FD" }]}>
                  {stepLabels[s]}
                </Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {step === "source" && (
          <>
            <Text style={styles.sectionTitle}>Choose your source</Text>
            <View style={styles.card}>
              {FUNDING_SOURCES.map((src, i) => (
                <Pressable
                  key={src.id}
                  style={[
                    styles.sourceRow,
                    source?.id === src.id && styles.sourceRowSelected,
                    i < FUNDING_SOURCES.length - 1 && styles.sourceRowBorder,
                  ]}
                  onPress={() => handleSelectSource(src)}
                >
                  <View style={styles.sourceIconWrap}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path d="M2 10H22M2 8C2 6.9 2.9 6 4 6H20C21.1 6 22 6.9 22 8V16C22 17.1 21.1 18 20 18H4C2.9 18 2 17.1 2 16V8Z" stroke="#A78BFA" strokeWidth="1.8" strokeLinecap="round" />
                    </Svg>
                  </View>
                  <View style={styles.sourceBody}>
                    <Text style={styles.sourceName}>{src.name}</Text>
                    <Text style={styles.sourceDetail}>{src.detail}</Text>
                  </View>
                  <View style={[styles.sourceBadge, { borderColor: src.badgeColor + "55", backgroundColor: src.badgeColor + "18" }]}>
                    <Text style={[styles.sourceBadgeText, { color: src.badgeColor }]}>{src.badge}</Text>
                  </View>
                  <ChevronRight />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {step === "withdraw" && isSavingWithdraw && (
          <>
            <Text style={styles.sectionTitle}>Withdraw from Saving</Text>
            <View style={styles.amountInputCard}>
              <Text style={styles.amountCurrencyLabel}>Select saving bucket</Text>
              <View style={styles.bucketRow}>
                {(["bonus", "emergency", "goals"] as SavingBucket[]).map((b) => (
                  <Pressable key={b} style={[styles.bucketChip, withdrawBucket === b && styles.bucketChipActive]} onPress={() => setWithdrawBucket(b)}>
                    <Text style={[styles.bucketChipText, withdrawBucket === b && styles.bucketChipTextActive]}>{bucketLabel(b)}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.amountWords}>Available in {bucketLabel(withdrawBucket)}: {formatRM(bucketBalance)}</Text>
              <Text style={styles.amountWords}>
                {withdrawBucket === "bonus"
                  ? "Bonus withdrawal may reset current reward progress."
                  : withdrawBucket === "emergency"
                    ? "Emergency withdrawal lowers your emergency buffer."
                    : "Goals withdrawal lowers your goal progress."}
              </Text>
              <Pressable style={[styles.warnToggle, warningAccepted && styles.warnToggleOn]} onPress={() => { setWarningAccepted((v) => !v); setAmountError(""); }}>
                <Text style={styles.warnToggleText}>{warningAccepted ? "Warning acknowledged" : "Acknowledge warning"}</Text>
              </Pressable>
              {amountError ? <Text style={styles.errorText}>{amountError}</Text> : null}
              <Pressable
                style={[styles.primaryBtn, !warningAccepted && styles.primaryBtnDisabled]}
                onPress={() => {
                  if (!warningAccepted) {
                    setAmountError("Please acknowledge the warning first.");
                    return;
                  }
                  setAmountError("");
                  handleProceedToConfirm();
                }}
              >
                <Text style={styles.primaryBtnText}>Continue to Review</Text>
              </Pressable>
            </View>
          </>
        )}

        {step === "amount" && (
          <>
            <Text style={styles.sectionTitle}>How much would you like to add?</Text>
            <View style={styles.amountInputCard}>
              <Text style={styles.amountCurrencyLabel}>Amount (RM)</Text>
              <View style={styles.amountRow}>
                <Text style={styles.amountSymbol}>RM</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amountText}
                  onChangeText={setAmountText}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
              </View>
              {parsedAmount > 0 && (
                <Text style={styles.amountWords}>
                  {isSavingWithdraw
                    ? `${formatRM(parsedAmount)} to withdraw to Main Account (max total savings ${formatRM(totalSavingsBalance)})`
                    : `${formatRM(parsedAmount)} ready to be added into SmartGX Main Account`}
                </Text>
              )}
              {step === "amount" && isSavingWithdraw ? (
                <Text style={styles.amountWords}>
                  Total savings (Bonus + Emergency + Goals): {formatRM(totalSavingsBalance)}. Amount cannot exceed this.
                </Text>
              ) : null}
              {amountError ? <Text style={styles.errorText}>{amountError}</Text> : null}
            </View>

            {/* Quick amounts */}
            <Text style={styles.quickLabel}>Quick amounts</Text>
            <View style={styles.quickRow}>
              {QUICK_AMOUNTS.map((amt) => (
                <Pressable
                  key={amt}
                  style={[styles.quickChip, parsedAmount === amt && styles.quickChipActive]}
                  onPress={() => setAmountText(String(amt))}
                >
                  <Text style={[styles.quickChipText, parsedAmount === amt && { color: "#A78BFA" }]}>
                    RM{amt}
                  </Text>
                </Pressable>
              ))}
            </View>

          </>
        )}

        {step === "confirm" && source && (
          <>
            <Text style={styles.sectionTitle}>Please review before confirming</Text>
            <View style={styles.card}>
              {isSavingWithdraw ? (
                <>
                  <View style={styles.warnCard}>
                    <Text style={styles.warnTitle}>Warning</Text>
                    <Text style={styles.warnText}>
                      {withdrawBucket === "bonus"
                        ? activeBonusReward
                          ? `Withdrawing from Bonus may reset your ${activeBonusReward.name} progress.`
                          : "Withdrawing from Bonus may reset your active Bonus Reward Progress."
                        : withdrawBucket === "emergency"
                          ? "This will reduce your emergency buffer and may affect your GXHealth."
                          : "This will reduce your goal progress."}
                    </Text>
                    {withdrawBucket === "bonus" && activeBonusReward ? (
                      <View style={styles.warnDetailBox}>
                        <Text style={styles.warnDetailLine}>Current progress: {activeBonusProgress} / {activeBonusReward.target} saving days</Text>
                        <Text style={styles.warnDetailLine}>Reward at risk: RM{activeBonusReward.reward.toFixed(2)} Bonus Reward</Text>
                        <Text style={styles.warnDetailLine}>Already claimed rewards will not be removed.</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.confirmDivider} />
                </>
              ) : null}
              <View style={styles.confirmRow}>
                <Text style={styles.confirmKey}>Add money from</Text>
                <Text style={styles.confirmVal}>{isSavingWithdraw ? bucketLabel(withdrawBucket) : source.name}</Text>
              </View>
              <View style={styles.confirmDivider} />
              <View style={styles.confirmRow}>
                <Text style={styles.confirmKey}>Account</Text>
                <Text style={styles.confirmVal}>{isSavingWithdraw ? "Saving Bucket" : source.detail}</Text>
              </View>
              <View style={styles.confirmDivider} />
              <View style={styles.confirmRow}>
                <Text style={styles.confirmKey}>{isSavingWithdraw ? "Destination" : "Adding to"}</Text>
                <Text style={styles.confirmVal}>{isSavingWithdraw ? "Main Account" : "SmartGX Spending Wallet"}</Text>
              </View>
              <View style={styles.confirmDivider} />
              <View style={styles.confirmRow}>
                <Text style={styles.confirmKey}>Reference</Text>
                <Text style={styles.confirmVal}>{isSavingWithdraw ? "Withdraw from Saving" : reference}</Text>
              </View>
              <View style={styles.confirmDivider} />
              <View style={styles.confirmRow}>
                <Text style={styles.confirmKey}>Current balance</Text>
                <Text style={styles.confirmVal}>{formatRM(accountStore.mainBalance)}</Text>
              </View>
              <View style={styles.confirmDivider} />
              <View style={styles.confirmRow}>
                <Text style={styles.confirmKey}>Amount</Text>
                <Text style={[styles.confirmVal, { color: "#22C55E", fontSize: 18, fontWeight: "800" }]}>
                  +{formatRM(parsedAmount)}
                </Text>
              </View>
              <View style={styles.confirmDivider} />
              <View style={styles.confirmRow}>
                <Text style={styles.confirmKey}>New balance</Text>
                <Text style={[styles.confirmVal, { color: "#22C55E" }]}>
                  {formatRM(accountStore.mainBalance + parsedAmount)}
                </Text>
              </View>
            </View>

            <Pressable style={styles.primaryBtn} onPress={handleConfirm}>
              <Text style={styles.primaryBtnText}>{isSavingWithdraw ? "Withdraw Anyway" : "Confirm Add Money"}</Text>
            </Pressable>
          </>
        )}

        {step === "success" && (
          <View style={styles.successWrap}>
            <View style={styles.successIconWrap}>
              <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="10" fill="rgba(34,197,94,0.15)" stroke="#22C55E" strokeWidth="1.5" />
                <Path d="M8 12L11 15L16 9" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.successTitle}>Money Added!</Text>
            <Text style={styles.successAmount}>+{formatRM(parsedAmount)}</Text>
            <Text style={styles.successSub}>{isSavingWithdraw ? "Successfully moved to Main Account" : "Successfully added to SmartGX"}</Text>

            <View style={styles.receiptCard}>
              <Text style={styles.receiptHeader}>Receipt</Text>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>From</Text>
                <Text style={styles.receiptVal}>{isSavingWithdraw ? bucketLabel(withdrawBucket) : source?.name}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>To</Text>
                <Text style={styles.receiptVal}>{isSavingWithdraw ? "Main Account" : "SmartGX Wallet"}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Amount</Text>
                <Text style={[styles.receiptVal, { color: "#22C55E" }]}>+{formatRM(parsedAmount)}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>New Balance</Text>
                <Text style={styles.receiptVal}>{formatRM(accountStore.mainBalance)}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Date</Text>
                <Text style={styles.receiptVal}>{new Date().toISOString().slice(0, 10)}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Status</Text>
                <Text style={styles.receiptVal}>Successful</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Transaction ID</Text>
                <Text style={styles.receiptVal}>{txId}</Text>
              </View>
              {isSavingWithdraw && didResetBonusBoost ? (
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptKey}>Note</Text>
                  <Text style={styles.receiptVal}>Bonus Reward Progress reset.</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.successBtnRow}>
              <Pressable style={styles.secondaryBtn} onPress={() => router.push("/transactions" as never)}>
                <Text style={styles.secondaryBtnText}>View Transaction</Text>
              </Pressable>
              <Pressable style={styles.doneBtnFull} onPress={handleDone}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        )}
        {step !== "success" && (
          <View style={styles.accountCard}>
            <View style={styles.accountHeader}>
              <Image
                source={require("../assets/duitnow.png")}
                style={styles.duitnowLogo}
                resizeMode="contain"
              />
              <Text style={styles.accountHeaderTitle}>Your SmartGX Account</Text>
            </View>
            <Text style={styles.accountLabel}>SmartGX Account No.</Text>
            <View style={styles.accountNoRow}>
              <Text style={styles.accountNo}>{SGX_ACCOUNT_NO}</Text>
              <Pressable style={styles.copyBtn} onPress={handleCopyAccount}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M8 4H6C4.9 4 4 4.9 4 6V18C4 19.1 4.9 20 6 20H16C17.1 20 18 19.1 18 18V16" stroke={copyFeedback ? "#22C55E" : "#A78BFA"} strokeWidth="1.8" strokeLinecap="round" />
                  <Rect x="8" y="2" width="12" height="14" rx="2" stroke={copyFeedback ? "#22C55E" : "#A78BFA"} strokeWidth="1.8" />
                </Svg>
                <Text style={[styles.copyBtnText, copyFeedback && { color: "#22C55E" }]}>
                  {copyFeedback ? "Copied!" : "Copy"}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.accountHolder}>{profileFullName} · SmartGX</Text>
            <Text style={styles.accountHint}>
              DuitNow supported. Share this account number to receive money into SmartGX.
            </Text>
          </View>
        )}

      </ScrollView>

      {/* Sticky CTA — always visible above keyboard on amount step */}
      {step === "amount" && (
        <View style={styles.stickyFooter}>
          <Pressable
            style={[styles.primaryBtn, parsedAmount <= 0 && styles.primaryBtnDisabled]}
            onPress={handleProceedToConfirm}
          >
            <Text style={styles.primaryBtnText}>Continue to Source →</Text>
          </Pressable>
        </View>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 16 },
  stickyFooter:  { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8, backgroundColor: colors.background },

  /* Gradient hero */
  hero:         { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xs },
  backBtn:      { padding: spacing.xs, alignSelf: "flex-start", marginBottom: spacing.xs },
  heroTitle:    { color: "#FFFFFF", fontSize: typography.title, fontWeight: "800", letterSpacing: -0.3 },

  /* Step dots inside hero */
  stepDotRow:   { flexDirection: "row", gap: 24, marginTop: 8 },
  stepDotItem:  { alignItems: "center", gap: 4 },
  stepDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)" },
  stepDotActive:{ backgroundColor: "#C4B5FD" },
  stepLabelText:{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "600" },

  sectionTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },

  /* Source card */
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: "hidden" },
  sourceRow:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  sourceRowSelected: { backgroundColor: "rgba(124,58,237,0.16)" },
  sourceRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  sourceIconWrap:  { width: 38, height: 38, borderRadius: 10, backgroundColor: "rgba(167,139,250,0.1)", borderWidth: 1, borderColor: "rgba(167,139,250,0.2)", alignItems: "center", justifyContent: "center" },
  sourceBody:      { flex: 1 },
  sourceName:      { color: "#FFFFFF", fontSize: typography.body, fontWeight: "700" },
  sourceDetail:    { color: colors.textMuted, fontSize: typography.caption },
  sourceBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
  sourceBadgeText: { fontSize: 10, fontWeight: "700" },

  /* SmartGX Account card */
  accountCard:        { backgroundColor: "rgba(124,58,237,0.1)", borderRadius: radius.lg, borderWidth: 1.5, borderColor: "rgba(167,139,250,0.3)", padding: spacing.lg, gap: 8 },
  accountHeader:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
  accountHeaderTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  duitnowLogo:        { width: 36, height: 36, borderRadius: 8 },
  accountLabel:       { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  accountNoRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  accountNo:          { color: "#FFFFFF", fontSize: 22, fontWeight: "800", letterSpacing: 1.5 },
  copyBtn:            { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: "rgba(167,139,250,0.12)", borderWidth: 1, borderColor: "rgba(167,139,250,0.25)" },
  copyBtnText:        { color: "#A78BFA", fontSize: 12, fontWeight: "700" },
  accountHolder:      { color: "#A78BFA", fontSize: typography.caption, fontWeight: "600" },
  accountHint:        { color: colors.textMuted, fontSize: 12, lineHeight: 18 },

  /* Source preview chip */
  sourcePreview:       { backgroundColor: "rgba(124,58,237,0.1)", borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(167,139,250,0.2)", padding: 14, gap: 2 },
  sourcePreviewLabel:  { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  sourcePreviewName:   { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  sourcePreviewDetail: { color: colors.textMuted, fontSize: typography.caption },

  /* Amount input */
  amountInputCard:    { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: "rgba(167,139,250,0.25)", borderRadius: 16, padding: 16, gap: 6 },
  amountCurrencyLabel:{ color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  bucketRow:          { flexDirection: "row", gap: 8, marginBottom: 4 },
  bucketChip:         { flex: 1, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated, paddingVertical: 8, alignItems: "center" },
  bucketChipActive:   { borderColor: "#7C3AED", backgroundColor: "rgba(124,58,237,0.14)" },
  bucketChipText:     { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  bucketChipTextActive: { color: "#A78BFA" },
  amountRow:          { flexDirection: "row", alignItems: "center", gap: 8 },
  amountSymbol:       { color: "#A78BFA", fontSize: 26, fontWeight: "800" },
  amountInput:        { flex: 1, color: "#FFFFFF", fontSize: 36, fontWeight: "800", letterSpacing: -1, paddingVertical: 4 },
  amountWords:        { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  errorText:          { color: "#EF4444", fontSize: 12, marginTop: 4, fontWeight: "700" },

  quickLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  quickRow:   { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickChip:  { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  quickChipActive: { borderColor: "#7C3AED", backgroundColor: "rgba(124,58,237,0.12)" },
  quickChipText:   { color: colors.textSecondary, fontSize: typography.body, fontWeight: "700" },

  /* Confirm */
  confirmRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16 },
  confirmDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 0 },
  warnCard: { backgroundColor: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.4)", borderWidth: 1, borderRadius: 12, padding: 12, margin: 12, marginBottom: 2, gap: 8 },
  warnTitle: { color: "#F59E0B", fontSize: 13, fontWeight: "800" },
  warnText: { color: "#F5E7C8", fontSize: 12, lineHeight: 18 },
  warnDetailBox: { marginTop: 2, borderRadius: 10, borderWidth: 1, borderColor: "rgba(252,211,77,0.28)", backgroundColor: "rgba(252,211,77,0.09)", paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
  warnDetailLine: { color: "#FDE68A", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  warnToggle: { borderWidth: 1, borderColor: "rgba(245,158,11,0.35)", borderRadius: 10, paddingVertical: 8, alignItems: "center", backgroundColor: "rgba(32,20,6,0.5)" },
  warnToggleOn: { borderColor: "rgba(34,197,94,0.4)", backgroundColor: "rgba(34,197,94,0.16)" },
  warnToggleText: { color: "#FCD34D", fontWeight: "700", fontSize: 12 },
  confirmKey:     { color: colors.textMuted, fontSize: typography.body },
  confirmVal:     { color: "#FFFFFF", fontSize: typography.body, fontWeight: "600", textAlign: "right", flex: 1, marginLeft: 12 },


  /* Buttons */
  primaryBtn:         { backgroundColor: "#7C3AED", borderRadius: radius.lg, paddingVertical: 15, alignItems: "center" },
  primaryBtnDisabled: { backgroundColor: "rgba(124,58,237,0.35)" },
  primaryBtnText:     { color: "#FFFFFF", fontSize: typography.body, fontWeight: "700" },
  doneBtnFull:        { backgroundColor: "#7C3AED", borderRadius: radius.lg, paddingVertical: 16, alignItems: "center", flex: 1 },
  secondaryBtn:       { backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, paddingVertical: 16, alignItems: "center", flex: 1, borderWidth: 1, borderColor: colors.border },
  secondaryBtnText:   { color: colors.textPrimary, fontSize: typography.body, fontWeight: "700" },

  /* Success */
  successWrap:     { alignItems: "center", gap: spacing.lg, paddingTop: spacing.xl },
  successIconWrap: { width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(34,197,94,0.1)", borderWidth: 1, borderColor: "rgba(34,197,94,0.25)", alignItems: "center", justifyContent: "center" },
  successTitle:    { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  successAmount:   { color: "#22C55E", fontSize: 36, fontWeight: "800", letterSpacing: -1 },
  successSub:      { color: colors.textMuted, fontSize: typography.body, marginTop: -8 },
  receiptCard:     { width: "100%", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  receiptHeader:   { color: "#A78BFA", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  receiptRow:      { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  receiptKey:      { color: colors.textMuted, fontSize: typography.body },
  receiptVal:      { color: "#FFFFFF", fontSize: typography.body, fontWeight: "600" },
  successBtnRow:   { width: "100%", flexDirection: "row", gap: 10 },

  pinOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", padding: 20 },
  pinCard:      { backgroundColor: "#1B1530", borderRadius: 16, borderWidth: 1, borderColor: "rgba(124,58,237,0.35)", padding: 18, gap: 10 },
  pinTitle:     { color: "#FFF", fontSize: 18, fontWeight: "800", textAlign: "center" },
  pinSub:       { color: colors.textMuted, fontSize: 12, textAlign: "center", lineHeight: 18 },
  pinInput:     { backgroundColor: "#140F22", borderRadius: 12, borderWidth: 1, borderColor: "#3A2A67", color: "#FFF", padding: 14, fontSize: 18, letterSpacing: 4, textAlign: "center" },
  pinErr:       { color: "#F87171", fontSize: 12, textAlign: "center", fontWeight: "600" },
  pinBtns:      { flexDirection: "row", gap: 10, marginTop: 4 },
  pinGhost:     { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  pinGhostText: { color: colors.textSecondary, fontWeight: "700" },
  pinPrimary:   { flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: "#7C3AED", alignItems: "center" },
  pinPrimaryText: { color: "#FFF", fontWeight: "800" },
});

function bucketLabel(bucket: SavingBucket): string {
  if (bucket === "bonus") return "Bonus";
  if (bucket === "emergency") return "Emergency";
  return "Goals";
}
