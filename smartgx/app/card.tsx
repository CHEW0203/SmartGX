import { useEffect, useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import {
  ActivityIndicator,
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
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../src/hooks/useAuth";
import { useCardStore } from "../src/store/cardStore";
import { useAccountStore } from "../src/store/accountStore";
import { useTransactionStore } from "../src/store/transactionStore";
import { useNotificationStore } from "../src/store/notificationStore";
import { useSavingsStore } from "../src/store/savingsStore";
import { useFlexiCreditStore } from "../src/store/flexiCreditStore";
import { useActivityStore } from "../src/store/activityStore";
import { generateMockTransaction } from "../src/data/mockMerchants";
import type { GeneratedTransaction } from "../src/data/mockMerchants";
import type { CardType } from "../src/store/cardStore";
import type { Transaction } from "../src/types/transaction";
import { formatRM } from "../src/lib/currency";
import { colors } from "../src/theme/colors";
import { radius } from "../src/theme/radius";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";
import { useHealthData } from "../src/hooks/useHealthData";
import { buildRiskContext } from "../src/features/nudge/riskContext.builder";
import { evaluateNudgeRisk } from "../src/features/nudge/nudge.engine";
import { generateAiNudge } from "../src/features/nudge/aiNudge.service";
import type { NudgeDecision, NudgeEvaluation, NudgeRiskContext } from "../src/features/nudge/nudge.types";
import { AiNudgeModal } from "../src/components/nudge/AiNudgeModal";
import { verifyUserPin } from "../src/features/security/sensitiveAction";
import { sensitiveActionBlockedMessage, userHasPinSet } from "../src/store/securityStore";
import {
  computeCreditBillingWindow,
  computeCreditMinPayment,
  creditUsagePercent,
  dailyDebitProgressPercent,
  DEFAULT_DEBIT_DAILY_LIMIT,
  availableDebitSpending,
  formatBillingDateShort,
  remainingDebitDailyLimit,
  safeMoney,
  sumDebitTapPaySpendForDay,
} from "../src/features/card/cardSpend";

/* ─── Payment flow step ───────────────────────────────────────────── */
type PayStep = "idle" | "confirm" | "flexiWarning" | "passcode" | "success" | "error";

/* ─── Category display ────────────────────────────────────────────── */
const CAT_EMOJI: Record<string, string> = {
  food: "🍔", transport: "🚗", shopping: "🛍️",
  bills: "📋", education: "📚", entertainment: "🎬",
  subscription: "🔄", others: "💼",
};
const CAT_LABEL: Record<string, string> = {
  food: "Food & Dining", transport: "Transport", shopping: "Shopping",
  bills: "Bills & Utilities", education: "Education", entertainment: "Entertainment",
  subscription: "Subscription", others: "Others",
};

/* ─── Static mock card data (non-dynamic parts) ──────────────────── */
const DEBIT_META = {
  type:        "Debit Card" as const,
  lastFour:    "4821",
  fullNumber:  "4821903456784821",
  network:     "Mastercard",
  expiryMonth: "09",
  expiryYear:  "2028",
};

const FLEXI_META = {
  type:          "Credit" as const,
  lastFour:      "7293",
  fullNumber:    "5372846102937293",
  network:       "Mastercard",
  expiryMonth:   "11",
  expiryYear:    "2027",
};

function debitTapPayValidation(
  amount: number,
  mainBalance: number,
  debitDailyLimit: number,
  todayDebitSpent: number
): { ok: true } | { ok: false; message: string } {
  const main = Math.max(0, safeMoney(mainBalance, 0));
  const rem = remainingDebitDailyLimit(debitDailyLimit, todayDebitSpent);
  if (amount > main) return { ok: false, message: "Insufficient Main Account balance." };
  if (amount > rem) return { ok: false, message: "This exceeds your remaining daily debit limit." };
  return { ok: true };
}

/* ─── Icons ───────────────────────────────────────────────────────── */
function ChevronLeft({ c = colors.textMuted }: { c?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ChevronRight({ c = colors.textMuted }: { c?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18L15 12L9 6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function EyeIcon({ visible, color = "#C4B5FD" }: { visible: boolean; color?: string }) {
  return visible ? (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15Z" stroke={color} strokeWidth="1.8" />
    </Svg>
  ) : (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M17.94 17.94C16.23 19.24 14.19 20 12 20C5 20 1 12 1 12C2.24 9.68 4.07 7.72 6.26 6.26M10.59 5.18C11.05 5.06 11.52 5 12 5C19 5 23 12 23 12C22.57 12.74 22.05 13.44 21.48 14.07M14.12 14.12C13.43 14.45 13.01 14.89 12 15C11 15 9.5 14.5 9.26 14.12M3 3L21 21" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function SnowflakeIcon({ size = 20, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* 3 main axes */}
      <Path d="M12 2V22" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M2 12H22" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M4.93 4.93L19.07 19.07" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M19.07 4.93L4.93 19.07" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      {/* Tip branches — vertical arm */}
      <Path d="M12 2L9.5 5M12 2L14.5 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M12 22L9.5 19M12 22L14.5 19" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Tip branches — horizontal arm */}
      <Path d="M2 12L5 9.5M2 12L5 14.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M22 12L19 9.5M22 12L19 14.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}
function GlobeIcon({ size = 18, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22Z" stroke={color} strokeWidth="1.8" />
      <Path d="M2 12H22M12 2C9.5 5.5 8 8.5 8 12C8 15.5 9.5 18.5 12 22M12 2C14.5 5.5 16 8.5 16 12C16 15.5 14.5 18.5 12 22" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  );
}
function WifiIcon({ size = 18, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Dot */}
      <Path d="M12 20H12.01" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Arc 1 — smallest */}
      <Path d="M8.8 17C9.7 15.9 10.8 15.3 12 15.3C13.2 15.3 14.3 15.9 15.2 17" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      {/* Arc 2 — medium */}
      <Path d="M5.5 13.7C7.3 11.5 9.5 10.3 12 10.3C14.5 10.3 16.7 11.5 18.5 13.7" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      {/* Arc 3 — large */}
      <Path d="M2.2 10.4C5 7.1 8.3 5.3 12 5.3C15.7 5.3 19 7.1 21.8 10.4" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </Svg>
  );
}
function NfcIcon({ size = 20, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Card body */}
      <Rect x="1" y="12" width="9" height="7" rx="1.5" stroke={color} strokeWidth="1.6" />
      {/* Card stripe detail */}
      <Path d="M3 16.5H7" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      {/* NFC wave 1 (small) */}
      <Path d="M12 15.5C12.5 14.9 12.8 14.2 12.8 13.5C12.8 12.8 12.5 12.1 12 11.5"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* NFC wave 2 (medium) */}
      <Path d="M14.8 17.5C15.9 16.3 16.5 14.9 16.5 13.5C16.5 12.1 15.9 10.7 14.8 9.5"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* NFC wave 3 (large) */}
      <Path d="M17.5 19.5C19.2 17.7 20.2 15.7 20.2 13.5C20.2 11.3 19.2 9.3 17.5 7.5"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/* ─── Toggle row ──────────────────────────────────────────────────── */
function ToggleRow({
  label, sublabel, enabled, onToggle, icon,
}: {
  label: string; sublabel: string; enabled: boolean;
  onToggle: () => void; icon?: React.ReactNode;
}) {
  return (
    <Pressable style={tg.row} onPress={onToggle}>
      {icon && <View style={tg.iconWrap}>{icon}</View>}
      <View style={tg.body}>
        <Text style={tg.label}>{label}</Text>
        <Text style={tg.sub}>{sublabel}</Text>
      </View>
      <View style={[tg.track, enabled ? tg.trackOn : tg.trackOff]}>
        <View style={[tg.knob, enabled ? tg.knobOn : tg.knobOff]} />
      </View>
    </Pressable>
  );
}
const tg = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" },
  body:     { flex: 1, gap: 2 },
  label:    { color: "#FFFFFF", fontSize: typography.body, fontWeight: "600" },
  sub:      { color: colors.textMuted, fontSize: typography.caption },
  track:    { width: 46, height: 26, borderRadius: 13, justifyContent: "center", paddingHorizontal: 3 },
  trackOn:  { backgroundColor: "#7C3AED" },
  trackOff: { backgroundColor: "rgba(255,255,255,0.10)" },
  knob:     { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFFFFF" },
  knobOn:   { alignSelf: "flex-end" },
  knobOff:  { alignSelf: "flex-start" },
});

/* ─── Card visuals ────────────────────────────────────────────────── */
function DebitCardVisual({ numberVisible, onEyePress }: { numberVisible: boolean; onEyePress: () => void }) {
  const n = DEBIT_META.fullNumber;
  const display = numberVisible
    ? `${n.slice(0,4)} ${n.slice(4,8)} ${n.slice(8,12)} ${n.slice(12)}`
    : `•••• •••• •••• ${DEBIT_META.lastFour}`;
  return (
    <LinearGradient colors={["#3B1578","#1E0845","#0D0422"]} start={{x:0,y:0}} end={{x:1,y:1}} style={cv.gradient}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 340 200" preserveAspectRatio="none">
        <Circle cx="295" cy="-25" r="130" fill="rgba(139,92,246,0.16)" />
        <Circle cx="-15" cy="215" r="110" fill="rgba(109,40,217,0.11)" />
        <Circle cx="170" cy="100" r="195" fill="none" stroke="rgba(196,181,253,0.06)" strokeWidth="1" />
        <Path d="M0 140 Q170 100 340 155" stroke="rgba(167,139,250,0.07)" strokeWidth="1" fill="none" />
      </Svg>
      <View style={cv.top}><Text style={cv.brand}>SmartGX</Text><Text style={cv.type}>{DEBIT_META.type}</Text></View>
      <View style={cv.chipRow}>
        <Svg width={32} height={24} viewBox="0 0 32 24" fill="none">
          <Path d="M4 4H28C29.1 4 30 4.9 30 6V18C30 19.1 29.1 20 28 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="rgba(196,181,253,0.7)" strokeWidth="1.2" />
          <Path d="M10 4V20M22 4V20M2 10H30M2 15H30" stroke="rgba(196,181,253,0.45)" strokeWidth="0.8" />
        </Svg>
      </View>
      <View style={cv.numRow}>
        <Text style={cv.num}>{display}</Text>
        <Pressable onPress={onEyePress} hitSlop={10}><EyeIcon visible={numberVisible} /></Pressable>
      </View>
      <View style={cv.bottom}>
        <View><Text style={cv.expLabel}>EXPIRES</Text><Text style={cv.expVal}>{DEBIT_META.expiryMonth}/{DEBIT_META.expiryYear}</Text></View>
        <View style={cv.mcRow}>
          <View style={[cv.mcCircle, {backgroundColor:"rgba(235,0,27,0.80)"}]} />
          <View style={[cv.mcCircle, {backgroundColor:"rgba(247,158,27,0.80)",marginLeft:-16}]} />
          <Text style={cv.mcLabel}>Mastercard</Text>
        </View>
      </View>
    </LinearGradient>
  );
}
function FlexiCardVisual({ numberVisible, onEyePress }: { numberVisible: boolean; onEyePress: () => void }) {
  const n = FLEXI_META.fullNumber;
  const display = numberVisible
    ? `${n.slice(0,4)} ${n.slice(4,8)} ${n.slice(8,12)} ${n.slice(12)}`
    : `•••• •••• •••• ${FLEXI_META.lastFour}`;
  return (
    <LinearGradient colors={["#0D2B4E","#071830","#030B1B"]} start={{x:0,y:0}} end={{x:1,y:1}} style={cv.gradient}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 340 200" preserveAspectRatio="none">
        <Circle cx="290" cy="20" r="110" fill="rgba(56,189,248,0.11)" />
        <Circle cx="40" cy="200" r="90" fill="rgba(14,165,233,0.08)" />
        <Path d="M0 120 Q170 70 340 135" stroke="rgba(56,189,248,0.08)" strokeWidth="1" fill="none" />
        <Circle cx="170" cy="100" r="180" fill="none" stroke="rgba(56,189,248,0.04)" strokeWidth="1" />
      </Svg>
      <View style={cv.top}><Text style={cv.brand}>SmartGX</Text><Text style={[cv.type,{color:"#7DD3FC"}]}>{FLEXI_META.type}</Text></View>
      <View style={cv.chipRow}>
        <Svg width={32} height={24} viewBox="0 0 32 24" fill="none">
          <Path d="M4 4H28C29.1 4 30 4.9 30 6V18C30 19.1 29.1 20 28 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="rgba(125,211,252,0.6)" strokeWidth="1.2" />
          <Path d="M10 4V20M22 4V20M2 10H30M2 15H30" stroke="rgba(125,211,252,0.35)" strokeWidth="0.8" />
        </Svg>
      </View>
      <View style={cv.numRow}>
        <Text style={cv.num}>{display}</Text>
        <Pressable onPress={onEyePress} hitSlop={10}><EyeIcon visible={numberVisible} color="#7DD3FC" /></Pressable>
      </View>
      <View style={cv.bottom}>
        <View><Text style={cv.expLabel}>EXPIRES</Text><Text style={[cv.expVal,{color:"#7DD3FC"}]}>{FLEXI_META.expiryMonth}/{FLEXI_META.expiryYear}</Text></View>
        <View style={cv.mcRow}>
          <View style={[cv.mcCircle,{backgroundColor:"rgba(235,0,27,0.80)"}]} />
          <View style={[cv.mcCircle,{backgroundColor:"rgba(247,158,27,0.80)",marginLeft:-16}]} />
          <Text style={[cv.mcLabel,{color:"#7DD3FC"}]}>Mastercard</Text>
        </View>
      </View>
    </LinearGradient>
  );
}
const cv = StyleSheet.create({
  gradient: { borderRadius: 18, padding: 20, gap: 12, overflow: "hidden", aspectRatio: 1.586 },
  top:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand:    { color: "#C4B5FD", fontSize: 14, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" },
  type:     { color: "rgba(196,181,253,0.65)", fontSize: typography.caption, fontWeight: "600", letterSpacing: 0.5 },
  chipRow:  { marginTop: 2 },
  numRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, flex: 1 },
  num:      { color: "#EDE9FE", fontSize: 18, fontWeight: "700", letterSpacing: 2.5, flex: 1 },
  bottom:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  expLabel: { color: "rgba(196,181,253,0.5)", fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase" },
  expVal:   { color: "#C4B5FD", fontSize: typography.body, fontWeight: "700", marginTop: 2 },
  mcRow:    { flexDirection: "row", alignItems: "center", gap: 6 },
  mcCircle: { width: 28, height: 28, borderRadius: 14 },
  mcLabel:  { color: "rgba(196,181,253,0.65)", fontSize: 10, fontWeight: "700" },
});

/* ─── Screen ──────────────────────────────────────────────────────── */
export default function CardScreen() {
  const { currentUser } = useAuth();

  // Stores
  const { selectedCard, debitControls, flexiControls, setSelectedCard, updateDebitControls, updateFlexiControls } = useCardStore();
  const accountStore     = useAccountStore();
  const { addTransaction, transactions } = useTransactionStore();
  const { addNotification } = useNotificationStore();
  const { addActivity } = useActivityStore();
  const {
    manualSave,
    addManualActivity,
    savingsBuckets,
    applyRoundUp,
    roundUpDestination,
  } = useSavingsStore();
  const fc = useFlexiCreditStore();
  const healthReport = useHealthData();

  // Card reveal state (session-only for security)
  const [debitVisible, setDebitVisible]   = useState(false);
  const [flexiVisible, setFlexiVisible]   = useState(false);

  // Card reveal PIN modal
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [revealPin, setRevealPin]             = useState("");
  const [revealError, setRevealError]         = useState("");

  // Payment flow state
  const [payStep, setPayStep]             = useState<PayStep>("idle");
  const [generatedTxn, setGeneratedTxn]   = useState<GeneratedTransaction | null>(null);
  const [countdown, setCountdown]         = useState(10);
  const [payPin, setPayPin]               = useState("");
  const [payError, setPayError]           = useState("");
  const [paySourceOverride, setPaySourceOverride] = useState<CardType | null>(null);
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState("");
  const [nudgeContext, setNudgeContext] = useState<NudgeRiskContext | null>(null);
  const [nudgeEvaluation, setNudgeEvaluation] = useState<NudgeEvaluation | null>(null);
  /** True while waiting on AI nudge before PIN (avoid double-tap + show spinner). */
  const [payFrictionBusy, setPayFrictionBusy] = useState(false);

  const payPinRef = useRef<TextInput>(null);

  const isDebit    = selectedCard === "debit";
  const controls   = isDebit ? debitControls : flexiControls;
  const updateCtrl = isDebit ? updateDebitControls : updateFlexiControls;
  const numVisible = isDebit ? debitVisible : flexiVisible;

  const monthlyIncome = currentUser?.financialProfile?.monthlyIncome ?? 0;
  const maybeBudget = (currentUser?.financialProfile as { monthlyBudget?: number } | undefined)?.monthlyBudget;
  const roundUpPocketLabel =
    roundUpDestination === "bonus"
      ? "Bonus Pocket"
      : roundUpDestination === "emergency"
      ? "Emergency Fund"
      : "Goals";

  const todayYmd = new Date().toISOString().slice(0, 10);
  const rawDailyLimit = safeMoney(accountStore.debitDailyLimit, DEFAULT_DEBIT_DAILY_LIMIT);
  const dailyLimit = rawDailyLimit > 0 ? rawDailyLimit : DEFAULT_DEBIT_DAILY_LIMIT;
  const todayDebitSpent = sumDebitTapPaySpendForDay(transactions, currentUser?.id ?? "", todayYmd);
  const remainingDaily = remainingDebitDailyLimit(dailyLimit, todayDebitSpent);
  const availableDebit = availableDebitSpending(accountStore.mainBalance, dailyLimit, todayDebitSpent);
  const dailyPct = Math.round(dailyDebitProgressPercent(dailyLimit, todayDebitSpent));

  const billing = computeCreditBillingWindow();
  const flexiAvailable = Math.max(
    0,
    Math.round((accountStore.flexiLimit - accountStore.flexiUsed) * 100) / 100
  );
  const creditUsed = Math.max(0, Math.round(accountStore.flexiUsed * 100) / 100);
  const repaymentDueCredit = creditUsed;
  const minPaymentCredit = computeCreditMinPayment(repaymentDueCredit);
  const flexiUsePctRounded = Math.round(creditUsagePercent(creditUsed, accountStore.flexiLimit));

  // ── Countdown for Credit warning ──
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (payStep === "flexiWarning") setCountdown(10);
  }, [payStep]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (payStep !== "flexiWarning" || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [payStep, countdown]);

  // ── Auto-focus PIN input ──
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (payStep !== "passcode") return;
    const t = setTimeout(() => payPinRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [payStep]);

  // ── Handlers: card reveal ──
  const handleEyePress = () => {
    if (numVisible) {
      isDebit ? setDebitVisible(false) : setFlexiVisible(false);
    } else {
      setRevealPin(""); setRevealError("");
      setShowRevealModal(true);
    }
  };
  const handleRevealConfirm = async () => {
    const block = sensitiveActionBlockedMessage();
    if (block) {
      setRevealError(block);
      return;
    }
    const v = await verifyUserPin(revealPin);
    if (!v.ok) {
      setRevealError(v.message ?? "Incorrect PIN.");
      setRevealPin("");
      return;
    }
    isDebit ? setDebitVisible(true) : setFlexiVisible(true);
    setShowRevealModal(false);
    setRevealPin("");
    setRevealError("");
  };

  // ── Handlers: payment simulation ──
  const handleSimulatePayment = () => {
    const block = sensitiveActionBlockedMessage();
    if (block) {
      setPayError(block);
      setPayStep("error");
      return;
    }
    const txn = generateMockTransaction();
    setGeneratedTxn(txn);
    setPayPin(""); setPayError("");
    setPaySourceOverride(null);
    setNudgeVisible(false);
    setNudgeContext(null);
    setNudgeEvaluation(null);
    setNudgeMessage("");
    setPayFrictionBusy(false);

    // Hard validation first: impossible payments must be blocked early (before PIN).
    if (isDebit) {
      const dchk = debitTapPayValidation(txn.amount, accountStore.mainBalance, dailyLimit, todayDebitSpent);
      if (!dchk.ok) {
        setPayError(dchk.message);
        setPayStep("error");
        return;
      }
    } else if (txn.amount > flexiAvailable) {
      setPayError("This exceeds your available credit.");
      setPayStep("error");
      return;
    }

    // Upfront control check
    if (controls.frozen) {
      setPayError("Your card is frozen. Unfreeze it in Card Controls to make payments.");
      setPayStep("error"); return;
    }
    if (txn.paymentType === "online" && !controls.onlinePayment) {
      setPayError("Online Payments are disabled. Enable this in Card Controls to proceed.");
      setPayStep("error"); return;
    }
    if (txn.paymentType === "contactless" && !controls.contactless) {
      setPayError("Contactless Payments are disabled. Enable this in Card Controls to proceed.");
      setPayStep("error"); return;
    }
    if (txn.paymentType === "overseas" && !controls.overseasPayment) {
      setPayError("Overseas Payments are disabled. Enable this in Card Controls to proceed.");
      setPayStep("error"); return;
    }

    setPayStep("confirm");
  };

  const handleProceedFromConfirm = () => {
    if (isDebit) {
      void runCardNudgeCheck();
    } else {
      setPayStep("flexiWarning");
    }
  };

  const buildCardRiskContext = () => {
    if (!generatedTxn) return null;
    return buildRiskContext({
      actionType: isDebit ? "card_payment" : "flexicard_payment",
      amount: generatedTxn.amount,
      paymentMethod: "gx_card",
      cardType: isDebit ? "debit" : "flexicard",
      merchant: generatedTxn.merchant,
      category: generatedTxn.category,
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
      emergencyPocketBalance: savingsBuckets.emergency,
      flexiCreditBorrowingOutstanding: fc.outstanding,
      flexiCreditMonthlyRepayment: fc.monthlyRepayment,
      bonusPocketBalance: savingsBuckets.bonus,
      goalsPocketBalance: savingsBuckets.goals,
      gxHealthFactorScores: Object.fromEntries(healthReport.factors.map((f) => [f.key, f.score])) as Record<
        string,
        number
      >,
    });
  };

  const runCardNudgeCheck = async () => {
    if (payFrictionBusy) return;
    const context = buildCardRiskContext();
    if (!context) return;
    const evaluation = evaluateNudgeRisk(context);
    setNudgeContext(context);
    setNudgeEvaluation(evaluation);

    // Credit flow already shows Future Money warning. For medium risk, allow passcode directly.
    if (!isDebit && evaluation.riskLevel === "medium") {
      setPayStep("passcode");
      return;
    }
    if (!evaluation.requiresSoftFriction) {
      setPayStep("passcode");
      return;
    }

    setPayFrictionBusy(true);
    try {
      const message = await generateAiNudge(context, evaluation);
      // Keep nudge above sheet on native by hiding the underlying sheet first.
      setPayStep("idle");
      setNudgeMessage(message);
      setNudgeVisible(true);
    } finally {
      setPayFrictionBusy(false);
    }
  };

  const handleSaveInstead = () => {
    if (!generatedTxn) return;
    const isoNow = new Date().toISOString();
    const saveAmt = Math.min(generatedTxn.amount, accountStore.mainBalance);
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
      id: `manual-save-card-${Date.now()}`,
      label: "Saved instead of card payment",
      pocket: "Goals",
      type: "manual",
      amount: saveAmt,
      date: "2026-05-08",
    });
    addNotification({
      id: `notif-card-save-instead-${Date.now()}`,
      title: "Save Instead completed",
      message: `${formatRM(saveAmt)} moved to Goals instead of TapPay.`,
      time: "8 May 2026 · Now",
      read: false,
      type: "insight",
    });
    addActivity({
      id: `act-save-instead-card-${Date.now()}`,
      type: "save_instead",
      title: "Save Instead",
      description: "Saved instead of card payment",
      amount: saveAmt,
      direction: "credit",
      timestamp: isoNow,
      route: "/savings",
    });
    setNudgeVisible(false);
    handleClosePayment();
  };

  const handleNudgeDecision = (decision: NudgeDecision) => {
    if (decision === "continue") {
      setNudgeVisible(false);
      setPayStep("passcode");
      return;
    }
    if (decision === "use_debit_instead" && generatedTxn) {
      const dchk = debitTapPayValidation(
        generatedTxn.amount,
        accountStore.mainBalance,
        dailyLimit,
        todayDebitSpent
      );
      if (!dchk.ok) {
        setNudgeVisible(false);
        return;
      }
      // Functional switch: route this in-flight payment to Debit source.
      setPaySourceOverride("debit");
      setNudgeVisible(false);
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
      setPayStep("idle");
      setGeneratedTxn(null);
      setPayPin("");
      setPayError("");
      setPaySourceOverride(null);
      return;
    }
    if (decision === "cancel") {
      setNudgeVisible(false);
      handleClosePayment();
      return;
    }
    setNudgeVisible(false);
  };

  const handleConfirmPayment = async () => {
    const now = new Date();
    const isoNow = now.toISOString();
    const dateOnly = isoNow.slice(0, 10);
    const timeLabel = now.toTimeString().slice(0, 5);
    if (!generatedTxn) return;
    if (payPin.length < 6) return;
    const source: CardType = paySourceOverride ?? selectedCard;
    const sourceIsDebit = source === "debit";
    const sourceControls = sourceIsDebit ? debitControls : flexiControls;

    const block = sensitiveActionBlockedMessage();
    if (block) {
      setPayError(block);
      setPayPin("");
      return;
    }
    const pv = await verifyUserPin(payPin);
    if (!pv.ok) {
      setPayError(pv.message ?? "Incorrect PIN.");
      setPayPin("");
      return;
    }

    // Re-check controls
    if (sourceControls.frozen) {
      setPayError("Your card was frozen during this session. Please unfreeze and try again.");
      setPayStep("error"); return;
    }

    if (sourceIsDebit) {
      const dchk = debitTapPayValidation(
        generatedTxn.amount,
        accountStore.mainBalance,
        dailyLimit,
        todayDebitSpent
      );
      if (!dchk.ok) {
        setPayError(dchk.message);
        setPayPin("");
        return;
      }
    } else if (generatedTxn.amount > flexiAvailable) {
      setPayError("This exceeds your available credit.");
      setPayPin("");
      return;
    }

    // Process payment
    const result = sourceIsDebit
      ? accountStore.debitPay(generatedTxn.amount)
      : accountStore.flexiPay(generatedTxn.amount);

    if (!result.ok) {
      const msg = sourceIsDebit
        ? result.reason === "insufficient_balance"
          ? "Insufficient Main Account balance."
          : "Could not complete this payment."
        : result.reason === "insufficient_limit"
          ? "This exceeds your available credit."
          : "Could not complete this payment.";
      setPayError(msg);
      setPayStep("error");
      return;
    }

    // Create transaction record
    const risk = nudgeEvaluation?.riskLevel ?? "low";
    const newTxn: Transaction = {
      id:              `t-sim-${Date.now()}`,
      userId:          currentUser?.id ?? "",
      merchant:        generatedTxn.merchant,
      category:        generatedTxn.category,
      amount:          generatedTxn.amount,
      type:            "expense",
      paymentMethod:   "gx_card",
      transactionDate: dateOnly,
      riskLevel:       risk,
      isSuspicious:    false,
      note:            sourceIsDebit ? "Debit card payment" : "Credit payment (future money)",
      sourceAction:    "tappay",
      tapPaySource:    sourceIsDebit ? "debit" : "flexicard",
      occurredAt:      isoNow,
    };
    addTransaction(newTxn);

    // Add notification (read store after pay so balances are current)
    const acctAfter = useAccountStore.getState();
    const updatedAvailable = sourceIsDebit
      ? acctAfter.mainBalance
      : Math.max(0, Math.round((acctAfter.flexiLimit - acctAfter.flexiUsed) * 100) / 100);
    addNotification({
      id:    `notif-pay-${Date.now()}`,
      title: sourceIsDebit ? "Debit Card payment successful" : "Credit payment completed",
      message: sourceIsDebit
        ? `RM${generatedTxn.amount.toFixed(2)} paid to ${generatedTxn.merchant}. Main account: ${formatRM(updatedAvailable)}.`
        : `RM${generatedTxn.amount.toFixed(2)} paid to ${generatedTxn.merchant} using Credit (future money). Available credit: ${formatRM(updatedAvailable)}.`,
      time:  `${dateOnly} · ${timeLabel}`,
      read:  false,
      type:  sourceIsDebit ? "info" : "alert",
    });
    addActivity({
      id: `act-tappay-${Date.now()}`,
      type: "tappay",
      title: "TapPay",
      description: generatedTxn.merchant,
      amount: generatedTxn.amount,
      direction: "debit",
      timestamp: isoNow,
      route: "/transactions",
    });
    if (nudgeEvaluation?.shouldCreateNotification && risk !== "low") {
      addNotification({
        id: `notif-card-risk-${Date.now()}`,
        title: risk === "critical" ? "Critical TapPay warning" : "High-risk TapPay warning",
        message: `SmartGX AI flagged this TapPay as ${risk} risk before completion.`,
        time: `${dateOnly} · ${timeLabel}`,
        read: false,
        type: "risk",
      });
    }

    if (sourceIsDebit) {
      const roundUpCandidate = Math.round((Math.ceil(generatedTxn.amount) - generatedTxn.amount) * 100) / 100;
      if (roundUpCandidate > 0 && accountStore.mainBalance >= roundUpCandidate) {
        const roundUpDebit = accountStore.debitPay(roundUpCandidate);
        if (roundUpDebit.ok) {
          const roundUpResult = applyRoundUp(generatedTxn.amount);
          if (roundUpResult.ok && roundUpResult.saved > 0) {
            addManualActivity({
              id: `roundup-card-${Date.now()}`,
              label: "Round-up from card payment",
              pocket: roundUpPocketLabel,
              type: "roundup",
              amount: roundUpResult.saved,
              date: dateOnly,
              occurredAt: isoNow,
            });
            addActivity({
              id: `act-roundup-card-${Date.now()}`,
              type: "round_up_saving",
              title: "Round-up Saving",
              description: "Round-up from card payment",
              amount: roundUpResult.saved,
              direction: "credit",
              timestamp: isoNow,
              route: "/savings",
            });
          }
        }
      }
    }

    setPayStep("success");
  };

  const handleClosePayment = () => {
    setPayStep("idle");
    setGeneratedTxn(null);
    setPayPin(""); setPayError("");
    setCountdown(10);
    setPaySourceOverride(null);
    setNudgeVisible(false);
    setNudgeContext(null);
    setNudgeEvaluation(null);
    setNudgeMessage("");
    setPayFrictionBusy(false);
  };

  // ── Payment step renders ──
  const renderConfirmStep = () => {
    if (!generatedTxn) return null;
    const confirmNow = new Date();
    const confirmDateLabel = confirmNow.toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const ptLabel = generatedTxn.paymentType === "contactless"
      ? "Contactless" : generatedTxn.paymentType === "overseas" ? "Overseas" : "Online";
    const cardLabel = isDebit
      ? `Debit Card ••••${DEBIT_META.lastFour}`
      : `Credit ••••${FLEXI_META.lastFour}`;
    return (
      <View style={pay.step}>
        <Text style={pay.stepTitle}>TapPay</Text>

        <View style={pay.merchantBlock}>
          <Text style={pay.merchantEmoji}>{CAT_EMOJI[generatedTxn.category] ?? "💳"}</Text>
          <Text style={pay.merchantName}>{generatedTxn.merchant}</Text>
          <Text style={pay.merchantMeta}>
            {CAT_LABEL[generatedTxn.category]} · {ptLabel}
          </Text>
        </View>

        <Text style={pay.amount}>{formatRM(generatedTxn.amount)}</Text>

        <View style={pay.detailsBox}>
          <View style={pay.detailRow}>
            <Text style={pay.detailKey}>Card</Text>
            <Text style={pay.detailVal}>{cardLabel}</Text>
          </View>
          <View style={pay.detailRow}>
            <Text style={pay.detailKey}>Date</Text>
            <Text style={pay.detailVal}>
              {confirmDateLabel} · {generatedTxn.transactionTime}
            </Text>
          </View>
          {isDebit && (
            <View style={pay.detailRow}>
              <Text style={pay.detailKey}>After payment</Text>
              <Text style={[pay.detailVal, { color: "#22C55E" }]}>
                {formatRM(accountStore.mainBalance - generatedTxn.amount)} remaining
              </Text>
            </View>
          )}
          {!isDebit && (
            <View style={pay.detailRow}>
              <Text style={pay.detailKey}>Limit after</Text>
              <Text style={[pay.detailVal, { color: "#7DD3FC" }]}>
                {formatRM(flexiAvailable - generatedTxn.amount)} remaining
              </Text>
            </View>
          )}
        </View>

        <Pressable
          style={[pay.primaryBtnFull, payFrictionBusy && pay.btnDisabled]}
          onPress={() => {
            handleProceedFromConfirm();
          }}
          disabled={payFrictionBusy}
          hitSlop={8}
        >
          {payFrictionBusy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={pay.primaryBtnText}>
              {isDebit ? "Continue to Pay →" : "Use Credit →"}
            </Text>
          )}
        </Pressable>
      </View>
    );
  };

  const renderFlexiWarningStep = () => {
    if (!generatedTxn) return null;
    const canProceed = countdown <= 0;
    return (
      <View style={pay.step}>
        {/* Warning icon */}
        <View style={pay.warningIconWrap}>
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path d="M10.29 3.86L1.82 18C1.17 19.1 1.97 20.5 3.24 20.5H20.76C22.03 20.5 22.83 19.1 22.18 18L13.71 3.86C13.07 2.77 10.93 2.77 10.29 3.86Z" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M12 9V13M12 17H12.01" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
          </Svg>
        </View>

        <Text style={pay.warningTitle}>Future Money Notice</Text>
        <Text style={pay.warningBody}>
          You are about to use future money via Credit. SmartGX recommends using your Debit Card if your current balance is sufficient.
        </Text>
        <Text style={pay.warningSubtext}>
          Credit spending increases your debt-risk indicator and may lower your GXHealth score.
        </Text>

        <View style={pay.flexiLimitBox}>
          <Text style={pay.flexiLimitLabel}>Available credit</Text>
          <Text style={pay.flexiLimitValue}>{formatRM(flexiAvailable)}</Text>
        </View>

        {/* Countdown */}
        <View style={pay.countdownWrap}>
          {countdown > 0 ? (
            <Text style={pay.countdownText}>
              Read carefully. Confirming in{" "}
              <Text style={pay.countdownNum}>{countdown}s</Text>
            </Text>
          ) : (
            <Text style={[pay.countdownText, { color: "#A78BFA" }]}>
              You may now proceed with Credit.
            </Text>
          )}
          <View style={pay.countdownBarTrack}>
            <View
              style={[
                pay.countdownBarFill,
                { width: `${((10 - countdown) / 10) * 100}%` as never },
              ]}
            />
          </View>
        </View>

        <Pressable
          style={[pay.primaryBtnFull, (!canProceed || payFrictionBusy) && pay.btnDisabled]}
          onPress={() => {
            if (canProceed && !payFrictionBusy) void runCardNudgeCheck();
          }}
          disabled={!canProceed || payFrictionBusy}
          hitSlop={8}
        >
          {payFrictionBusy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[pay.primaryBtnText, !canProceed && { opacity: 0.4 }]}>
              {canProceed ? "Continue with Credit →" : `Wait ${countdown}s`}
            </Text>
          )}
        </Pressable>
      </View>
    );
  };

  const renderPasscodeStep = () => {
    if (!generatedTxn) return null;
    return (
      <View style={pay.step}>
        <Text style={pay.stepTitle}>Enter Payment PIN</Text>

        <View style={pay.passcodeSummary}>
          <Text style={pay.passcodeMerchant}>{generatedTxn.merchant}</Text>
          <Text style={pay.passcodeAmount}>{formatRM(generatedTxn.amount)}</Text>
        </View>

        <Text style={pay.passcodeLabel}>6-digit PIN</Text>

        {/* Dot indicators */}
        <Pressable
          style={pay.dotRow}
          onPress={() => payPinRef.current?.focus()}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <View
              key={i}
              style={[pay.dot, i < payPin.length ? pay.dotFilled : pay.dotEmpty]}
            />
          ))}
        </Pressable>

        {/* Hidden TextInput */}
        <TextInput
          ref={payPinRef}
          style={pay.hiddenInput}
          value={payPin}
          onChangeText={(v) => { setPayPin(v.replace(/[^0-9]/g, "")); setPayError(""); }}
          keyboardType="number-pad"
          maxLength={6}
          caretHidden
        />

        {payError ? <Text style={pay.pinError}>{payError}</Text> : null}

        <View style={pay.btnRow}>
          <Pressable style={pay.cancelBtn} onPress={handleClosePayment}>
            <Text style={pay.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[pay.primaryBtn, payPin.length < 6 && pay.btnDisabled]}
            onPress={handleConfirmPayment}
            hitSlop={8}
          >
            <Text style={[pay.primaryBtnText, payPin.length < 6 && { opacity: 0.4 }]}>
              Confirm Payment
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderSuccessStep = () => {
    if (!generatedTxn) return null;
    const paidByDebit = (paySourceOverride ?? selectedCard) === "debit";
    const acct = useAccountStore.getState();
    const updatedLabel = paidByDebit
      ? `Main account: ${formatRM(acct.mainBalance)}`
      : `Available credit: ${formatRM(Math.max(0, Math.round((acct.flexiLimit - acct.flexiUsed) * 100) / 100))}`;
    const successNow = new Date();
    const successDateLabel = successNow.toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return (
      <View style={[pay.step, pay.stepCentered]}>
        <View style={pay.successIconWrap}>
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" fill="rgba(34,197,94,0.15)" stroke="#22C55E" strokeWidth="1.5" />
            <Path d="M8 12L11 15L16 9" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text style={pay.successTitle}>
          {paidByDebit ? "TapPay Successful" : "Credit TapPay Completed"}
        </Text>
        <Text style={pay.successMerchant}>{generatedTxn.merchant}</Text>
        <Text style={pay.successAmount}>{formatRM(generatedTxn.amount)}</Text>
        <Text style={pay.successCardLine}>
          {paidByDebit ? "Debit Card" : "Credit"} · {successDateLabel} · {generatedTxn.transactionTime}
        </Text>
        <View style={pay.successBalancePill}>
          <Text style={pay.successBalanceText}>{updatedLabel}</Text>
        </View>
        {!paidByDebit && (
          <Text style={pay.flexiCompletedNote}>
            This payment used future money. Review your credit balance in the card overview.
          </Text>
        )}
        <Pressable style={[pay.primaryBtn, { marginTop: spacing.md, alignSelf: "stretch", flex: 0 }]} onPress={handleClosePayment}>
          <Text style={pay.primaryBtnText}>Done</Text>
        </Pressable>
      </View>
    );
  };

  const renderErrorStep = () => (
    <View style={[pay.step, pay.stepCentered]}>
      <View style={pay.errorIconWrap}>
        <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="10" fill="rgba(239,68,68,0.15)" stroke="#EF4444" strokeWidth="1.5" />
          <Path d="M15 9L9 15M9 9L15 15" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" />
        </Svg>
      </View>
      <Text style={pay.errorTitle}>Payment Blocked</Text>
      <Text style={pay.errorMsg}>{payError}</Text>
      <Pressable style={[pay.cancelBtn, { marginTop: spacing.md, width: "100%" }]} onPress={handleClosePayment}>
        <Text style={pay.cancelBtnText}>Close</Text>
      </Pressable>
    </View>
  );

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
          summaryLabel={isDebit ? "Debit TapPay" : "Credit TapPay"}
          evaluation={nudgeEvaluation}
          riskContext={nudgeContext}
          showUseDebitInstead={!isDebit && nudgeEvaluation.recommendUseDebitInstead}
          onDecision={handleNudgeDecision}
        />
      )}

      {/* ── Card reveal modal ── */}
      <Modal
        visible={showRevealModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        hardwareAccelerated
        onRequestClose={() => setShowRevealModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Verify Identity</Text>
            <Text style={styles.modalSub}>Enter your 6-digit SmartGX PIN to reveal the card number</Text>
            <TextInput
              style={styles.pinInput}
              value={revealPin}
              onChangeText={(t) => { setRevealPin(t.replace(/\D/g, "").slice(0, 6)); setRevealError(""); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="••••••"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            {revealError ? <Text style={styles.pinError}>{revealError}</Text> : null}
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalBtnCancel} onPress={() => { setShowRevealModal(false); setRevealPin(""); setRevealError(""); }}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtnPrimary, revealPin.length < 6 && { opacity: 0.45 }]}
                onPress={handleRevealConfirm}
                disabled={revealPin.length < 6}
              >
                <Text style={styles.modalBtnPrimaryText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Payment bottom sheet (confirm / warning / success / error) ── */}
      <Modal
        visible={payStep === "confirm" || payStep === "flexiWarning" || payStep === "success" || payStep === "error"}
        transparent
        animationType="slide"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        hardwareAccelerated
        supportedOrientations={["portrait", "landscape"]}
        onRequestClose={handleClosePayment}
      >
        <Pressable
          style={pay.overlay}
          onPress={() => {
            if (payStep === "confirm" || payStep === "flexiWarning") handleClosePayment();
          }}
        >
          <Pressable style={pay.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={pay.sheetHandle} />
            {payStep === "confirm"      && renderConfirmStep()}
            {payStep === "flexiWarning" && renderFlexiWarningStep()}
            {payStep === "success"      && renderSuccessStep()}
            {payStep === "error"        && renderErrorStep()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Passcode modal (centered, so keyboard doesn't cover it) ── */}
      <Modal
        visible={payStep === "passcode"}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        hardwareAccelerated
        supportedOrientations={["portrait", "landscape"]}
        onRequestClose={handleClosePayment}
      >
        <View style={pay.overlayCenter}>
          <View style={pay.sheetCenter}>
            {renderPasscodeStep()}
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Gradient header (matches Saving & Automation style) ── */}
        <LinearGradient
          colors={["#3B1578", "#2D0D6B", "#1A0845", "#070B14"]}
          locations={[0, 0.4, 0.75, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.hero}
        >
          <Pressable style={styles.backBtn} onPress={() => router.push("/dashboard" as never)}>
            <ChevronLeft c="#FFFFFF" />
          </Pressable>
          <Text style={styles.heroTitle}>My Card</Text>
          <Text style={styles.heroSub}>Manage your cards and payments</Text>

          {/* ── Card selector tabs inside hero ── */}
          <View style={styles.cardSelector}>
            {(["debit", "flexicard"] as CardType[]).map((ct) => (
              <Pressable key={ct} style={[styles.cardTab, selectedCard === ct && styles.cardTabActive]} onPress={() => setSelectedCard(ct)}>
                <Text style={[styles.cardTabText, selectedCard === ct && styles.cardTabTextActive]}>
                  {ct === "debit" ? "Debit Card" : "Credit"}
                </Text>
              </Pressable>
            ))}
          </View>
        </LinearGradient>

        {/* ── Card visual ── */}
        {isDebit
          ? <DebitCardVisual numberVisible={debitVisible} onEyePress={handleEyePress} />
          : <FlexiCardVisual numberVisible={flexiVisible} onEyePress={handleEyePress} />
        }

        {/* ── Card status ── */}
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { backgroundColor: controls.frozen ? "rgba(147,197,253,0.12)" : "rgba(34,197,94,0.12)", borderColor: controls.frozen ? "#93C5FD55" : "#22C55E55" }]}>
            <View style={[styles.statusDot, { backgroundColor: controls.frozen ? "#93C5FD" : "#22C55E" }]} />
            <Text style={[styles.statusText, { color: controls.frozen ? "#93C5FD" : "#22C55E" }]}>
              {controls.frozen ? "Frozen" : "Active"}
            </Text>
          </View>
          <Text style={styles.statusHint}>
            {controls.frozen ? "All payments are blocked while frozen" : `${isDebit ? "Debit Card" : "Credit"} is ready for use`}
          </Text>
        </View>

        {/* ── TapPay button ── */}
        <Pressable style={styles.payBtn} onPress={handleSimulatePayment}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M2 8C2 6.9 2.9 6 4 6H20C21.1 6 22 6.9 22 8V16C22 17.1 21.1 18 20 18H4C2.9 18 2 17.1 2 16V8Z" stroke="#FFFFFF" strokeWidth="1.8" />
            <Path d="M15.5 12C15.5 13.38 14.38 14.5 13 14.5C11.62 14.5 10.5 13.38 10.5 12C10.5 10.62 11.62 9.5 13 9.5C14.38 9.5 15.5 10.62 15.5 12Z" stroke="#FFFFFF" strokeWidth="1.5" />
          </Svg>
          <Text style={styles.payBtnText}>TapPay</Text>
        </Pressable>

        {/* ── Spending limits (Debit) ── */}
        {isDebit && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Spending Limits</Text>
            <View style={{ gap: 8, marginBottom: spacing.sm }}>
              <View style={styles.debitSummaryRow}>
                <Text style={styles.flexiCellLabel}>Main account balance</Text>
                <Text style={styles.flexiCellValue}>{formatRM(accountStore.mainBalance)}</Text>
              </View>
              <View style={styles.debitSummaryRow}>
                <Text style={styles.flexiCellLabel}>Available debit spending</Text>
                <Text style={styles.flexiCellValue}>{formatRM(availableDebit)}</Text>
              </View>
              <View style={styles.debitSummaryRow}>
                <Text style={styles.flexiCellLabel}>Remaining daily limit</Text>
                <Text style={styles.flexiCellValue}>{formatRM(remainingDaily)}</Text>
              </View>
              <View style={styles.debitSummaryRow}>
                <Text style={styles.flexiCellLabel}>Spent today (debit TapPay)</Text>
                <Text style={styles.flexiCellValue}>{formatRM(todayDebitSpent)}</Text>
              </View>
            </View>
            <LimitBar label="Daily limit" spent={todayDebitSpent} limit={dailyLimit} pct={dailyPct} />
          </View>
        )}

        {/* ── Credit overview ── */}
        {!isDebit && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Credit Overview</Text>
            <View style={styles.flexiRow}>
              <View style={styles.flexiCell}><Text style={styles.flexiCellLabel}>Credit limit</Text><Text style={styles.flexiCellValue}>RM{accountStore.flexiLimit.toLocaleString()}</Text></View>
              <View style={styles.flexiCell}><Text style={styles.flexiCellLabel}>Credit used</Text><Text style={[styles.flexiCellValue, { color: "#F59E0B" }]}>RM{accountStore.flexiUsed.toLocaleString()}</Text></View>
              <View style={styles.flexiCell}><Text style={styles.flexiCellLabel}>Available credit</Text><Text style={[styles.flexiCellValue, { color: "#22C55E" }]}>{formatRM(flexiAvailable)}</Text></View>
            </View>
            <View style={styles.flexiBarTrack}>
              <View
                style={[
                  styles.flexiBarFill,
                  {
                    width: `${flexiUsePctRounded}%` as never,
                    backgroundColor: flexiUsePctRounded > 80 ? "#EF4444" : "#F59E0B",
                  },
                ]}
              />
            </View>
            <Text style={styles.flexiBarLabel}>{flexiUsePctRounded}% of credit limit used</Text>
            <Text style={[styles.flexiBarLabel, { marginBottom: 4 }]}>
              Cycle {formatBillingDateShort(billing.billingCycleStart)} – {formatBillingDateShort(billing.billingCycleEnd)}
              {" · "}Due {formatBillingDateShort(billing.paymentDueDate)}
            </Text>
            <View style={styles.repayRow}>
              <View style={styles.repayCell}>
                <Text style={styles.repayCellLabel}>Repayment due</Text>
                <Text style={styles.repayCellValue}>{formatRM(repaymentDueCredit)}</Text>
              </View>
              <View style={styles.repayCell}>
                <Text style={styles.repayCellLabel}>Min. payment</Text>
                <Text style={styles.repayCellValue}>
                  {repaymentDueCredit <= 0 ? formatRM(0) : formatRM(minPaymentCredit)}
                </Text>
              </View>
              <View style={styles.repayCell}>
                <Text style={styles.repayCellLabel}>Payment status</Text>
                <Text style={styles.repayCellValue}>
                  {repaymentDueCredit <= 0 ? "No payment due" : formatBillingDateShort(billing.paymentDueDate)}
                </Text>
              </View>
            </View>
            <View style={styles.flexiNote}><Text style={styles.flexiNoteText}>Credit is a flexible spending facility. Repay by the due date to protect your GXHealth score.</Text></View>
          </View>
        )}

        {/* ── Card controls ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Card Controls</Text>
          <ToggleRow label="Freeze Card" sublabel={controls.frozen ? "Tap to unfreeze" : "Block all transactions"} enabled={controls.frozen} onToggle={() => {
            const next = !controls.frozen;
            updateCtrl({ frozen: next });
            addActivity({ id: `act-card-control-${Date.now()}`, type: "card_control", title: "Card Control", description: `Freeze ${next ? "enabled" : "disabled"}`, timestamp: new Date().toISOString(), route: "/card" });
          }} icon={<SnowflakeIcon size={18} color={controls.frozen ? "#93C5FD" : colors.textMuted} />} />
          <ToggleRow label="Online Payments" sublabel={controls.frozen ? "Unavailable while frozen" : "Allow web and app purchases"} enabled={controls.onlinePayment && !controls.frozen} onToggle={() => { if (!controls.frozen) { const next = !controls.onlinePayment; updateCtrl({ onlinePayment: next }); addActivity({ id: `act-card-control-${Date.now()}`, type: "card_control", title: "Card Control", description: `Online payments ${next ? "enabled" : "disabled"}`, timestamp: new Date().toISOString(), route: "/card" }); } }} icon={<WifiIcon size={18} color={controls.onlinePayment && !controls.frozen ? "#A78BFA" : colors.textMuted} />} />
          <ToggleRow label="Overseas Payments" sublabel={controls.frozen ? "Unavailable while frozen" : "Allow transactions outside Malaysia"} enabled={controls.overseasPayment && !controls.frozen} onToggle={() => { if (!controls.frozen) { const next = !controls.overseasPayment; updateCtrl({ overseasPayment: next }); addActivity({ id: `act-card-control-${Date.now()}`, type: "card_control", title: "Card Control", description: `Overseas payments ${next ? "enabled" : "disabled"}`, timestamp: new Date().toISOString(), route: "/card" }); } }} icon={<GlobeIcon size={18} color={controls.overseasPayment && !controls.frozen ? "#A78BFA" : colors.textMuted} />} />
          <View style={[tg.row, { borderBottomWidth: 0 }]}>
            <View style={tg.iconWrap}><NfcIcon size={18} color={controls.contactless && !controls.frozen ? "#A78BFA" : colors.textMuted} /></View>
            <View style={tg.body}><Text style={tg.label}>Contactless Payments</Text><Text style={tg.sub}>{controls.frozen ? "Unavailable while frozen" : "Allow NFC tap-to-pay"}</Text></View>
            <Pressable style={[tg.track, controls.contactless && !controls.frozen ? tg.trackOn : tg.trackOff]} onPress={() => { if (!controls.frozen) { const next = !controls.contactless; updateCtrl({ contactless: next }); addActivity({ id: `act-card-control-${Date.now()}`, type: "card_control", title: "Card Control", description: `Contactless ${next ? "enabled" : "disabled"}`, timestamp: new Date().toISOString(), route: "/card" }); } }}>
              <View style={[tg.knob, controls.contactless && !controls.frozen ? tg.knobOn : tg.knobOff]} />
            </Pressable>
          </View>
        </View>

        {/* ── Transaction link ── */}
        <Pressable style={styles.txnLink} onPress={() => router.push("/transactions" as never)}>
          <View style={styles.txnLinkBody}>
            <Text style={styles.txnLinkTitle}>Transaction History</Text>
            <Text style={styles.txnLinkSub}>View spending records and analysis</Text>
          </View>
          <ChevronRight />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Limit bar ───────────────────────────────────────────────────── */
