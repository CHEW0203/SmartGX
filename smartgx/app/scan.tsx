/**
 * Scan screen — TNG-style 3-tab layout.
 *   Pay       : Scan merchant QR → passcode → debit balance → transaction
 *   Show QR   : Display user's payment QR for merchant to scan
 *   Receive   : Display DuitNow QR for incoming transfers
 */
import { useEffect, useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useCardStore } from "../src/store/cardStore";
import { useAccountStore } from "../src/store/accountStore";
import { useTransactionStore } from "../src/store/transactionStore";
import { useNotificationStore } from "../src/store/notificationStore";
import { useAuthStore } from "../src/store/authStore";
import { useSavingsStore } from "../src/store/savingsStore";
import { useActivityStore } from "../src/store/activityStore";
import { generateMockTransaction } from "../src/data/mockMerchants";
import type { GeneratedTransaction } from "../src/data/mockMerchants";
import { formatRM } from "../src/lib/currency";
import { colors } from "../src/theme/colors";
import { radius } from "../src/theme/radius";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";
import type { Transaction } from "../src/types/transaction";
import { useHealthData } from "../src/hooks/useHealthData";
import { buildRiskContext } from "../src/features/nudge/riskContext.builder";
import { evaluateNudgeRisk } from "../src/features/nudge/nudge.engine";
import { generateAiNudge } from "../src/features/nudge/aiNudge.service";
import type { NudgeDecision, NudgeEvaluation, NudgeRiskContext } from "../src/features/nudge/nudge.types";
import { AiNudgeModal } from "../src/components/nudge/AiNudgeModal";
import { verifyUserPin } from "../src/features/security/sensitiveAction";
import { sensitiveActionBlockedMessage, userHasPinSet } from "../src/store/securityStore";

const SGX_ACCOUNT_NO = "1234 5678 9012";

const CAT_EMOJI: Record<string, string> = {
  food: "🍔", transport: "🚗", shopping: "🛍️",
  bills: "📋", education: "📚", entertainment: "🎬",
  subscription: "🔄", others: "💼",
};

type ScanTab  = "pay" | "showqr" | "receive";
type PayStep  = "scanner" | "confirm" | "passcode" | "success" | "error";

