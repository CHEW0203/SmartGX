/**
 * Transfer — multi-channel banking-style transfer flow.
 * Channels: Bank Transfer | DuitNow | Recent/Contacts
 */
import { useEffect, useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Image,
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
import { useAccountStore } from "../src/store/accountStore";
import { useTransactionStore } from "../src/store/transactionStore";
import { useNotificationStore } from "../src/store/notificationStore";
import { useRecipientStore } from "../src/store/recipientStore";
import { useSavingsStore } from "../src/store/savingsStore";
import { useFlexiCreditStore } from "../src/store/flexiCreditStore";
import { useAuthStore } from "../src/store/authStore";
import { useActivityStore } from "../src/store/activityStore";
import type { StoredRecipient, DuitNowIdType } from "../src/store/recipientStore";
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

/* ─── Mock contacts (static, separate from Recent Recipients) ─────── */

interface Contact {
  id:     string;
  name:   string;
  mobile: string;
  avatar: string;
}

const MOCK_CONTACTS: Contact[] = [
  { id: "c1", name: "Aina Rahman",   mobile: "+6011-1234 5678", avatar: "A" },
  { id: "c2", name: "Jason Tan",     mobile: "+6012-3456 7890", avatar: "J" },
  { id: "c3", name: "Lee Wei Ming",  mobile: "+6016-8901 2345", avatar: "L" },
  { id: "c4", name: "Nur Iman",      mobile: "+6013-2345 6789", avatar: "N" },
  { id: "c5", name: "Daniel Wong",   mobile: "+6017-4567 8901", avatar: "D" },
];

const BANKS = ["Maybank", "CIMB", "Public Bank", "RHB Bank", "Hong Leong Bank", "AmBank", "Bank Islam", "BSN", "Alliance Bank"];

const DUITNOW_TYPES: { key: DuitNowIdType; label: string }[] = [
  { key: "mobile",   label: "Mobile Number" },
  { key: "nric",     label: "NRIC (MyKad)" },
  { key: "passport", label: "Passport" },
  { key: "army",     label: "MyTentera / Police ID" },
  { key: "business", label: "Business Registration No." },
];

const DUITNOW_PLACEHOLDERS: Record<DuitNowIdType, string> = {
  mobile:   "e.g. +60112345678",
  nric:     "e.g. 990101-01-1234",
  passport: "e.g. A12345678",
  army:     "e.g. 890901",
  business: "e.g. 123456-X",
};

const QUICK_AMOUNTS = [30, 50, 100, 200, 500];

type Step =
  | "channel"
  | "smartgxForm"
  | "bankForm"
  | "duitnowForm"
  | "resolvedRecipient"
  | "amount"
  | "confirm"
  | "passcode"
  | "success";

const MAX_REFERENCE_LEN = 50;

function normalizeDigits(v: string) {
  return v.replace(/\D/g, "");
}

function normalizeMobileInput(v: string) {
  const trimmed = v.replace(/\s+/g, "");
  const hasPlus = trimmed.startsWith("+");
  const core = trimmed.replace(/[^\d]/g, "");
  return hasPlus ? `+${core}` : core;
}

function isValidMalaysianMobile(input: string) {
  const val = normalizeMobileInput(input);
  if (val.startsWith("+60")) {
    const digits = val.slice(1);
    return /^60\d{9,11}$/.test(digits);
  }
  return /^01\d{8,10}$/.test(val);
}

function isValidRecipientName(name: string) {
  const v = name.trim();
  return /^[A-Za-z][A-Za-z\s'-]{1,}$/.test(v);
}

function validateBankAccount(acc: string) {
  const digits = normalizeDigits(acc);
  return /^\d{8,16}$/.test(digits);
}

function normalizeDuitNowId(type: DuitNowIdType, value: string) {
  if (type === "mobile") return normalizeMobileInput(value);
  if (type === "nric") return value.replace(/-/g, "").replace(/\s+/g, "");
  if (type === "passport") return value.toUpperCase().replace(/\s+/g, "");
  if (type === "business") return value.toUpperCase().replace(/\s+/g, "");
  if (type === "army") return value.toUpperCase().replace(/\s+/g, "");
  return value.trim();
}

function validateDuitNowId(type: DuitNowIdType, raw: string): { ok: boolean; message?: string } {
  const v = normalizeDuitNowId(type, raw);
  if (!v) return { ok: false, message: "Please enter the DuitNow ID." };
  if (type === "mobile") {
    return isValidMalaysianMobile(v)
      ? { ok: true }
      : { ok: false, message: "Enter a valid Malaysian mobile number." };
  }
  if (type === "nric") {
    return /^\d{12}$/.test(v)
      ? { ok: true }
      : { ok: false, message: "Enter a valid 12-digit NRIC." };
  }
  if (type === "passport") {
    return /^[A-Z0-9]{6,12}$/.test(v)
      ? { ok: true }
      : { ok: false, message: "Enter a valid passport number." };
  }
  if (type === "business") {
    return /^[A-Z0-9-]{8,20}$/.test(v)
      ? { ok: true }
      : { ok: false, message: "Enter a valid business registration number." };
  }
  return /^[A-Z0-9]{6,12}$/.test(v)
    ? { ok: true }
    : { ok: false, message: "Enter a valid Army/Police ID." };
}

const DUITNOW_RESOLVER: Record<string, string> = {
  "mobile:0123456789": "Aina Rahman",
  "mobile:+60123456789": "Aina Rahman",
  "nric:990101141234": "Jason Tan",
  "passport:A12345678": "Daniel Wong",
  "army:T1234567": "Nur Iman",
  "business:123456-X": "Bright Future Sdn Bhd",
};

const BANK_RESOLVER: Record<string, string> = {
  "Maybank:1234567890": "Lee Wei Ming",
  "CIMB:2345678901": "Aina Rahman",
  "Public Bank:3456789012": "Daniel Wong",
  "RHB Bank:4567890123": "Nur Iman",
  "Hong Leong Bank:5678901234": "Jason Tan",
};

const FALLBACK_NAMES = ["Aina Rahman", "Lee Wei Ming", "Nur Iman", "Daniel Wong", "Siti Hajar"];

function pickFallbackName(seed: string): string {
  const n = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return FALLBACK_NAMES[n % FALLBACK_NAMES.length];
}

/* ─── Icons ───────────────────────────────────────────────────────── */

function ChevronLeft() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function TransferScreen() {
  const accountStore        = useAccountStore();
  const { addTransaction, transactions }  = useTransactionStore();
  const { addNotification } = useNotificationStore();
  const { addActivity } = useActivityStore();
  const { recentRecipients, addRecipient, markUsed } = useRecipientStore();
  const {
    manualSave,
    addManualActivity,
    savingsBuckets,
    applyRoundUp,
    roundUpDestination,
  } = useSavingsStore();
  const fc = useFlexiCreditStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const healthReport = useHealthData();

  const [step, setStep]                       = useState<Step>("channel");
  const [activeRecipient, setActiveRecipient] = useState<StoredRecipient | null>(null);
  const [amountText, setAmountText]           = useState("");
  const [reference, setReference]             = useState("");

  // Passcode modal
  const [pin, setPin]         = useState("");
  const [pinError, setPinError] = useState("");
  const pinRef = useRef<TextInput>(null);
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState("");
  const [nudgeContext, setNudgeContext] = useState<NudgeRiskContext | null>(null);
  const [nudgeEvaluation, setNudgeEvaluation] = useState<NudgeEvaluation | null>(null);

  useEffect(() => {
    if (step !== "passcode") return;
    const t = setTimeout(() => pinRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [step]);

  // Bank form
  const [bankName, setBankName]         = useState("");
  const [bankAccount, setBankAccount]   = useState("");
  const [bankFormErr, setBankFormErr]   = useState("");

  // DuitNow form
  const [dnType, setDnType]         = useState<DuitNowIdType>("mobile");
  const [dnId, setDnId]             = useState("");
  const [dnFormErr, setDnFormErr]   = useState("");
  const [resolvedRecipient, setResolvedRecipient] = useState<StoredRecipient | null>(null);
  const [resolvedMethodLabel, setResolvedMethodLabel] = useState("");


  // SmartGX user form
  const [sgxMobile, setSgxMobile]   = useState("");
  const [sgxName, setSgxName]       = useState("");
  const [sgxFormErr, setSgxFormErr] = useState("");

  const parsedAmount = parseFloat(amountText.replace(/[^0-9.]/g, "")) || 0;
  const normalizedBankAcc = normalizeDigits(bankAccount);
  const normalizedDnId = normalizeDuitNowId(dnType, dnId);
  const normalizedSgxMobile = normalizeMobileInput(sgxMobile);
  const validBankName = BANKS.includes(bankName);
  const validBankAcc = validateBankAccount(bankAccount);
  const validDnId = validateDuitNowId(dnType, dnId);
  const validSgxName = isValidRecipientName(sgxName);
  const validSgxMobile = isValidMalaysianMobile(sgxMobile);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const amountWithinBalance = parsedAmount <= accountStore.mainBalance;
  const canProceed = validAmount && amountWithinBalance;

  /* ── Channel selection ── */
  const handleSelectRecent = (r: StoredRecipient) => {
    setActiveRecipient(r);
    setStep("amount");
  };

  const handleSelectContact = (c: Contact) => {
    if (!isValidMalaysianMobile(c.mobile)) {
      return;
    }
    const r: StoredRecipient = {
      id:              `contact-${c.id}-${Date.now()}`,
      name:            c.name,
      identifier:      normalizeMobileInput(c.mobile),
      identifierLabel: `SmartGX • ${normalizeMobileInput(c.mobile)}`,
      channel:         "smartgx",
      lastUsed:        "2026-05-08",
      isFavourite:     false,
    };
    setActiveRecipient(r);
    setStep("amount");
  };

  /* ── Bank form submit ── */
  const handleBankSubmit = () => {
    setBankFormErr("");
    if (!validBankName)      { setBankFormErr("Please select a valid bank."); return; }
    if (!validBankAcc)       { setBankFormErr("Enter a valid 8-16 digit account number."); return; }
    const resolvedName = BANK_RESOLVER[`${bankName}:${normalizedBankAcc}`] ?? pickFallbackName(`${bankName}:${normalizedBankAcc}`);
    const r: StoredRecipient = {
      id:              `bank-${Date.now()}`,
      name:            resolvedName,
      identifier:      normalizedBankAcc,
      identifierLabel: `${bankName} • ${normalizedBankAcc}`,
      channel:         "bank",
      bankName:        bankName.trim(),
      lastUsed:        "2026-05-08",
      isFavourite:     false,
    };
    setResolvedRecipient(r);
    setResolvedMethodLabel("Bank Transfer");
    setStep("resolvedRecipient");
  };

  /* ── DuitNow form submit ── */
  const handleDuitNowSubmit = () => {
    setDnFormErr("");
    if (!validDnId.ok) { setDnFormErr(validDnId.message ?? "Enter a valid DuitNow ID."); return; }
    const typeLabel = DUITNOW_TYPES.find((t) => t.key === dnType)?.label ?? dnType;
    const resolvedName = DUITNOW_RESOLVER[`${dnType}:${normalizedDnId}`] ?? pickFallbackName(`${dnType}:${normalizedDnId}`);
    const r: StoredRecipient = {
      id:              `duitnow-${Date.now()}`,
      name:            resolvedName,
      identifier:      normalizedDnId,
      identifierLabel: `DuitNow • ${typeLabel} • ${normalizedDnId}`,
      channel:         "duitnow",
      lastUsed:        "2026-05-08",
      isFavourite:     false,
    };
    setResolvedRecipient(r);
    setResolvedMethodLabel("DuitNow Transfer");
    setStep("resolvedRecipient");
  };

  /* ── SmartGX user form submit ── */
  const handleSmartGXSubmit = () => {
    setSgxFormErr("");
    if (!validSgxName) { setSgxFormErr("Enter a valid recipient name."); return; }
    if (!validSgxMobile) { setSgxFormErr("Enter a valid Malaysian mobile number."); return; }
    const r: StoredRecipient = {
      id:              `sgx-${Date.now()}`,
      name:            sgxName.trim(),
      identifier:      normalizedSgxMobile,
      identifierLabel: `SmartGX • ${normalizedSgxMobile}`,
      channel:         "smartgx",
      lastUsed:        "2026-05-08",
      isFavourite:     false,
    };
    setActiveRecipient(r);
    setStep("amount");
  };

  const monthlyIncome = currentUser?.financialProfile?.monthlyIncome ?? 0;
  const savingsBalance = savingsBuckets.bonus + savingsBuckets.emergency + savingsBuckets.goals;
  const maybeBudget = (currentUser?.financialProfile as { monthlyBudget?: number } | undefined)?.monthlyBudget;
  const roundUpPocketLabel =
    roundUpDestination === "bonus"
      ? "Bonus Pocket"
      : roundUpDestination === "emergency"
      ? "Emergency Fund"
      : "Goals";

  const buildTransferRiskContext = () => {
    if (!activeRecipient) return null;
    return buildRiskContext({
      actionType: "transfer",
      amount: parsedAmount,
      paymentMethod: "online_transfer",
      cardType: "debit",
      merchant: activeRecipient.name,
      category: "others",
      transactionDescription: reference.trim() || undefined,
      mainBalance: accountStore.mainBalance,
      flexiLimit: accountStore.flexiLimit,
      flexiUsed: accountStore.flexiUsed,
      gxHealthScore: healthReport.score,
      monthlyIncome,
      transactions,
      userId: currentUser?.id ?? "",
      savingsBalance,
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

  const runTransferNudgeCheck = async () => {
    if (!validAmount) return;
    if (!amountWithinBalance) return;
    const context = buildTransferRiskContext();
    if (!context) return;
    const evaluation = evaluateNudgeRisk(context);

    if (!evaluation.requiresSoftFriction) {
      setPin("");
      setPinError("");
      setStep("passcode");
      return;
    }

    const message = await generateAiNudge(context, evaluation);
    setNudgeContext(context);
    setNudgeEvaluation(evaluation);
    setNudgeMessage(message);
    setNudgeVisible(true);
  };

  const handleSaveInstead = () => {
    if (!activeRecipient || parsedAmount <= 0) return;
    const isoNow = new Date().toISOString();
    const saveAmt = Math.min(parsedAmount, accountStore.mainBalance);
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
      id: `manual-save-transfer-${Date.now()}`,
      label: "Saved instead of transfer",
      pocket: "Goals",
      type: "manual",
      amount: saveAmt,
      date: "2026-05-08",
    });
    addNotification({
      id: `notif-save-instead-${Date.now()}`,
      title: "Save Instead completed",
      message: `${formatRM(saveAmt)} moved to Goals instead of transfer.`,
      time: "8 May 2026 · Now",
      read: false,
      type: "insight",
    });
    addActivity({
      id: `act-save-instead-transfer-${Date.now()}`,
      type: "save_instead",
      title: "Save Instead",
      description: "Saved instead of transfer",
      amount: saveAmt,
      direction: "credit",
      timestamp: isoNow,
      route: "/savings",
    });
    setNudgeVisible(false);
    setStep("channel");
  };

  const handleNudgeDecision = (decision: NudgeDecision) => {
    if (decision === "continue") {
      setNudgeVisible(false);
      setPin("");
      setPinError("");
      setStep("passcode");
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
      setPin("");
      setPinError("");
      setStep("amount");
      return;
    }
    setNudgeVisible(false);
  };

  /* ── Passcode confirmation ── */
  const handlePasscodeConfirm = async () => {
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
    setPinError("");
    handleConfirm();
  };

  /* ── Execute transfer (called after PIN verified) ── */
  const handleConfirm = () => {
    if (!activeRecipient) return;
    const debit = accountStore.debitPay(parsedAmount);
    if (!debit.ok) return;
    const risk = nudgeEvaluation?.riskLevel ?? "low";
    const now = new Date();
    const isoNow = now.toISOString();
    const dateOnly = isoNow.slice(0, 10);
    const timeLabel = now.toTimeString().slice(0, 5);

    const txn: Transaction = {
      id:              `t-transfer-${Date.now()}`,
      userId:          currentUser?.id ?? "",
      merchant:        activeRecipient.name,
      category:        "others",
      amount:          parsedAmount,
      type:            "expense",
      paymentMethod:   "online_transfer",
      transactionDate: dateOnly,
      riskLevel:       risk,
      isSuspicious:    false,
      note:            reference || `Transfer to ${activeRecipient.name}`,
      sourceAction:    "transfer",
      occurredAt:      isoNow,
    };
    addTransaction(txn);
    addNotification({
      id:      `notif-transfer-${Date.now()}`,
      title:   "Transfer successful",
      message: `${formatRM(parsedAmount)} sent to ${activeRecipient.name} (${activeRecipient.identifierLabel}).`,
      time:    `${dateOnly} · ${timeLabel}`,
      read:    false,
      type:    "info",
    });
    addActivity({
      id: `act-transfer-${Date.now()}`,
      type: "transfer",
      title: "Transfer",
      description: activeRecipient.name,
      amount: parsedAmount,
      direction: "debit",
      timestamp: isoNow,
      route: "/transactions",
    });
    if (nudgeEvaluation?.shouldCreateNotification && risk !== "low") {
      addNotification({
        id: `notif-transfer-risk-${Date.now()}`,
        title: risk === "critical" ? "Critical cashflow warning" : "High-risk transfer warning",
        message: `SmartGX flagged this ${formatRM(parsedAmount)} transfer as ${risk} risk before completion.`,
        time: `${dateOnly} · ${timeLabel}`,
        read: false,
        type: "risk",
      });
    }

    const roundUpCandidate = Math.round((Math.ceil(parsedAmount) - parsedAmount) * 100) / 100;
    if (roundUpCandidate > 0 && accountStore.mainBalance >= roundUpCandidate) {
      const roundUpDebit = accountStore.debitPay(roundUpCandidate);
      if (roundUpDebit.ok) {
        const roundUpResult = applyRoundUp(parsedAmount);
        if (roundUpResult.ok && roundUpResult.saved > 0) {
          addManualActivity({
            id: `roundup-transfer-${Date.now()}`,
            label: "Round-up from transfer",
            pocket: roundUpPocketLabel,
            type: "roundup",
            amount: roundUpResult.saved,
            date: dateOnly,
            occurredAt: isoNow,
          });
          addActivity({
            id: `act-roundup-transfer-${Date.now()}`,
            type: "round_up_saving",
            title: "Round-up Saving",
            description: "Round-up from transfer",
            amount: roundUpResult.saved,
            direction: "credit",
            timestamp: isoNow,
            route: "/savings",
          });
        }
      }
    }

    // Save to recent recipients
    addRecipient({ ...activeRecipient, lastUsed: dateOnly });
    if (activeRecipient.id.startsWith("seed-")) markUsed(activeRecipient.id);

    setStep("success");
  };

  /* ── Navigation helpers ── */
  const handleBack = () => {
    if (step === "channel")    { router.push("/dashboard" as never); return; }
    if (step === "bankForm")   { setStep("channel"); return; }
    if (step === "duitnowForm"){ setStep("channel"); return; }
    if (step === "resolvedRecipient") { setStep("channel"); return; }
    if (step === "smartgxForm"){ setStep("channel"); return; }
    if (step === "amount")     { setStep("channel"); return; }
    if (step === "confirm")    { setStep("amount"); return; }
    if (step === "passcode")   { setStep("confirm"); setPin(""); setPinError(""); return; }
  };

  const handleNewTransfer = () => {
    setStep("channel");
    setActiveRecipient(null);
    setResolvedRecipient(null);
    setResolvedMethodLabel("");
    setAmountText(""); setReference("");
    setBankName(""); setBankAccount(""); setBankFormErr("");
    setDnType("mobile"); setDnId(""); setDnFormErr("");
    setSgxMobile(""); setSgxName(""); setSgxFormErr("");
    setNudgeVisible(false);
    setNudgeContext(null);
    setNudgeEvaluation(null);
    setNudgeMessage("");
  };

  const stepTitle: Partial<Record<Step, string>> = {
    channel:     "Transfer",
    bankForm:    "Bank Transfer",
    duitnowForm: "DuitNow Transfer",
    resolvedRecipient: "Recipient Confirmation",
    smartgxForm: "SmartGX User",
    amount:      "Enter Amount",
    confirm:     "Confirm Transfer",
    passcode:    "Enter PIN",
  };

  if (!currentUser) return <Redirect href="/auth/login" />;
  if (!userHasPinSet()) return <Redirect href="/auth/app-pin-setup" />;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#3B1578" />

      {nudgeContext && nudgeEvaluation && (
        <AiNudgeModal
          visible={nudgeVisible}
          message={nudgeMessage}
          amountLabel={formatRM(nudgeContext.amount)}
          summaryLabel="Transfer payment"
          evaluation={nudgeEvaluation}
          riskContext={nudgeContext}
          onDecision={handleNudgeDecision}
        />
      )}

      {/* ── Passcode Modal (centered) ── */}
      <Modal visible={step === "passcode"} transparent animationType="fade" onRequestClose={() => { setStep("confirm"); setPin(""); setPinError(""); }}>
        <View style={styles.pinOverlay}>
          <View style={styles.pinCard}>
            <Text style={styles.pinTitle}>Enter 6-Digit PIN</Text>
            {activeRecipient && (
              <View style={styles.pinSummary}>
                <Text style={styles.pinRecipient}>{activeRecipient.name}</Text>
                <Text style={styles.pinAmount}>{formatRM(parsedAmount)}</Text>
              </View>
            )}
            <Text style={styles.pinLabel}>PIN</Text>
            <Pressable style={styles.pinDotRow} onPress={() => pinRef.current?.focus()}>
              {Array.from({ length: 6 }, (_, i) => (
                <View key={i} style={[styles.pinDot, i < pin.length ? styles.pinDotFilled : styles.pinDotEmpty]} />
              ))}
            </Pressable>
            <TextInput
              ref={pinRef}
              style={styles.pinHiddenInput}
              value={pin}
              onChangeText={(v) => { setPin(v.replace(/[^0-9]/g, "")); setPinError(""); }}
              keyboardType="number-pad"
              maxLength={6}
              caretHidden
            />
            {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
            <View style={styles.btnRow}>
              <Pressable style={styles.ghostBtn} onPress={() => { setStep("confirm"); setPin(""); setPinError(""); }}>
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, { flex: 2 }, pin.length < 6 && { opacity: 0.4 }]}
                onPress={handlePasscodeConfirm}
                disabled={pin.length < 6}
              >
                <Text style={styles.primaryBtnText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Gradient hero header ── */}
      {step !== "success" ? (
        <LinearGradient
          colors={["#3B1578", "#2D0D6B", "#1A0845", "#070B14"]}
          locations={[0, 0.4, 0.75, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.hero}
        >
          <Pressable style={styles.backBtn} onPress={handleBack}>
            <ChevronLeft />
          </Pressable>
          <Text style={styles.heroTitle}>{stepTitle[step] ?? "Transfer"}</Text>
          {step === "channel" && (
            <Text style={styles.heroSub}>
              Balance: <Text style={{ color: "#A78BFA", fontWeight: "700" }}>{formatRM(accountStore.mainBalance)}</Text>
            </Text>
          )}
        </LinearGradient>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >

        {/* ══ STEP: Channel Selection ══ */}
        {step === "channel" && (
          <>
            {/* 1. Transfer To — Bank & DuitNow only */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Transfer To</Text>
              <View style={styles.channelGrid}>
                <Pressable style={styles.channelCard} onPress={() => setStep("bankForm")}>
                  <Text style={styles.channelEmoji}>🏦</Text>
                  <Text style={styles.channelLabel}>{"Bank\nTransfer"}</Text>
                </Pressable>
                <Pressable style={styles.channelCard} onPress={() => setStep("duitnowForm")}>
                  <Image
                    source={require("../assets/duitnow.png")}
                    style={styles.channelDuitnowLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.channelLabel}>{"DuitNow\nTransfer"}</Text>
                </Pressable>
              </View>
            </View>

            {/* 2. Recent Recipients */}
            {recentRecipients.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Recipients</Text>
                <View style={styles.card}>
                  {recentRecipients.slice(0, 5).map((r, i) => (
                    <Pressable
                      key={r.id}
                      style={[styles.recipientRow, i < Math.min(recentRecipients.length - 1, 4) && styles.rowBorder]}
                      onPress={() => handleSelectRecent(r)}
                    >
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarLetter}>{r.name.charAt(0)}</Text>
                      </View>
                      <View style={styles.recipientBody}>
                        <Text style={styles.recipientName}>{r.name}</Text>
                        <Text style={styles.recipientSub}>{r.identifierLabel}</Text>
                      </View>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <Path d="M9 18L15 12L9 6" stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* 3. Contacts */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contacts</Text>
              <View style={styles.card}>
                {MOCK_CONTACTS.map((c, i) => (
                  <Pressable
                    key={c.id}
                    style={[styles.recipientRow, i < MOCK_CONTACTS.length - 1 && styles.rowBorder]}
                    onPress={() => handleSelectContact(c)}
                  >
                    <View style={[styles.avatarCircle, { backgroundColor: "rgba(56,189,248,0.15)", borderColor: "rgba(56,189,248,0.3)" }]}>
                      <Text style={[styles.avatarLetter, { color: "#38BDF8" }]}>{c.avatar}</Text>
                    </View>
                    <View style={styles.recipientBody}>
                      <Text style={styles.recipientName}>{c.name}</Text>
                      <Text style={styles.recipientSub}>{c.mobile}</Text>
                    </View>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M9 18L15 12L9 6" stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ height: spacing.xl }} />
          </>
        )}

        {/* ══ STEP: Bank Transfer form ══ */}
        {step === "bankForm" && (
          <View style={styles.section}>
            <Text style={styles.formHint}>Select bank and account number. Recipient will be resolved securely.</Text>
            <View style={styles.card}>
              <FormField
                label="Account Number"
                value={bankAccount}
                onChange={(v) => { setBankAccount(normalizeDigits(v)); setBankFormErr(""); }}
                placeholder="e.g. 1234567890"
                keyboardType="numeric"
              />
            </View>

            <Text style={styles.sectionTitle}>Select Bank</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.bankChips}>
                {BANKS.map((b) => (
                  <Pressable
                    key={b}
                    style={[styles.bankChip, bankName === b && styles.bankChipActive]}
                    onPress={() => setBankName(b)}
                  >
                    <Text style={[styles.bankChipText, bankName === b && { color: "#A78BFA" }]}>{b}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {bankFormErr ? <Text style={styles.formError}>{bankFormErr}</Text> : null}
            <Pressable
              style={[styles.primaryBtn, (!validBankName || !validBankAcc) && styles.primaryBtnDisabled]}
              onPress={handleBankSubmit}
              disabled={!validBankName || !validBankAcc}
            >
              <Text style={styles.primaryBtnText}>Continue →</Text>
            </Pressable>
          </View>
        )}

        {/* ══ STEP: DuitNow form ══ */}
        {step === "duitnowForm" && (
          <View style={styles.section}>
            <Text style={styles.formHint}>Choose identifier type and value. Recipient will be resolved after validation.</Text>

            <View style={styles.duitnowTypes}>
              {DUITNOW_TYPES.map((t) => (
                <Pressable
                  key={t.key}
                  style={[styles.duitnowTypeRow, dnType === t.key && styles.duitnowTypeActive]}
                  onPress={() => { setDnType(t.key); setDnId(""); setDnFormErr(""); }}
                >
                  <View style={[styles.duitnowRadio, dnType === t.key && styles.duitnowRadioActive]} />
                  <Text style={[styles.duitnowTypeLabel, dnType === t.key && { color: "#A78BFA" }]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.card}>
              <FormField
                label={DUITNOW_TYPES.find((t) => t.key === dnType)?.label ?? "ID"}
                value={dnId}
                onChange={(v) => { setDnId(normalizeDuitNowId(dnType, v)); setDnFormErr(""); }}
                placeholder={DUITNOW_PLACEHOLDERS[dnType]}
                keyboardType={dnType === "mobile" ? "phone-pad" : "default"}
              />
            </View>

            {dnFormErr ? <Text style={styles.formError}>{dnFormErr}</Text> : null}
            <Pressable
              style={[styles.primaryBtn, !validDnId.ok && styles.primaryBtnDisabled]}
              onPress={handleDuitNowSubmit}
              disabled={!validDnId.ok}
            >
              <Text style={styles.primaryBtnText}>Continue →</Text>
            </Pressable>
          </View>
        )}

        {step === "resolvedRecipient" && resolvedRecipient && (
          <View style={styles.section}>
            <View style={styles.card}>
              <ConfirmRow label="Recipient Name" value={resolvedRecipient.name} />
              <View style={styles.fieldDivider} />
              <ConfirmRow label="Transfer Method" value={resolvedMethodLabel} />
              <View style={styles.fieldDivider} />
              <ConfirmRow label="Identifier" value={resolvedRecipient.identifierLabel} />
            </View>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => {
                setActiveRecipient(resolvedRecipient);
                setStep("amount");
              }}
            >
              <Text style={styles.primaryBtnText}>Continue to Amount →</Text>
            </Pressable>
          </View>
        )}

        {/* ══ STEP: SmartGX User form ══ */}
        {step === "smartgxForm" && (
          <View style={styles.section}>
            <Text style={styles.formHint}>Send to another SmartGX user by mobile number</Text>
            <View style={styles.card}>
              <FormField
                label="Recipient Name"
                value={sgxName}
                onChange={(v) => { setSgxName(v.replace(/[^A-Za-z\s'-]/g, "")); setSgxFormErr(""); }}
                placeholder="Full name"
                autoCapitalize="words"
              />
              <View style={styles.fieldDivider} />
              <FormField
                label="Mobile Number"
                value={sgxMobile}
                onChange={(v) => { setSgxMobile(normalizeMobileInput(v)); setSgxFormErr(""); }}
                placeholder="e.g. +60123456789"
                keyboardType="phone-pad"
              />
            </View>
            {sgxFormErr ? <Text style={styles.formError}>{sgxFormErr}</Text> : null}
            <Pressable
              style={[styles.primaryBtn, (!validSgxName || !validSgxMobile) && styles.primaryBtnDisabled]}
              onPress={handleSmartGXSubmit}
              disabled={!validSgxName || !validSgxMobile}
            >
              <Text style={styles.primaryBtnText}>Continue →</Text>
            </Pressable>
          </View>
        )}

        {/* ══ STEP: Amount ══ */}
        {step === "amount" && activeRecipient && (
          <View style={styles.section}>
            <View style={styles.recipientPreview}>
              <View style={styles.avatarCircleLg}>
                <Text style={styles.avatarLetterLg}>{activeRecipient.name.charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.recipientPreviewName}>{activeRecipient.name}</Text>
                <Text style={styles.recipientPreviewSub}>{activeRecipient.identifierLabel}</Text>
              </View>
            </View>

            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Amount (RM)</Text>
              <View style={styles.amountRow}>
                <Text style={styles.amountSymbol}>RM</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amountText}
                  onChangeText={(v) => setAmountText(v.replace(/[^0-9.]/g, ""))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
              </View>
              {parsedAmount > accountStore.mainBalance && parsedAmount > 0 && (
                <Text style={{ color: "#EF4444", fontSize: 12 }}>
                  Exceeds balance ({formatRM(accountStore.mainBalance)})
                </Text>
              )}
              {canProceed && (
                <Text style={{ color: "#22C55E", fontSize: 12 }}>
                  Balance after: {formatRM(accountStore.mainBalance - parsedAmount)}
                </Text>
              )}
            </View>

            <View style={styles.quickRow}>
              {QUICK_AMOUNTS.map((a) => (
                <Pressable
                  key={a}
                  style={[styles.quickChip, parsedAmount === a && styles.quickChipActive]}
                  onPress={() => setAmountText(String(a))}
                >
                  <Text style={[styles.quickChipText, parsedAmount === a && { color: "#A78BFA" }]}>RM{a}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.refWrap}>
              <Text style={styles.refLabel}>Reference (optional)</Text>
              <TextInput
                style={styles.refInput}
                value={reference}
                onChangeText={(v) => setReference(v.slice(0, MAX_REFERENCE_LEN))}
                placeholder="e.g. Rent, Lunch, Utilities"
                placeholderTextColor={colors.textMuted}
                maxLength={MAX_REFERENCE_LEN}
              />
            </View>

            <Pressable
              style={[styles.primaryBtn, !canProceed && styles.primaryBtnDisabled]}
              onPress={() => { if (canProceed) setStep("confirm"); }}
              disabled={!canProceed}
            >
              <Text style={styles.primaryBtnText}>Review Transfer →</Text>
            </Pressable>
          </View>
        )}

        {/* ══ STEP: Confirm ══ */}
        {step === "confirm" && activeRecipient && (
          <View style={styles.section}>
            <View style={styles.card}>
              <ConfirmRow label="To"              value={activeRecipient.name} />
              <View style={styles.fieldDivider} />
              <ConfirmRow label="Via"             value={activeRecipient.identifierLabel} />
              {activeRecipient.bankName ? (
                <>
                  <View style={styles.fieldDivider} />
                  <ConfirmRow label="Bank" value={activeRecipient.bankName} />
                </>
              ) : null}
              {reference ? (
                <>
                  <View style={styles.fieldDivider} />
                  <ConfirmRow label="Reference" value={reference} />
                </>
              ) : null}
              <View style={styles.fieldDivider} />
              <ConfirmRow label="Current balance" value={formatRM(accountStore.mainBalance)} />
              <View style={styles.fieldDivider} />
              <ConfirmRow
                label="Amount"
                value={`-${formatRM(parsedAmount)}`}
                valueStyle={{ color: "#EF4444", fontSize: 18, fontWeight: "800" }}
              />
              <View style={styles.fieldDivider} />
              <ConfirmRow
                label="Balance after"
                value={formatRM(accountStore.mainBalance - parsedAmount)}
                valueStyle={{ color: "#22C55E" }}
              />
            </View>

            <View style={styles.btnRow}>
              <Pressable style={styles.ghostBtn} onPress={() => setStep("amount")}>
                <Text style={styles.ghostBtnText}>Edit</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, { flex: 2 }]} onPress={runTransferNudgeCheck}>
                <Text style={styles.primaryBtnText}>Confirm Transfer</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ══ STEP: Success ══ */}
        {step === "success" && activeRecipient && (
          <View style={[styles.section, styles.successWrap]}>
            <View style={styles.successIconWrap}>
              <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="10" fill="rgba(34,197,94,0.15)" stroke="#22C55E" strokeWidth="1.5" />
                <Path d="M8 12L11 15L16 9" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.successTitle}>Transfer Sent!</Text>
            <Text style={styles.successAmount}>-{formatRM(parsedAmount)}</Text>
            <Text style={styles.successSub}>Sent to {activeRecipient.name}</Text>

            <View style={styles.receiptCard}>
              <Text style={styles.receiptHeader}>Transfer Receipt</Text>
              <ReceiptRow label="To"     value={activeRecipient.name} />
              <ReceiptRow label="Via"    value={activeRecipient.identifierLabel} />
              {reference ? <ReceiptRow label="Reference" value={reference} /> : null}
              <ReceiptRow label="Amount"      value={`-${formatRM(parsedAmount)}`}  valueColor="#EF4444" />
              <ReceiptRow label="New balance" value={formatRM(accountStore.mainBalance)} valueColor="#22C55E" />
              <ReceiptRow label="Date"        value="8 May 2026" />
            </View>

            <View style={styles.btnRow}>
              <Pressable style={styles.ghostBtn} onPress={handleNewTransfer}>
                <Text style={styles.ghostBtnText}>New Transfer</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={() => router.push("/dashboard" as never)}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Helper components ───────────────────────────────────────────── */

function FormField({
  label, value, onChange, placeholder, keyboardType = "default", autoCapitalize = "none",
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "phone-pad" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formFieldLabel}>{label}</Text>
      <TextInput
        style={styles.formFieldInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

function ConfirmRow({ label, value, valueStyle }: { label: string; value: string; valueStyle?: object }) {
  return (
    <View style={styles.confirmRow}>
      <Text style={styles.confirmKey}>{label}</Text>
      <Text style={[styles.confirmVal, valueStyle]}>{value}</Text>
    </View>
  );
}

function ReceiptRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptKey}>{label}</Text>
      <Text style={[styles.receiptVal, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 52 },

  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.xs,
  },
  backBtn:  { padding: spacing.xs, alignSelf: "flex-start", marginBottom: spacing.xs },
  heroTitle:{ color: "#FFFFFF", fontSize: typography.title, fontWeight: "800", letterSpacing: -0.3 },
  heroSub:  { color: "#C4B5FD", fontSize: typography.body, opacity: 0.85 },

  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: typography.subheading, marginBottom: 2 },
  formHint: { color: colors.textMuted, fontSize: typography.body, lineHeight: 20 },

  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: "hidden" },

  recipientRow:  { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: 13, gap: 12 },
  rowBorder:     { borderBottomWidth: 1, borderBottomColor: colors.border },
  avatarCircle:  { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(124,58,237,0.2)", borderWidth: 1, borderColor: "rgba(167,139,250,0.3)", alignItems: "center", justifyContent: "center" },
  avatarLetter:  { color: "#C4B5FD", fontSize: 16, fontWeight: "800" },
  recipientBody: { flex: 1 },
  recipientName: { color: "#FFFFFF", fontSize: typography.body, fontWeight: "700" },
  recipientSub:  { color: colors.textMuted, fontSize: typography.caption },

  channelGrid:  { flexDirection: "row", gap: 10 },
  channelCard:  { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 18, paddingHorizontal: 12, alignItems: "center", gap: 6 },
  channelEmoji:       { fontSize: 26 },
  channelDuitnowLogo: { width: 36, height: 36 },
  channelLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 18 },

  addRecipientBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: radius.lg, borderWidth: 1.5, borderColor: "rgba(167,139,250,0.3)", borderStyle: "dashed" },
  addRecipientText: { color: "#A78BFA", fontSize: typography.body, fontWeight: "700" },

  bankChips:    { flexDirection: "row", gap: 8, paddingBottom: 4 },
  bankChip:     { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bankChipActive: { borderColor: "#7C3AED", backgroundColor: "rgba(124,58,237,0.12)" },
  bankChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },

  duitnowTypes:     { gap: 2 },
  duitnowTypeRow:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  duitnowTypeActive:{ borderColor: "#7C3AED", backgroundColor: "rgba(124,58,237,0.08)" },
  duitnowRadio:     { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.border },
  duitnowRadioActive:{ borderColor: "#7C3AED", backgroundColor: "#7C3AED" },
  duitnowTypeLabel: { color: colors.textSecondary, fontSize: typography.body, fontWeight: "600" },

  formField:      { paddingHorizontal: spacing.lg, paddingVertical: 12 },
  formFieldLabel: { color: "#A78BFA", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 },
  formFieldInput: { color: "#FFFFFF", fontSize: 15, paddingVertical: 2 },
  fieldDivider:   { height: 1, backgroundColor: colors.border },
  formError:      { color: "#EF4444", fontSize: typography.caption },

  recipientPreview:    { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(124,58,237,0.1)", borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(167,139,250,0.2)", padding: 14 },
  avatarCircleLg:      { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(124,58,237,0.2)", borderWidth: 1, borderColor: "rgba(167,139,250,0.3)", alignItems: "center", justifyContent: "center" },
  avatarLetterLg:      { color: "#C4B5FD", fontSize: 18, fontWeight: "800" },
  recipientPreviewName:{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  recipientPreviewSub: { color: colors.textMuted, fontSize: typography.caption },

  amountCard:  { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: "rgba(167,139,250,0.25)", borderRadius: 16, padding: 16, gap: 6 },
  amountLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  amountRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  amountSymbol:{ color: "#A78BFA", fontSize: 26, fontWeight: "800" },
  amountInput: { flex: 1, color: "#FFFFFF", fontSize: 36, fontWeight: "800", letterSpacing: -1, paddingVertical: 4 },

  quickRow:      { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickChip:     { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  quickChipActive:{ borderColor: "#7C3AED", backgroundColor: "rgba(124,58,237,0.12)" },
  quickChipText: { color: colors.textSecondary, fontSize: typography.body, fontWeight: "700" },

  refWrap:  { gap: 6 },
  refLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  refInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: "#FFFFFF", fontSize: 15 },

  confirmRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: 12 },
  confirmKey: { color: colors.textMuted, fontSize: typography.body },
  confirmVal: { color: "#FFFFFF", fontSize: typography.body, fontWeight: "600", textAlign: "right", flex: 1, marginLeft: 12 },

  btnRow:    { flexDirection: "row", gap: 10 },

  /* Passcode modal */
  pinOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  pinCard:        { width: "100%", backgroundColor: "#0C0920", borderRadius: 20, borderWidth: 1, borderColor: "rgba(167,139,250,0.25)", padding: 24, gap: 14 },
  pinTitle:       { color: "#FFFFFF", fontSize: 18, fontWeight: "800", textAlign: "center" },
  pinSummary:     { alignItems: "center", gap: 2 },
  pinRecipient:   { color: colors.textMuted, fontSize: typography.body },
  pinAmount:      { color: "#FFFFFF", fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  pinLabel:       { color: colors.textMuted, fontSize: typography.caption, textAlign: "center" },
  pinDotRow:      { flexDirection: "row", gap: 12, justifyContent: "center", paddingVertical: 8 },
  pinDot:         { width: 16, height: 16, borderRadius: 8 },
  pinDotEmpty:    { backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1.5, borderColor: "rgba(167,139,250,0.25)" },
  pinDotFilled:   { backgroundColor: "#7C3AED" },
  pinHiddenInput: { position: "absolute", opacity: 0, width: 1, height: 1, top: 0, left: 0 },
  pinError:       { color: "#EF4444", fontSize: typography.caption, textAlign: "center" },
  pinHint:        { color: colors.textMuted, fontSize: 11, textAlign: "center" },
  primaryBtn:         { flex: 1, backgroundColor: "#7C3AED", borderRadius: radius.lg, paddingVertical: 15, alignItems: "center" },
  primaryBtnDisabled: { backgroundColor: "rgba(124,58,237,0.35)" },
  primaryBtnText:     { color: "#FFFFFF", fontSize: typography.body, fontWeight: "700" },
  ghostBtn:           { flex: 1, paddingVertical: 15, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  ghostBtnText:       { color: colors.textMuted, fontSize: typography.body, fontWeight: "600" },

  successWrap:     { alignItems: "center", paddingTop: spacing.xl },
  successIconWrap: { width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(34,197,94,0.1)", borderWidth: 1, borderColor: "rgba(34,197,94,0.25)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  successTitle:    { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  successAmount:   { color: "#EF4444", fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  successSub:      { color: colors.textMuted, fontSize: typography.body, marginTop: -6 },
  receiptCard:     { width: "100%", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  receiptHeader:   { color: "#A78BFA", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: spacing.lg, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  receiptRow:      { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  receiptKey:      { color: colors.textMuted, fontSize: typography.body },
  receiptVal:      { color: "#FFFFFF", fontSize: typography.body, fontWeight: "600" },
});