function LimitBar({ label, spent, limit, pct }: { label: string; spent: number; limit: number; pct: number }) {
  const bc = pct > 85 ? "#EF4444" : "#7C3AED";
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ gap: 2 }}>
          <Text style={{ color: colors.textMuted, fontSize: typography.caption }}>{label}</Text>
          <Text style={{ color: "#FFFFFF", fontSize: typography.body, fontWeight: "800" }}>
            {formatRM(spent)} <Text style={{ color: colors.textMuted, fontWeight: "400" }}>/ {formatRM(limit)}</Text>
          </Text>
        </View>
        <Text style={{ color: pct > 85 ? "#EF4444" : "#A78BFA", fontSize: typography.caption, fontWeight: "800", alignSelf: "flex-end" }}>{pct}%</Text>
      </View>
      <View style={styles.limitTrack}>
        <View style={[styles.limitFill, { width: `${pct}%` as never, backgroundColor: bc }]} />
      </View>
    </View>
  );
}

/* ─── Payment sheet styles ────────────────────────────────────────── */
const pay = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end", pointerEvents: "auto" },
  overlayCenter: { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24, pointerEvents: "auto" },
  sheet:         { backgroundColor: "#0C0920", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: "rgba(167,139,250,0.2)", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 16, zIndex: 20, elevation: 20, pointerEvents: "auto" },
  sheetCenter:   { width: "100%", backgroundColor: "#0C0920", borderRadius: 20, borderWidth: 1, borderColor: "rgba(167,139,250,0.25)", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28, gap: 16, zIndex: 30, elevation: 30, pointerEvents: "auto" },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "center", marginBottom: 8 },
  step:         { gap: 14 },
  stepCentered: { alignItems: "center" },
  stepTitle:    { color: "#FFFFFF", fontSize: 18, fontWeight: "800", textAlign: "center" },

  merchantBlock:  { alignItems: "center", gap: 4 },
  merchantEmoji:  { fontSize: 36, marginBottom: 4 },
  merchantName:   { color: "#FFFFFF", fontSize: 20, fontWeight: "800", textAlign: "center" },
  merchantMeta:   { color: colors.textMuted, fontSize: typography.body, textAlign: "center" },
  amount:         { color: "#FFFFFF", fontSize: 38, fontWeight: "800", letterSpacing: -1, textAlign: "center" },

  detailsBox:   { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  detailRow:    { flexDirection: "row", justifyContent: "space-between" },
  detailKey:    { color: colors.textMuted, fontSize: typography.caption },
  detailVal:    { color: "#FFFFFF", fontSize: typography.caption, fontWeight: "600" },

  btnRow:       { flexDirection: "row", gap: 10 },
  cancelBtn:    { flex: 1, minHeight: 48, paddingVertical: 13, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  cancelBtnText:{ color: colors.textMuted, fontSize: typography.body, fontWeight: "600" },
  primaryBtn:   { flex: 1, minHeight: 48, paddingVertical: 13, borderRadius: 12, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" },
  primaryBtnFull: { width: "100%", minHeight: 50, paddingVertical: 13, borderRadius: 12, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center", marginTop: 2 },
  primaryBtnText:{ color: "#FFFFFF", fontSize: typography.body, fontWeight: "700" },
  btnDisabled:  { backgroundColor: "rgba(124,58,237,0.35)" },

  // FlexiWarning
  warningIconWrap:{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "rgba(245,158,11,0.25)", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  warningTitle:   { color: "#FFFFFF", fontSize: 18, fontWeight: "800", textAlign: "center" },
  warningBody:    { color: colors.textSecondary, fontSize: typography.body, lineHeight: 22, textAlign: "center" },
  warningSubtext: { color: "#F59E0B", fontSize: typography.caption, lineHeight: 18, textAlign: "center" },
  flexiLimitBox:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(56,189,248,0.07)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(56,189,248,0.15)", padding: 12 },
  flexiLimitLabel:{ color: colors.textMuted, fontSize: typography.caption },
  flexiLimitValue:{ color: "#7DD3FC", fontSize: typography.body, fontWeight: "800" },
  countdownWrap:  { gap: 8 },
  countdownText:  { color: colors.textMuted, fontSize: typography.caption, textAlign: "center" },
  countdownNum:   { color: "#F59E0B", fontWeight: "800" },
  countdownBarTrack:{ height: 4, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" },
  countdownBarFill: { height: "100%", borderRadius: 2, backgroundColor: "#7C3AED" },

  // Passcode
  passcodeSummary:{ alignItems: "center", gap: 2 },
  passcodeMerchant:{ color: colors.textMuted, fontSize: typography.body },
  passcodeAmount: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  passcodeLabel:  { color: colors.textMuted, fontSize: typography.caption, textAlign: "center" },
  dotRow:         { flexDirection: "row", gap: 12, justifyContent: "center", paddingVertical: 8 },
  dot:            { width: 16, height: 16, borderRadius: 8 },
  dotEmpty:       { backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1.5, borderColor: "rgba(167,139,250,0.25)" },
  dotFilled:      { backgroundColor: "#7C3AED" },
  hiddenInput:    { position: "absolute", opacity: 0, width: 1, height: 1, top: 0, left: 0 },
  pinError:       { color: "#EF4444", fontSize: typography.caption, textAlign: "center" },
  pinHint:        { color: colors.textMuted, fontSize: 11, textAlign: "center" },

  // Success
  successIconWrap:  { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(34,197,94,0.12)", borderWidth: 1, borderColor: "rgba(34,197,94,0.25)", alignItems: "center", justifyContent: "center" },
  successTitle:     { color: "#FFFFFF", fontSize: 18, fontWeight: "800", textAlign: "center" },
  successMerchant:  { color: colors.textMuted, fontSize: typography.body, textAlign: "center" },
  successAmount:    { color: "#22C55E", fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  successCardLine:  { color: colors.textMuted, fontSize: typography.caption, textAlign: "center" },
  successBalancePill:{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "rgba(34,197,94,0.1)", borderWidth: 1, borderColor: "rgba(34,197,94,0.25)" },
  successBalanceText:{ color: "#22C55E", fontSize: typography.caption, fontWeight: "700", textAlign: "center" },
  flexiCompletedNote:{ color: "#7DD3FC", fontSize: 11, textAlign: "center", lineHeight: 17 },

  // Error
  errorIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(239,68,68,0.12)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", alignItems: "center", justifyContent: "center" },
  errorTitle:    { color: "#FFFFFF", fontSize: 18, fontWeight: "800", textAlign: "center" },
  errorMsg:      { color: colors.textSecondary, fontSize: typography.body, lineHeight: 22, textAlign: "center" },
});

/* ─── Main styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48, gap: 16 },

  hero: {
    marginHorizontal: -16,
    marginTop: -12,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  heroTitle:     { color: "#FFFFFF", fontSize: typography.title, fontWeight: "800", letterSpacing: -0.3 },
  heroSub:       { color: "#C4B5FD", fontSize: typography.body, opacity: 0.8, marginBottom: 8 },
  backBtn:       { padding: spacing.xs, alignSelf: "flex-start", marginBottom: spacing.xs },
  headerTitle:   { color: "#FFFFFF", fontSize: typography.title, fontWeight: "800" },

  cardSelector:     { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: "rgba(167,139,250,0.2)", borderRadius: radius.md, padding: 3, gap: 3 },
  cardTab:          { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: radius.sm },
  cardTabActive:    { backgroundColor: "rgba(167,139,250,0.25)" },
  cardTabText:      { color: colors.textMuted, fontSize: typography.body, fontWeight: "700" },
  cardTabTextActive:{ color: "#A78BFA" },

  statusRow:  { flexDirection: "row", alignItems: "center", gap: 12 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
  statusDot:  { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: typography.caption, fontWeight: "700" },
  statusHint: { color: colors.textMuted, fontSize: typography.caption, flex: 1 },

  payBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 14 },
  payBtnText: { color: "#FFFFFF", fontSize: typography.body, fontWeight: "700", letterSpacing: 0.3 },

  sectionCard:    { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14 },
  sectionLabel:   { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },

  limitTrack: { height: 6, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" },
  limitFill:  { height: "100%", borderRadius: 3 },

  flexiRow:       { flexDirection: "row", gap: 8, marginBottom: 12 },
  flexiCell:      { flex: 1, gap: 3 },
  flexiCellLabel: { color: colors.textMuted, fontSize: 11 },
  flexiCellValue: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  flexiBarTrack:  { height: 6, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden", marginBottom: 4 },
  flexiBarFill:   { height: "100%", borderRadius: 3 },
  flexiBarLabel:  { color: colors.textMuted, fontSize: 11, marginBottom: 12 },
  repayRow:       { flexDirection: "row", gap: 8, marginTop: 4 },
  repayCell:      { flex: 1, gap: 3 },
  repayCellLabel: { color: colors.textMuted, fontSize: 11 },
  repayCellValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  flexiNote:      { marginTop: 10, padding: 10, backgroundColor: "rgba(245,158,11,0.07)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(245,158,11,0.15)" },
  flexiNoteText:  { color: "#D1A054", fontSize: 11, lineHeight: 17 },

  debitSummaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },

  txnLink:      { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, gap: 12 },
  txnLinkBody:  { flex: 1, gap: 3 },
  txnLinkTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: "700" },
  txnLinkSub:   { color: colors.textMuted, fontSize: typography.caption },

  modalOverlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", paddingHorizontal: 20, pointerEvents: "box-none" },
  modalBox:           { backgroundColor: "#1A0A3E", borderWidth: 1, borderColor: "rgba(167,139,250,0.25)", borderRadius: radius.lg, padding: 24, width: "100%", gap: 14, alignItems: "center", zIndex: 30, elevation: 30 },
  modalTitle:         { color: "#FFFFFF", fontSize: typography.title, fontWeight: "800" },
  modalSub:           { color: colors.textMuted, fontSize: typography.body, textAlign: "center", lineHeight: 20 },
  pinInput:           { width: 120, height: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: "rgba(167,139,250,0.35)", color: "#FFFFFF", fontSize: 24, fontWeight: "800", textAlign: "center", letterSpacing: 8 },
  pinError:           { color: "#EF4444", fontSize: typography.caption, textAlign: "center" },
  pinHint:            { color: colors.textMuted, fontSize: 11, textAlign: "center" },
  modalBtns:          { flexDirection: "row", gap: 10, width: "100%", marginTop: 4 },
  modalBtnPrimary:    { flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  modalBtnPrimaryText:{ color: "#FFFFFF", fontSize: typography.body, fontWeight: "700" },
  modalBtnCancel:     { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  modalBtnCancelText: { color: colors.textMuted, fontSize: typography.body, fontWeight: "600" },
});