/* ─── Screen ──────────────────────────────────────────────────────── */
export default function ScanScreen() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const profileFullName = currentUser?.fullName?.trim() || "SmartGX User";
  const monthlyIncome = currentUser?.financialProfile?.monthlyIncome ?? 0;
  const maybeBudget = (currentUser?.financialProfile as { monthlyBudget?: number } | undefined)?.monthlyBudget;

  const { debitControls }   = useCardStore();
  const accountStore        = useAccountStore();
  const { addTransaction, transactions }  = useTransactionStore();
  const { addNotification } = useNotificationStore();
  const { addActivity } = useActivityStore();
  const {
    manualSave,
    addManualActivity,
    savingsBuckets,
    applyRoundUp,
    roundUpDestination,
  } = useSavingsStore();
  const healthReport = useHealthData();
  const roundUpPocketLabel =
    roundUpDestination === "bonus"
      ? "Bonus Pocket"
      : roundUpDestination === "emergency"
      ? "Emergency Fund"
      : "Goals";

  const [activeTab, setActiveTab] = useState<ScanTab>("pay");

  // Pay tab state
  const [payStep, setPayStep]       = useState<PayStep>("scanner");
  const [scanDone, setScanDone]     = useState(false);
  const [txn, setTxn]               = useState<GeneratedTransaction | null>(null);
  const [pin, setPin]               = useState("");
  const [pinError, setPinError]     = useState("");
  const [errorMsg, setErrorMsg]     = useState("");
  const pinRef = useRef<TextInput>(null);
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState("");
  const [nudgeContext, setNudgeContext] = useState<NudgeRiskContext | null>(null);
  const [nudgeEvaluation, setNudgeEvaluation] = useState<NudgeEvaluation | null>(null);
  const [receiveFeedback, setReceiveFeedback] = useState("");
  const [pinFlowBusy, setPinFlowBusy] = useState(false);

  useEffect(() => {
    if (payStep !== "passcode") return;
    const t = setTimeout(() => pinRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [payStep]);

  const handleScan = () => {
    const block = sensitiveActionBlockedMessage();
    if (block) {
      setErrorMsg(block);
      setPayStep("error");
      return;
    }
    const generated = generateMockTransaction();
    setTxn(generated);

    // Hard validation first: insufficient balance is invalid, not just risky.
    if (generated.amount > accountStore.mainBalance) {
      setErrorMsg(
        `Insufficient balance. This payment is ${formatRM(generated.amount)} but you only have ${formatRM(accountStore.mainBalance)}.`
      );
      setPayStep("error");
      return;
    }

    if (debitControls.frozen) {
      setErrorMsg("Your Debit Card is frozen. Unfreeze it in Card Controls to make payments.");
      setPayStep("error"); return;
    }
    if (generated.paymentType === "online" && !debitControls.onlinePayment) {
      setErrorMsg("Online Payments are disabled. Enable this in Card Controls to proceed.");
      setPayStep("error"); return;
    }
    if (generated.paymentType === "contactless" && !debitControls.contactless) {
      setErrorMsg("Contactless Payments are disabled. Enable this in Card Controls to proceed.");
      setPayStep("error"); return;
    }

    setScanDone(true);
    setPayStep("confirm");
  };

  const buildScanRiskContext = () => {
    if (!txn) return null;
    return buildRiskContext({
      actionType: "scan_payment",
      amount: txn.amount,
      paymentMethod: "gx_card",
      cardType: "debit",
      merchant: txn.merchant,
      category: txn.category,
      mainBalance: accountStore.mainBalance,
      flexiLimit: accountStore.flexiLimit,
      flexiUsed: accountStore.flexiUsed,
      gxHealthScore: healthReport.score,
      monthlyIncome,
      transactions,
      userId: currentUser?.id ?? "",
      savingsBalance:
        savingsBuckets.bonus + savingsBuckets.emergency + savingsBuckets.goals,
      hasBudget: typeof maybeBudget === "number" && maybeBudget > 0,
      budgetAmount: maybeBudget ?? null,
    });
  };

  const handleStartPinFlow = async () => {
    if (pinFlowBusy) return;
    const context = buildScanRiskContext();
    if (!context) return;
    const evaluation = evaluateNudgeRisk(context);
    if (!evaluation.requiresSoftFriction) {
      setPin("");
      setPinError("");
      setPayStep("passcode");
      return;
    }
    setPinFlowBusy(true);
    try {
      const message = await generateAiNudge(context, evaluation);
      // Hide confirm sheet first so AI modal is not visually blocked on native.
      setPayStep("scanner");
      setNudgeContext(context);
      setNudgeEvaluation(evaluation);
      setNudgeMessage(message);
      setNudgeVisible(true);
    } finally {
      setPinFlowBusy(false);
    }
  };

  const handleSaveInstead = () => {
    if (!txn) return;
    const isoNow = new Date().toISOString();
    const saveAmt = Math.min(txn.amount, accountStore.mainBalance);
    if (saveAmt <= 0) {
      setNudgeVisible(false);
      return;
    }
    const debit = accountStore.debitPay(saveAmt);
    if (!debit.ok) {
      setNudgeVisible(false);
      return;
    }
    manualSave("goals", saveAmt);
    addManualActivity({
      id: `manual-save-scan-${Date.now()}`,
      label: "Saved instead of scan payment",
      pocket: "Goals",
      type: "manual",
      amount: saveAmt,
      date: "2026-05-08",
    });
    addNotification({
      id: `notif-scan-save-instead-${Date.now()}`,
      title: "Save Instead completed",
      message: `${formatRM(saveAmt)} moved to Goals instead of scan payment.`,
      time: "8 May 2026 · Now",
      read: false,
      type: "insight",
    });
    addActivity({
      id: `act-save-instead-scan-${Date.now()}`,
      type: "save_instead",
      title: "Save Instead",
      description: "Saved instead of scan payment",
      amount: saveAmt,
      direction: "credit",
      timestamp: isoNow,
      route: "/savings",
    });
    addActivity({
      id: `act-scan-${Date.now()}`,
      type: "scan_payment",
      title: "Scan Payment",
      description: txn.merchant,
      amount: txn.amount,
      direction: "debit",
      timestamp: isoNow,
      route: "/transactions",
    });
    setNudgeVisible(false);
    handleReset();
  };

  const handleNudgeDecision = (decision: NudgeDecision) => {
    if (decision === "continue") {
      setNudgeVisible(false);
      setPin("");
      setPinError("");
      setPayStep("passcode");
      return;
    }
    if (decision === "save_instead") {
      handleSaveInstead();
      return;
    }
    if (decision === "review_gxhealth") {
      setNudgeVisible(false);
      router.push("/gxhealth" as never);
      return;
    }
    if (decision === "try_smaller_amount") {
      setNudgeVisible(false);
      setPayStep("scanner");
      setScanDone(false);
      setTxn(null);
      setPin("");
      setPinError("");
      return;
    }
    if (decision === "cancel") {
      setNudgeVisible(false);
      handleReset();
      return;
    }
    setNudgeVisible(false);
  };

  const handleConfirmPayment = async () => {
    if (!txn) return;
    const block = sensitiveActionBlockedMessage();
    if (block) {
      setPinError(block);
      setPin("");
      return;
    }
    const v = await verifyUserPin(pin);
    if (!v.ok) {
      setPinError(v.message ?? "Incorrect PIN.");
      setPin("");
      return;
    }

    const result = accountStore.debitPay(txn.amount);
    if (!result.ok) {
      setErrorMsg(`Insufficient balance. You have ${formatRM(accountStore.mainBalance)} available.`);
      setPayStep("error"); return;
    }

    const risk = nudgeEvaluation?.riskLevel ?? "low";
    const now = new Date();
    const isoNow = now.toISOString();
    const dateOnly = isoNow.slice(0, 10);
    const timeLabel = now.toTimeString().slice(0, 5);
    const uid = useAuthStore.getState().currentUser?.id ?? "";
    const newTxn: Transaction = {
      id:              `t-scan-${Date.now()}`,
      userId:          uid,
      merchant:        txn.merchant,
      category:        txn.category,
      amount:          txn.amount,
      type:            "expense",
      paymentMethod:   "gx_card",
      transactionDate: dateOnly,
      riskLevel:       risk,
      isSuspicious:    false,
      note:            "QR scan payment",
      sourceAction:    "scan_payment",
      occurredAt:      isoNow,
    };
    addTransaction(newTxn);
    addActivity({
      id: `act-scan-${Date.now()}`,
      type: "scan_payment",
      title: "Scan Payment",
      description: `${txn.merchant} · ${txn.category}`,
      amount: txn.amount,
      direction: "debit",
      timestamp: isoNow,
      route: "/transactions",
    });

    addNotification({
      id:      `notif-scan-${Date.now()}`,
      title:   "Scan payment successful",
      message: `${formatRM(txn.amount)} paid to ${txn.merchant} via QR scan. Balance: ${formatRM(accountStore.mainBalance)}.`,
      time:    `${dateOnly} · ${timeLabel}`,
      read:    false,
      type:    "info",
    });
    if (nudgeEvaluation?.shouldCreateNotification && risk !== "low") {
      addNotification({
        id: `notif-scan-risk-${Date.now()}`,
        title: risk === "critical" ? "Critical scan payment warning" : "High-risk scan payment",
        message: `SmartGX AI flagged this scan payment as ${risk} risk before completion.`,
        time: `${dateOnly} · ${timeLabel}`,
        read: false,
        type: "risk",
      });
    }

    const roundUpCandidate = Math.round((Math.ceil(txn.amount) - txn.amount) * 100) / 100;
    if (roundUpCandidate > 0 && accountStore.mainBalance >= roundUpCandidate) {
      const roundUpDebit = accountStore.debitPay(roundUpCandidate);
      if (roundUpDebit.ok) {
        const roundUpResult = applyRoundUp(txn.amount);
        if (roundUpResult.ok && roundUpResult.saved > 0) {
          addManualActivity({
            id: `roundup-scan-${Date.now()}`,
            label: "Round-up from scan payment",
            pocket: roundUpPocketLabel,
            type: "roundup",
            amount: roundUpResult.saved,
            date: dateOnly,
            occurredAt: isoNow,
          });
          addActivity({
            id: `act-roundup-scan-${Date.now()}`,
            type: "round_up_saving",
            title: "Round-up Saving",
            description: "Round-up from scan payment",
            amount: roundUpResult.saved,
            direction: "credit",
            timestamp: new Date(Date.parse(isoNow) + 1000).toISOString(),
            route: "/savings",
          });
        }
      }
    }

    setPayStep("success");
  };

  const handleReset = () => {
    setPayStep("scanner");
    setScanDone(false);
    setTxn(null);
    setPin(""); setPinError(""); setErrorMsg("");
    setActiveTab("pay");
    setNudgeVisible(false);
    setNudgeContext(null);
    setNudgeEvaluation(null);
    setNudgeMessage("");
    setReceiveFeedback("");
    setPinFlowBusy(false);
  };

  const handleCopyAccount = async () => {
    try {
      await Clipboard.setStringAsync(SGX_ACCOUNT_NO.replace(/\s+/g, ""));
      setReceiveFeedback("Account number copied");
    } catch {
      setReceiveFeedback("Unable to copy account number");
    }
  };

  const handleShareQr = async () => {
    try {
      await Share.share({
        message: `Receive transfer via DuitNow\n${profileFullName}\nAccount: ${SGX_ACCOUNT_NO}`,
      });
      setReceiveFeedback("");
    } catch {
      setReceiveFeedback("Unable to share right now");
    }
  };

  if (!currentUser) return <Redirect href="/auth/login" />;
  if (!userHasPinSet()) return <Redirect href="/auth/app-pin-setup" />;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0529" />

      {nudgeContext && nudgeEvaluation && (
        <AiNudgeModal
          visible={nudgeVisible}
          message={nudgeMessage}
          amountLabel={formatRM(nudgeContext.amount)}
          summaryLabel="Scan payment"
          evaluation={nudgeEvaluation}
          riskContext={nudgeContext}
          onDecision={handleNudgeDecision}
        />
      )}

      {/* ── Header ── */}
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => router.push("/dashboard" as never)}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18L9 12L15 6" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>
          {activeTab === "pay" ? "Scan QR" : activeTab === "showqr" ? "My Payment QR" : "Receive Money"}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* ── Content area ── */}
      <View style={styles.contentArea}>

        {/* ── TAB: Pay (Scan QR) ── */}
        {activeTab === "pay" && (
          <View style={styles.scanContent}>
            <View style={styles.viewfinder}>
              <Svg width={240} height={240} viewBox="0 0 240 240" fill="none">
                <Path d="M20 60V20H60" stroke="#7C3AED" strokeWidth="4" strokeLinecap="round" />
                <Path d="M180 20H220V60" stroke="#7C3AED" strokeWidth="4" strokeLinecap="round" />
                <Path d="M20 180V220H60" stroke="#7C3AED" strokeWidth="4" strokeLinecap="round" />
                <Path d="M220 180V220H180" stroke="#7C3AED" strokeWidth="4" strokeLinecap="round" />
                <Rect x="70" y="70" width="100" height="100" rx="4" fill="rgba(124,58,237,0.06)" stroke="rgba(124,58,237,0.18)" strokeWidth="1" />
                <Rect x="80" y="80" width="30" height="30" rx="2" stroke="rgba(196,181,253,0.35)" strokeWidth="1.5" fill="none" />
                <Rect x="130" y="80" width="30" height="30" rx="2" stroke="rgba(196,181,253,0.35)" strokeWidth="1.5" fill="none" />
                <Rect x="80" y="130" width="30" height="30" rx="2" stroke="rgba(196,181,253,0.35)" strokeWidth="1.5" fill="none" />
                <Rect x="130" y="125" width="12" height="12" rx="1" fill="rgba(196,181,253,0.28)" />
                <Rect x="148" y="125" width="12" height="12" rx="1" fill="rgba(196,181,253,0.28)" />
                <Rect x="130" y="143" width="30" height="12" rx="1" fill="rgba(196,181,253,0.18)" />
              </Svg>
            </View>
            <Text style={styles.scanHint}>
              {scanDone ? "QR detected — reviewing payment" : "Point camera at a merchant QR code"}
            </Text>
            <Pressable style={styles.scanBtn} onPress={handleScan}>
              <Text style={styles.scanBtnText}>Simulate QR Scan</Text>
            </Pressable>
          </View>
        )}

        {/* ── TAB: Pay (Show QR to merchant) ── */}
        {activeTab === "showqr" && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.qrContent}>
            <Text style={styles.qrSubtitle}>Show this QR to the merchant to pay</Text>
            <View style={styles.qrCard}>
              {/* QR image with SGX badge overlaid in centre */}
              <View style={styles.qrImgWrap}>
                <Image
                  source={require("../assets/qr_pay.png")}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
                <View style={styles.sgxBadge}>
                  <Text style={styles.sgxBadgeText}>SGX</Text>
                </View>
              </View>
              <Text style={styles.qrName}>{profileFullName}</Text>
              <Text style={styles.qrAccountLabel}>SmartGX · {SGX_ACCOUNT_NO}</Text>
            </View>
            <View style={styles.qrInfoRow}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="10" stroke="#A78BFA" strokeWidth="1.8" />
                <Path d="M12 8V12M12 16H12.01" stroke="#A78BFA" strokeWidth="1.8" strokeLinecap="round" />
              </Svg>
              <Text style={styles.qrInfoText}>Merchant scans this code. Amount is entered at point of sale.</Text>
            </View>
          </ScrollView>
        )}

        {/* ── TAB: Receive (DuitNow QR) ── */}
        {activeTab === "receive" && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.qrContent}>
            <Text style={styles.qrSubtitle}>Share your DuitNow QR to receive transfers</Text>
            <View style={[styles.qrCard, styles.receiveQrCard]}>
              <View style={styles.duitnowBadge}>
                <Text style={styles.duitnowBadgeText}>DuitNow</Text>
              </View>
              <View style={styles.receiveQrSquare}>
                <Svg width={188} height={188} viewBox="0 0 188 188" fill="none">
                  <Rect width="188" height="188" fill="#FFFFFF" />
                  <Rect x="16" y="16" width="46" height="46" stroke="#111827" strokeWidth="8" />
                  <Rect x="126" y="16" width="46" height="46" stroke="#111827" strokeWidth="8" />
                  <Rect x="16" y="126" width="46" height="46" stroke="#111827" strokeWidth="8" />
                  <Rect x="30" y="30" width="18" height="18" fill="#111827" />
                  <Rect x="140" y="30" width="18" height="18" fill="#111827" />
                  <Rect x="30" y="140" width="18" height="18" fill="#111827" />
                  <Rect x="80" y="76" width="10" height="10" fill="#111827" />
                  <Rect x="94" y="76" width="10" height="10" fill="#111827" />
                  <Rect x="108" y="76" width="10" height="10" fill="#111827" />
                  <Rect x="76" y="90" width="10" height="10" fill="#111827" />
                  <Rect x="90" y="90" width="10" height="10" fill="#111827" />
                  <Rect x="104" y="90" width="10" height="10" fill="#111827" />
                  <Rect x="118" y="90" width="10" height="10" fill="#111827" />
                  <Rect x="76" y="104" width="10" height="10" fill="#111827" />
                  <Rect x="104" y="104" width="10" height="10" fill="#111827" />
                  <Rect x="118" y="104" width="10" height="10" fill="#111827" />
                  <Rect x="76" y="118" width="10" height="10" fill="#111827" />
                  <Rect x="90" y="118" width="10" height="10" fill="#111827" />
                  <Rect x="118" y="118" width="10" height="10" fill="#111827" />
                </Svg>
              </View>
              <Text style={styles.qrName}>{profileFullName}</Text>
              <Text style={[styles.qrAccountLabel, { color: "#38BDF8" }]}>DuitNow · {SGX_ACCOUNT_NO}</Text>
              <View style={styles.receiveBtnRow}>
                <Pressable style={styles.receiveBtn} onPress={handleCopyAccount}>
                  <Text style={styles.receiveBtnText}>Copy Account No.</Text>
                </Pressable>
                <Pressable style={styles.receiveBtn} onPress={handleShareQr}>
                  <Text style={styles.receiveBtnText}>Share QR</Text>
                </Pressable>
              </View>
              {receiveFeedback ? <Text style={styles.receiveFeedback}>{receiveFeedback}</Text> : null}
            </View>
            <View style={[styles.qrInfoRow, { borderColor: "rgba(56,189,248,0.2)" }]}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="10" stroke="#38BDF8" strokeWidth="1.8" />
                <Path d="M12 8V12M12 16H12.01" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
              </Svg>
              <Text style={[styles.qrInfoText, { color: "#38BDF8" }]}>
                Anyone with a DuitNow-enabled app can scan this QR to send you money.
              </Text>
            </View>
          </ScrollView>
        )}
      </View>

      {/* ── Bottom Tab Bar ── */}
      <View
        style={styles.tabBar}
        pointerEvents={payStep === "confirm" || payStep === "passcode" || payStep === "success" || payStep === "error" ? "none" : "auto"}
      >
        {(["pay", "showqr", "receive"] as ScanTab[]).map((tab) => {
          const labels: Record<ScanTab, string> = { pay: "Scan", showqr: "Pay", receive: "Receive" };
          const icons: Record<ScanTab, React.ReactNode> = {
            pay: (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M3 7H21M3 12H21M3 17H13" stroke={activeTab === "pay" ? "#A78BFA" : colors.textMuted} strokeWidth="2" strokeLinecap="round" />
                <Rect x="15" y="14" width="6" height="6" rx="1.5" stroke={activeTab === "pay" ? "#A78BFA" : colors.textMuted} strokeWidth="1.8" />
              </Svg>
            ),
            showqr: (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Rect x="3" y="3" width="8" height="8" rx="1.5" stroke={activeTab === "showqr" ? "#A78BFA" : colors.textMuted} strokeWidth="1.8" fill="none" />
                <Rect x="13" y="3" width="8" height="8" rx="1.5" stroke={activeTab === "showqr" ? "#A78BFA" : colors.textMuted} strokeWidth="1.8" fill="none" />
                <Rect x="3" y="13" width="8" height="8" rx="1.5" stroke={activeTab === "showqr" ? "#A78BFA" : colors.textMuted} strokeWidth="1.8" fill="none" />
                <Path d="M13 17H17M17 13V17M17 17H21" stroke={activeTab === "showqr" ? "#A78BFA" : colors.textMuted} strokeWidth="1.8" strokeLinecap="round" />
              </Svg>
            ),
            receive: (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M12 3V15M12 15L8 11M12 15L16 11" stroke={activeTab === "receive" ? "#38BDF8" : colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M3 21H21" stroke={activeTab === "receive" ? "#38BDF8" : colors.textMuted} strokeWidth="2" strokeLinecap="round" />
              </Svg>
            ),
          };
          const active = activeTab === tab;
          const accentColor = tab === "receive" ? "#38BDF8" : "#A78BFA";
          return (
            <Pressable
              key={tab}
              style={[styles.tabBtn, active && { borderTopColor: accentColor }]}
              onPress={() => setActiveTab(tab)}
            >
              {icons[tab]}
              <Text style={[styles.tabLabel, active && { color: accentColor }]}>{labels[tab]}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Confirm Modal (bottom sheet) ── */}
      <Modal
        visible={payStep === "confirm" || payStep === "success" || payStep === "error"}
        transparent
        animationType="slide"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        hardwareAccelerated
        supportedOrientations={["portrait", "landscape"]}
        onRequestClose={() => { handleReset(); }}
      >
        <Pressable
          style={modal.overlay}
          onPress={() => {
            if (payStep === "confirm") handleReset();
          }}
        >
          <Pressable style={modal.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={modal.handle} />
            {payStep === "confirm" && txn && (
              <View style={modal.step}>
                <Text style={modal.title}>QR Payment</Text>
                <View style={modal.merchantBlock}>
                  <Text style={modal.merchantEmoji}>{CAT_EMOJI[txn.category] ?? "💳"}</Text>
                  <Text style={modal.merchantName}>{txn.merchant}</Text>
                  <Text style={modal.merchantMeta}>
                    {txn.paymentType === "contactless" ? "Contactless" : "Online"} · {txn.transactionDate}
                  </Text>
                </View>
                <Text style={modal.amount}>{formatRM(txn.amount)}</Text>
                <View style={modal.detailsBox}>
                  <View style={modal.detailRow}>
                    <Text style={modal.detailKey}>Card</Text>
                    <Text style={modal.detailVal}>Debit Card ••••4821</Text>
                  </View>
                  <View style={modal.detailRow}>
                    <Text style={modal.detailKey}>After payment</Text>
                    <Text style={[modal.detailVal, { color: "#22C55E" }]}>
                      {formatRM(accountStore.mainBalance - txn.amount)} remaining
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={[modal.primaryBtnFull, pinFlowBusy && { opacity: 0.85 }]}
                  onPress={() => void handleStartPinFlow()}
                  disabled={pinFlowBusy}
                  hitSlop={8}
                >
                  {pinFlowBusy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={modal.primaryBtnText}>Enter PIN →</Text>
                  )}
                </Pressable>
              </View>
            )}
            {payStep === "success" && txn && (
              <View style={[modal.step, { alignItems: "center" }]}>
                <View style={modal.successIcon}>
                  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="12" r="10" fill="rgba(34,197,94,0.15)" stroke="#22C55E" strokeWidth="1.5" />
                    <Path d="M8 12L11 15L16 9" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={modal.successTitle}>Payment Successful</Text>
                <Text style={modal.successDetails}>{txn.merchant}</Text>
                <Text style={modal.successAmount}>{formatRM(txn.amount)}</Text>
                <View style={modal.balancePill}>
                  <Text style={modal.balancePillText}>Balance: {formatRM(accountStore.mainBalance)}</Text>
                </View>
                <View style={[modal.btnRow, { marginTop: spacing.md, width: "100%" }]}>
                  <Pressable style={modal.cancelBtn} onPress={handleReset}>
                    <Text style={modal.cancelBtnText}>Scan Again</Text>
                  </Pressable>
                  <Pressable style={modal.primaryBtn} onPress={() => { handleReset(); router.push("/dashboard" as never); }}>
                    <Text style={modal.primaryBtnText}>Done</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {payStep === "error" && (
              <View style={[modal.step, { alignItems: "center" }]}>
                <View style={modal.errorIcon}>
                  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="12" r="10" fill="rgba(239,68,68,0.15)" stroke="#EF4444" strokeWidth="1.5" />
                    <Path d="M15 9L9 15M9 9L15 15" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" />
                  </Svg>
                </View>
                <Text style={modal.errorTitle}>Payment Blocked</Text>
                <Text style={modal.errorMsg}>{errorMsg}</Text>
                <View style={[modal.btnRow, { marginTop: spacing.md }]}>
                  <Pressable style={modal.cancelBtn} onPress={handleReset}>
                    <Text style={modal.cancelBtnText}>Try Again</Text>
                  </Pressable>
                  <Pressable
                    style={modal.primaryBtn}
                    onPress={() => {
                      handleReset();
                      router.push("/dashboard" as never);
                    }}
                  >
                    <Text style={modal.primaryBtnText}>Close</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Passcode Modal (centered) ── */}
      <Modal
        visible={payStep === "passcode"}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        hardwareAccelerated
        supportedOrientations={["portrait", "landscape"]}
        onRequestClose={() => setPayStep("confirm")}
      >
        <View style={modal.pinOverlay}>
          <View style={modal.pinCard}>
            <Text style={modal.title}>Enter Payment PIN</Text>
            {txn && (
              <View style={modal.passcodeSummary}>
                <Text style={modal.passcodeRecipient}>{txn.merchant}</Text>
                <Text style={modal.passcodeAmount}>{formatRM(txn.amount)}</Text>
              </View>
            )}
            <Text style={modal.passcodeLabel}>6-digit PIN</Text>
            <Pressable style={modal.dotRow} onPress={() => pinRef.current?.focus()}>
              {Array.from({ length: 6 }, (_, i) => (
                <View key={i} style={[modal.dot, i < pin.length ? modal.dotFilled : modal.dotEmpty]} />
              ))}
            </Pressable>
            <TextInput
              ref={pinRef}
              style={modal.hiddenInput}
              value={pin}
              onChangeText={(v) => { setPin(v.replace(/[^0-9]/g, "")); setPinError(""); }}
              keyboardType="number-pad"
              maxLength={6}
              caretHidden
            />
            {pinError ? <Text style={modal.pinError}>{pinError}</Text> : null}
            <View style={modal.btnRow}>
              <Pressable style={modal.cancelBtn} onPress={() => { setPayStep("confirm"); setPin(""); setPinError(""); }}>
                <Text style={modal.cancelBtnText}>Back</Text>
              </Pressable>
              <Pressable
                style={[modal.primaryBtn, pin.length < 6 && modal.btnDisabled]}
                onPress={handleConfirmPayment}
              >
                <Text style={[modal.primaryBtnText, pin.length < 6 && { opacity: 0.4 }]}>
                  Confirm Pay
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}


/* ─── Styles ──────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.background },
  headerRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  backBtn:     { padding: 4 },
  headerTitle: { color: "#FFFFFF", fontSize: typography.title, fontWeight: "800" },

  contentArea: { flex: 1 },

  /* Pay tab */
  scanContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, paddingHorizontal: 24 },
  viewfinder:  { width: 240, height: 240, alignItems: "center", justifyContent: "center" },
  scanHint:    { color: "#FFFFFF", fontSize: typography.subheading, fontWeight: "700", textAlign: "center" },
  scanBtn:     { backgroundColor: "#7C3AED", borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 40 },
  scanBtnText: { color: "#FFFFFF", fontSize: typography.body, fontWeight: "700" },

  /* QR tabs */
  qrContent:       { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, alignItems: "center", gap: 16 },
  qrSubtitle:      { color: colors.textMuted, fontSize: typography.body, textAlign: "center" },
  qrCard:          { backgroundColor: colors.surface, borderWidth: 1, borderColor: "rgba(167,139,250,0.2)", borderRadius: 20, padding: 24, alignItems: "center", gap: 12, width: "100%" },
  qrName:          { color: "#FFFFFF", fontSize: typography.subheading, fontWeight: "800", textAlign: "center", width: "100%" },
  qrAccountLabel:  { color: "#A78BFA", fontSize: typography.caption, fontWeight: "600", textAlign: "center", width: "100%" },
  duitnowBadge:    {
    alignSelf: "center",
    backgroundColor: "rgba(56,189,248,0.1)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.3)",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  duitnowBadgeText:{ color: "#38BDF8", fontSize: 12, fontWeight: "800" },
  qrInfoRow:       { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "rgba(167,139,250,0.06)", borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(167,139,250,0.15)", padding: 12, width: "100%" },
  qrInfoText:      { color: "#A78BFA", fontSize: typography.caption, lineHeight: 18, flex: 1 },

  /* Real QR image + SGX badge overlay */
  qrImgWrap:   { width: 200, height: 200, alignItems: "center", justifyContent: "center" },
  qrImage:     { width: 200, height: 200 },

  /* Receive: white square + centred image (avoid absoluteFill — it clips badly on some devices) */
  receiveQrCard:   { borderColor: "rgba(56,189,248,0.25)", alignItems: "center", width: "100%" },
  receiveQrSquare: {
    width: 212,
    height: 212,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
  },
  receiveBtnRow: { flexDirection: "row", gap: 8, marginTop: spacing.xs, width: "100%" },
  receiveBtn: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.35)",
    backgroundColor: "rgba(56,189,248,0.12)",
    alignItems: "center",
    paddingVertical: 10,
  },
  receiveBtnText: { color: "#38BDF8", fontSize: typography.caption, fontWeight: "800" },
  receiveFeedback: { color: "#22C55E", fontSize: typography.caption, fontWeight: "700", marginTop: 4 },
  sgxBadge:    { position: "absolute", width: 44, height: 44, borderRadius: 10, backgroundColor: "#1A0845", borderWidth: 2, borderColor: "#7C3AED", alignItems: "center", justifyContent: "center" },
  sgxBadgeText:{ color: "#FFFFFF", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },

  /* Tab bar */
  tabBar:  { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  tabBtn:  { flex: 1, alignItems: "center", paddingVertical: 12, gap: 4, borderTopWidth: 2, borderTopColor: "transparent" },
  tabLabel:{ color: colors.textMuted, fontSize: 11, fontWeight: "600" },
});

const modal = StyleSheet.create({
  /* Bottom sheet (confirm / success / error) */
  overlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end", pointerEvents: "auto" },
  sheet:    { backgroundColor: "#0C0920", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: "rgba(167,139,250,0.2)", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 14, zIndex: 20, elevation: 20, pointerEvents: "auto" },
  handle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "center", marginBottom: 8 },
  step:     { gap: 14 },
  title:    { color: "#FFFFFF", fontSize: 18, fontWeight: "800", textAlign: "center" },

  merchantBlock:{ alignItems: "center", gap: 4 },
  merchantEmoji:{ fontSize: 36 },
  merchantName: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  merchantMeta: { color: colors.textMuted, fontSize: typography.body },
  amount:       { color: "#FFFFFF", fontSize: 36, fontWeight: "800", letterSpacing: -1, textAlign: "center" },
  detailsBox:   { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  detailRow:    { flexDirection: "row", justifyContent: "space-between" },
  detailKey:    { color: colors.textMuted, fontSize: typography.caption },
  detailVal:    { color: "#FFFFFF", fontSize: typography.caption, fontWeight: "600" },

  /* Passcode (centered modal) */
  pinOverlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24, pointerEvents: "auto" },
  pinCard:          { width: "100%", backgroundColor: "#0C0920", borderRadius: 20, borderWidth: 1, borderColor: "rgba(167,139,250,0.25)", padding: 24, gap: 14, zIndex: 30, elevation: 30, pointerEvents: "auto" },
  passcodeSummary:  { alignItems: "center", gap: 2 },
  passcodeRecipient:{ color: colors.textMuted, fontSize: typography.body },
  passcodeAmount:   { color: "#FFFFFF", fontSize: 26, fontWeight: "800" },
  passcodeLabel:    { color: colors.textMuted, fontSize: typography.caption, textAlign: "center" },
  dotRow:           { flexDirection: "row", gap: 12, justifyContent: "center", paddingVertical: 8 },
  dot:              { width: 16, height: 16, borderRadius: 8 },
  dotEmpty:         { backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1.5, borderColor: "rgba(167,139,250,0.25)" },
  dotFilled:        { backgroundColor: "#7C3AED" },
  hiddenInput:      { position: "absolute", opacity: 0, width: 1, height: 1, top: 0, left: 0 },
  pinError:         { color: "#EF4444", fontSize: typography.caption, textAlign: "center" },
  pinHint:          { color: colors.textMuted, fontSize: 11, textAlign: "center" },

  btnRow:        { flexDirection: "row", gap: 10 },
  cancelBtn:     { flex: 1, minHeight: 48, paddingVertical: 13, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { color: colors.textMuted, fontSize: typography.body, fontWeight: "600" },
  primaryBtn:    { flex: 1, minHeight: 48, paddingVertical: 13, borderRadius: 12, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" },
  primaryBtnFull:{ width: "100%", minHeight: 50, paddingVertical: 13, borderRadius: 12, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center", marginTop: 2 },
  primaryBtnText:{ color: "#FFFFFF", fontSize: typography.body, fontWeight: "700" },
  btnDisabled:   { backgroundColor: "rgba(124,58,237,0.35)" },

  successIcon:    { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(34,197,94,0.12)", borderWidth: 1, borderColor: "rgba(34,197,94,0.25)", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  successTitle:   { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  successDetails: { color: colors.textMuted, fontSize: typography.body },
  successAmount:  { color: "#22C55E", fontSize: 30, fontWeight: "800" },
  balancePill:    { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "rgba(34,197,94,0.1)", borderWidth: 1, borderColor: "rgba(34,197,94,0.25)" },
  balancePillText:{ color: "#22C55E", fontSize: typography.caption, fontWeight: "700" },
  errorIcon:      { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(239,68,68,0.12)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  errorTitle:     { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  errorMsg:       { color: colors.textSecondary, fontSize: typography.body, lineHeight: 22, textAlign: "center" },
});
