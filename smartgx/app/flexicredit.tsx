import { useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useAuthStore } from "../src/store/authStore";
import { useAccountStore } from "../src/store/accountStore";
import { useNotificationStore } from "../src/store/notificationStore";
import { useTransactionStore } from "../src/store/transactionStore";
import { useActivityStore } from "../src/store/activityStore";
import { useFlexiCreditStore, type EmploymentType, type FlexiCreditStatus } from "../src/store/flexiCreditStore";
import {
  generateDebtReadinessAnalysis,
  type BorrowPurpose,
  type ReadinessLevel,
} from "../src/features/flexiCredit/debtReadiness.service";
import { formatRM } from "../src/lib/currency";
import { safeNumber } from "../src/lib/number";
import { colors } from "../src/theme/colors";
import { radius } from "../src/theme/radius";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";
import { verifyUserPin } from "../src/features/security/sensitiveAction";
import { sensitiveActionBlockedMessage, userHasPinSet } from "../src/store/securityStore";
import { refreshChallengesForUser } from "../src/features/challenge/challengeIntegration";

type FlowStep =
  | "landing"
  | "eligibility"
  | "profile"
  | "documents"
  | "borrowing"
  | "ai_review"
  | "submit"
  | "result"
  | "activation"
  | "manage";

type LocalDocStatus = "required" | "uploaded" | "verified" | "needs_review";

interface LocalDocs {
  myKadFront: LocalDocStatus;
  myKadBack: LocalDocStatus;
  selfie: LocalDocStatus;
}

const EMPLOYMENT_OPTIONS: EmploymentType[] = [
  "salaried_employee",
  "self_employed",
  "business_owner",
  "student",
  "housewife_househusband",
  "retiree",
  "unemployed",
];

const PURPOSE_OPTIONS: BorrowPurpose[] = [
  "emergency",
  "bills_commitments",
  "home_family",
  "education",
  "medical",
  "business_cashflow",
  "shopping_lifestyle",
  "other",
];

const WIZARD_STEPS: FlowStep[] = [
  "eligibility",
  "profile",
  "documents",
  "borrowing",
  "ai_review",
  "submit",
];

const DEFAULT_ANNUAL_INTEREST_RATE = 0.06;

function stepLabel(step: FlowStep): string {
  const map: Record<FlowStep, string> = {
    landing: "Overview",
    eligibility: "Eligibility",
    profile: "Profile",
    documents: "Documents",
    borrowing: "Borrowing Preference",
    ai_review: "AI Review",
    submit: "Submit",
    result: "Result",
    activation: "Activation",
    manage: "Manage",
  };
  return map[step];
}

function formatEmployment(e: EmploymentType): string {
  return e.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPurpose(p: BorrowPurpose): string {
  return p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function estimateRepayment(principal: number, tenureMonths: number, annualRate = DEFAULT_ANNUAL_INTEREST_RATE) {
  const interest = Math.round((principal * annualRate * (tenureMonths / 12)) * 100) / 100;
  const totalRepayment = Math.round((principal + interest) * 100) / 100;
  const monthlyRepayment = tenureMonths > 0 ? Math.round((totalRepayment / tenureMonths) * 100) / 100 : 0;
  return { interest, totalRepayment, monthlyRepayment };
}

function docTone(status: LocalDocStatus) {
  if (status === "verified") return { border: "rgba(34,197,94,0.5)", bg: "rgba(34,197,94,0.12)", text: "#22C55E", label: "Verified" };
  if (status === "uploaded") return { border: "rgba(56,189,248,0.5)", bg: "rgba(56,189,248,0.12)", text: "#38BDF8", label: "Uploaded" };
  if (status === "needs_review") return { border: "rgba(245,158,11,0.5)", bg: "rgba(245,158,11,0.12)", text: "#F59E0B", label: "Needs Review" };
  return { border: "rgba(248,113,113,0.45)", bg: "rgba(248,113,113,0.1)", text: "#F87171", label: "Required" };
}

type FcBadgeTone = "green" | "amber" | "red" | "info";

function FcBadge({ label, tone }: { label: string; tone: FcBadgeTone }) {
  const toneStyle =
    tone === "green"
      ? styles.fcBadgeGreen
      : tone === "amber"
        ? styles.fcBadgeAmber
        : tone === "red"
          ? styles.fcBadgeRed
          : styles.fcBadgeInfo;
  return (
    <View style={[styles.fcBadge, toneStyle]}>
      <Text style={styles.fcBadgeText}>{label}</Text>
    </View>
  );
}

function FcKeyRow({
  label,
  value,
  valueTone = "default",
}: {
  label: string;
  value: string;
  valueTone?: "default" | "accent" | "success" | "warn" | "danger";
}) {
  const vStyle =
    valueTone === "success"
      ? styles.fcValSuccess
      : valueTone === "warn"
        ? styles.fcValWarn
        : valueTone === "danger"
          ? styles.fcValDanger
          : valueTone === "accent"
            ? styles.fcValAccent
            : styles.fcValDefault;
  return (
    <View style={styles.fcKeyRow}>
      <Text style={styles.fcKeyLabel}>{label}</Text>
      <Text style={[styles.fcKeyValue, vStyle]}>{value}</Text>
    </View>
  );
}

function fcAppStatusMeta(status: FlexiCreditStatus): { label: string; tone: FcBadgeTone } {
  switch (status) {
    case "activated":
      return { label: "Status: Activated", tone: "green" };
    case "approved":
      return { label: "Status: Approved", tone: "green" };
    case "under_review":
    case "checking_eligibility":
    case "documents_required":
      return { label: `Status: ${status.replace(/_/g, " ")}`, tone: "amber" };
    case "rejected":
      return { label: "Status: Rejected", tone: "red" };
    default:
      return { label: "Status: Not applied", tone: "info" };
  }
}

function readinessMeta(level: ReadinessLevel): {
  tone: FcBadgeTone;
} {
  if (level === "ready") return { tone: "green" };
  if (level === "cautious") return { tone: "amber" };
  if (level === "risky") return { tone: "amber" };
  return { tone: "red" };
}

function progressFor(step: FlowStep) {
  const i = WIZARD_STEPS.indexOf(step);
  if (i < 0) return null;
  return { idx: i + 1, total: WIZARD_STEPS.length };
}

export default function FlexiCreditScreen() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const account = useAccountStore();
  const notifications = useNotificationStore();
  const transactions = useTransactionStore();
  const activity = useActivityStore();
  const fc = useFlexiCreditStore();

  const hasRepaymentDue = useMemo(() => {
    const outstanding = safeNumber(fc.outstanding, 0);
    const monthly = safeNumber(fc.monthlyRepayment, 0);
    const anyPrincipal = fc.activeDrawdowns.some(
      (d) =>
        (d.status === "active" || d.status === "overdue") && safeNumber(d.remainingBalance, 0) > 0.01
    );
    return outstanding > 0.01 || monthly > 0.01 || anyPrincipal;
  }, [fc.outstanding, fc.monthlyRepayment, fc.activeDrawdowns]);

  const [step, setStep] = useState<FlowStep>(fc.status === "activated" ? "manage" : "landing");
  const [statementOpen, setStatementOpen] = useState(false);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  const [fullName, setFullName] = useState(currentUser?.fullName ?? "Jason Tan");
  const [myKadNumber, setMyKadNumber] = useState("990101141234");
  const [phoneNumber, setPhoneNumber] = useState(currentUser?.mobileNumber ?? "0123456789");
  const [email, setEmail] = useState(currentUser?.email ?? "jason@example.com");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("salaried_employee");
  const [employerOrBusinessName, setEmployerOrBusinessName] = useState("ABC Ventures Sdn Bhd");
  const [industry, setIndustry] = useState("Technology");
  const [employmentDurationMonths, setEmploymentDurationMonths] = useState("24");
  const [monthlyIncomeText, setMonthlyIncomeText] = useState(
    currentUser?.financialProfile?.monthlyIncome != null
      ? String(currentUser.financialProfile.monthlyIncome)
      : ""
  );
  const [desiredLimitText, setDesiredLimitText] = useState("4000");
  const [drawdownText, setDrawdownText] = useState("1200");
  const [tenureText, setTenureText] = useState("6");
  const [purpose, setPurpose] = useState<BorrowPurpose>("emergency");
  const [autoRepayment, setAutoRepayment] = useState(true);
  const [repaymentDay, setRepaymentDay] = useState("5");
  const [agreeDeclaration, setAgreeDeclaration] = useState(false);
  const [localDocs, setLocalDocs] = useState<LocalDocs>({
    myKadFront: "required",
    myKadBack: "required",
    selfie: "required",
  });
  const [pinGate, setPinGate] = useState<null | "drawdown" | "repay">(null);
  const [fcPin, setFcPin] = useState("");
  const [fcPinErr, setFcPinErr] = useState("");

  const monthlyIncome = Number(monthlyIncomeText) || 0;
  const desiredLimit = Number(desiredLimitText) || 0;
  const drawdownAmount = Number(drawdownText) || 0;
  const tenureMonths = Math.max(1, Number(tenureText) || 1);
  const age = 24;
  const gxScore = 68;
  const monthlyExpenses = Math.max(900, Math.round(monthlyIncome * 0.62));
  const commitments = Math.max(200, Math.round(monthlyIncome * 0.08));

  const blockedEmployment = ["student", "retiree", "housewife_househusband", "unemployed"].includes(employmentType);
  const eligibilityReasons = useMemo(() => {
    const reasons: string[] = [];
    if (age < 21 || age > 64) reasons.push("Age must be between 21 and 64.");
    if (monthlyIncome < 1500) reasons.push("Monthly income must be at least RM1,500.");
    if (blockedEmployment) reasons.push(`${formatEmployment(employmentType)} is not eligible for FlexiCredit.`);
    if (!myKadNumber || myKadNumber.length < 8) reasons.push("Valid MyKad number is required.");
    return reasons;
  }, [age, monthlyIncome, blockedEmployment, employmentType, myKadNumber]);
  const isEligible = eligibilityReasons.length === 0;

  const identityDocsOk = localDocs.myKadFront !== "required" && localDocs.myKadBack !== "required" && localDocs.selfie !== "required";
  const employmentDocRequired = employmentType === "salaried_employee" ? "epfStatement" : employmentType === "self_employed" || employmentType === "business_owner" ? "businessBank6Months" : null;
  const employmentDocOk = employmentDocRequired === null ? true : fc.docs[employmentDocRequired] !== "not_uploaded";
  const allDocsReady = identityDocsOk && employmentDocOk;

  const profileValid = Boolean(
    fullName.trim() &&
      myKadNumber.trim().length >= 8 &&
      phoneNumber.trim().length >= 9 &&
      email.includes("@") &&
      employerOrBusinessName.trim() &&
      monthlyIncome > 0 &&
      Number(employmentDurationMonths) >= 0
  );

  const borrowingValid = desiredLimit >= 1000 && drawdownAmount > 0 && drawdownAmount <= desiredLimit && tenureMonths >= 1;
  const repaymentPreview = estimateRepayment(drawdownAmount, tenureMonths, DEFAULT_ANNUAL_INTEREST_RATE);
  const progress = progressFor(step);

  const jumpBackHome = () => router.push("/dashboard" as never);

  const updateLocalDoc = (k: keyof LocalDocs, next: LocalDocStatus) => {
    setLocalDocs((prev) => ({ ...prev, [k]: next }));
  };

  const uploadIdentityDoc = (k: keyof LocalDocs) => {
    const now = Date.now();
    if (now % 5 === 0) {
      updateLocalDoc(k, "needs_review");
      return;
    }
    updateLocalDoc(k, "uploaded");
  };

  const verifyIdentityDoc = (k: keyof LocalDocs) => updateLocalDoc(k, "verified");
  const replaceIdentityDoc = (k: keyof LocalDocs) => updateLocalDoc(k, "uploaded");
  const viewIdentityDoc = (k: keyof LocalDocs) => setDocPreview(k);

  const uploadEmploymentDoc = () => {
    if (!employmentDocRequired) return;
    fc.uploadDocument(employmentDocRequired);
  };
  const replaceEmploymentDoc = () => {
    if (!employmentDocRequired) return;
    fc.setDocumentStatus(employmentDocRequired, "uploaded");
  };
  const verifyEmploymentDoc = () => {
    if (!employmentDocRequired) return;
    fc.setDocumentStatus(employmentDocRequired, "verified");
  };
  const viewEmploymentDoc = () => {
    if (!employmentDocRequired) return;
    setDocPreview(employmentDocRequired);
  };

  const handleEligibilityCheck = () => {
    fc.setStatus("checking_eligibility");
    fc.setEligibility({ ok: isEligible, reasons: eligibilityReasons });
    if (!isEligible) {
      fc.setStatus("rejected");
      notifications.addNotification({
        id: `notif-fc-ineligible-${Date.now()}`,
        title: "FlexiCredit eligibility not met",
        message: eligibilityReasons[0] ?? "Eligibility criteria not met.",
        time: new Date().toISOString(),
        read: false,
        type: "alert",
      });
      return;
    }
    fc.setStatus("documents_required");
    notifications.addNotification({
      id: `notif-fc-eligible-${Date.now()}`,
      title: "Eligibility passed",
      message: "Please complete profile and upload required documents.",
      time: new Date().toISOString(),
      read: false,
      type: "info",
    });
    setStep("profile");
  };

  const runAiReview = async () => {
    if (!borrowingValid) return;
    setAnalysisLoading(true);
    const result = await generateDebtReadinessAnalysis({
      requestedLimit: desiredLimit,
      desiredDrawdown: drawdownAmount,
      monthlyIncome,
      monthlyExpenses,
      existingMonthlyCommitments: commitments,
      gxHealthScore: gxScore,
      savingsBalance: account.mainBalance,
      emergencyBalance: 800,
      repaymentHistoryScore: 72,
      employmentType,
      documentsQuality: allDocsReady ? "good" : "partial",
      purpose,
    });
    fc.setDebtAnalysis(result);
    fc.setSafeDrawdownRecommendation(result.recommendedDrawdown);
    setAnalysisLoading(false);
  };

  const trySmallerAmount = () => {
    const next = Math.max(200, Math.round(drawdownAmount * 0.8));
    setDrawdownText(String(next));
  };

  const submitApplication = async () => {
    if (!isEligible || !profileValid || !allDocsReady || !borrowingValid || !agreeDeclaration) return;
    setSubmitting(true);
    if (!fc.debtAnalysis) await runAiReview();
    const analysis = useFlexiCreditStore.getState().debtAnalysis;
    if (!analysis) {
      setSubmitting(false);
      return;
    }

    fc.saveApplication({
      fullName,
      myKadNumber,
      age,
      citizenship: "Malaysian",
      phoneNumber,
      email,
      employmentType,
      employerOrBusinessName,
      monthlyIncome,
      industry,
      employmentDurationMonths: Number(employmentDurationMonths) || 0,
      existingMonthlyCommitments: commitments,
      existingDebtAmount: account.flexiUsed + account.flexiCreditUsed,
      repaymentHistoryScore: 72,
      gxHealthScore: gxScore,
      savingsBalance: account.mainBalance,
      desiredLimit,
      drawdownAmount,
      purpose,
      tenureMonths,
      autoRepayment,
    });

    activity.addActivity({
      id: `act-fc-submit-${Date.now()}`,
      type: "flexicredit_apply",
      title: "FlexiCredit Application Submitted",
      description: `Requested ${formatRM(desiredLimit)}`,
      timestamp: new Date().toISOString(),
      route: "/flexicredit",
    });

    if (analysis.readinessLevel === "not_recommended") {
      fc.setApproval(0, "rejected");
      setResultMessage("Application declined. Please strengthen savings and repayment capacity first.");
      notifications.addNotification({
        id: `notif-fc-rejected-${Date.now()}`,
        title: "FlexiCredit application declined",
        message: "Debt readiness is currently below safe threshold.",
        time: new Date().toISOString(),
        read: false,
        type: "alert",
      });
    } else if (analysis.readinessLevel === "risky") {
      const safeLimit = Math.round(analysis.recommendedLimit);
      fc.setApproval(safeLimit, "approved");
      setResultMessage(`Conditionally approved with safer limit ${formatRM(safeLimit)}.`);
      notifications.addNotification({
        id: `notif-fc-conditional-${Date.now()}`,
        title: "FlexiCredit conditionally approved",
        message: `Approved with safer limit ${formatRM(safeLimit)}.`,
        time: new Date().toISOString(),
        read: false,
        type: "info",
      });
    } else {
      const approved = Math.round(analysis.recommendedLimit);
      fc.setApproval(approved, "approved");
      setResultMessage(`Approved for ${formatRM(approved)}.`);
      notifications.addNotification({
        id: `notif-fc-approved-${Date.now()}`,
        title: "FlexiCredit approved",
        message: `You are approved with limit ${formatRM(approved)}.`,
        time: new Date().toISOString(),
        read: false,
        type: "info",
      });
      activity.addActivity({
        id: `act-fc-approved-${Date.now()}`,
        type: "flexicredit_approved",
        title: "FlexiCredit Approved",
        description: `Approved limit ${formatRM(approved)}`,
        timestamp: new Date().toISOString(),
        route: "/flexicredit",
      });
    }
    setSubmitting(false);
    setStep("result");
  };

  const activate = () => {
    if (fc.approvedLimit <= 0) return;
    fc.activate();
    account.setFlexiCreditLimit(fc.approvedLimit);
    notifications.addNotification({
      id: `notif-fc-activated-${Date.now()}`,
      title: "FlexiCredit activated",
      message: `Limit ${formatRM(fc.approvedLimit)} is now active.`,
      time: new Date().toISOString(),
      read: false,
      type: "info",
    });
    activity.addActivity({
      id: `act-fc-activated-${Date.now()}`,
      type: "flexicredit_activated",
      title: "FlexiCredit Activated",
      description: `Limit ${formatRM(fc.approvedLimit)} activated`,
      timestamp: new Date().toISOString(),
      route: "/flexicredit",
    });
    setStep("manage");
  };

  const openDrawdownPin = () => {
    const block = sensitiveActionBlockedMessage();
    if (block) {
      notifications.addNotification({
        id: `fc-block-${Date.now()}`,
        title: "Action unavailable",
        message: block,
        time: new Date().toISOString(),
        read: false,
        type: "alert",
      });
      return;
    }
    setFcPin("");
    setFcPinErr("");
    setPinGate("drawdown");
  };

  const openRepayPin = () => {
    if (!hasRepaymentDue) {
      notifications.addNotification({
        id: `fc-no-repay-${Date.now()}`,
        title: "No repayment due",
        message: "Your FlexiCredit is fully repaid. There is no outstanding amount to pay.",
        time: new Date().toISOString(),
        read: false,
        type: "info",
      });
      return;
    }
    const block = sensitiveActionBlockedMessage();
    if (block) {
      notifications.addNotification({
        id: `fc-block-r-${Date.now()}`,
        title: "Action unavailable",
        message: block,
        time: new Date().toISOString(),
        read: false,
        type: "alert",
      });
      return;
    }
    setFcPin("");
    setFcPinErr("");
    setPinGate("repay");
  };

  const confirmFlexiPin = async () => {
    const v = await verifyUserPin(fcPin);
    if (!v.ok) {
      setFcPinErr(v.message ?? "Incorrect PIN.");
      setFcPin("");
      return;
    }
    const gate = pinGate;
    setPinGate(null);
    setFcPin("");
    setFcPinErr("");
    if (gate === "drawdown") void drawdownCore();
    if (gate === "repay") repayCore();
  };

  const drawdownCore = async () => {
    if (fc.status !== "activated") return;
    if (!fc.debtAnalysis) await runAiReview();
    const analysis = useFlexiCreditStore.getState().debtAnalysis;
    if (!analysis) return;
    const repayment = estimateRepayment(drawdownAmount, tenureMonths, DEFAULT_ANNUAL_INTEREST_RATE);
    const monthlyNeed = repayment.monthlyRepayment;
    const safeDrawdown = fc.safeDrawdownRecommendation > 0 ? fc.safeDrawdownRecommendation : analysis.recommendedDrawdown;
    if (
      analysis.readinessLevel === "not_recommended" ||
      monthlyNeed > analysis.repaymentCapacity ||
      drawdownAmount > account.flexiCreditLimit - account.flexiCreditUsed
    ) {
      notifications.addNotification({
        id: `notif-fc-drawdown-block-${Date.now()}`,
        title: "Drawdown blocked by Debt Guard",
        message: "Requested amount exceeds safe repayment capacity. Try smaller amount.",
        time: new Date().toISOString(),
        read: false,
        type: "risk",
      });
      return;
    }
    if (analysis.readinessLevel === "risky" && drawdownAmount > safeDrawdown) {
      notifications.addNotification({
        id: `notif-fc-drawdown-risky-${Date.now()}`,
        title: "Risky drawdown amount",
        message: `SmartGX recommends ${formatRM(safeDrawdown)} for safer repayment.`,
        time: new Date().toISOString(),
        read: false,
        type: "risk",
      });
      return;
    }
    const res = account.drawdownFlexiCredit(drawdownAmount);
    if (!res.ok) {
      notifications.addNotification({
        id: `notif-fc-drawdown-fail-${Date.now()}`,
        title: "Drawdown not completed",
        message: "Requested amount exceeds available FlexiCredit limit.",
        time: new Date().toISOString(),
        read: false,
        type: "alert",
      });
      return;
    }
    fc.drawdown(drawdownAmount, purpose, tenureMonths, DEFAULT_ANNUAL_INTEREST_RATE);
    transactions.addTransaction({
      id: `t-fc-draw-${Date.now()}`,
      userId: currentUser?.id ?? "",
      merchant: "FlexiCredit Drawdown",
      category: "others",
      amount: drawdownAmount,
      type: "credit_drawdown",
      paymentMethod: "online_transfer",
      transactionDate: new Date().toISOString().slice(0, 10),
      riskLevel: "medium",
      isSuspicious: false,
      note: `Purpose: ${purpose}`,
      occurredAt: new Date().toISOString(),
    });
    notifications.addNotification({
      id: `notif-fc-draw-${Date.now()}`,
      title: "Drawdown completed",
      message: `${formatRM(drawdownAmount)} credited. Monthly repayment ${formatRM(repayment.monthlyRepayment)} includes interest.`,
      time: new Date().toISOString(),
      read: false,
      type: "info",
    });
    activity.addActivity({
      id: `act-fc-draw-${Date.now()}`,
      type: "flexicredit_drawdown",
      title: "FlexiCredit Drawdown",
      description: `${formatRM(drawdownAmount)} credited to Main Account`,
      amount: drawdownAmount,
      direction: "credit",
      timestamp: new Date().toISOString(),
      route: "/flexicredit",
    });
    refreshChallengesForUser(useAuthStore.getState().currentUser?.id);
  };

  const repayCore = () => {
    if (!hasRepaymentDue) {
      notifications.addNotification({
        id: `fc-no-repay-core-${Date.now()}`,
        title: "No repayment due",
        message: "Nothing to repay right now.",
        time: new Date().toISOString(),
        read: false,
        type: "info",
      });
      return;
    }
    const target = fc.activeDrawdowns.find((d) => d.status === "active");
    const amount = Math.min((target?.monthlyRepayment ?? fc.monthlyRepayment ?? 200), account.mainBalance);
    if (amount <= 0) return;
    const principalPortion =
      target && target.totalRepayment > 0
        ? Math.round((amount * (target.principalAmount / target.totalRepayment)) * 100) / 100
        : amount;
    const res = account.repayFlexiCredit(amount, principalPortion);
    if (!res.ok) return;
    fc.repay(amount, target?.drawdownId);
    const latestRepayment = useFlexiCreditStore.getState().repaymentHistory[0];
    const rpPrincipal = latestRepayment?.principalPortion ?? principalPortion;
    const rpInterest = latestRepayment?.interestPortion ?? Math.max(0, Math.round((amount - principalPortion) * 100) / 100);
    transactions.addTransaction({
      id: `t-fc-repay-${Date.now()}`,
      userId: currentUser?.id ?? "",
      merchant: "FlexiCredit Repayment",
      category: "bills",
      amount,
      type: "repayment",
      paymentMethod: "auto_debit",
      transactionDate: new Date().toISOString().slice(0, 10),
      riskLevel: "low",
      isSuspicious: false,
      note: "FlexiCredit repayment",
      occurredAt: new Date().toISOString(),
    });
    notifications.addNotification({
      id: `notif-fc-repay-${Date.now()}`,
      title: "Repayment successful",
      message: `${formatRM(amount)} repaid (${formatRM(rpPrincipal)} principal, ${formatRM(rpInterest)} interest).`,
      time: new Date().toISOString(),
      read: false,
      type: "insight",
    });
    activity.addActivity({
      id: `act-fc-repay-${Date.now()}`,
      type: "flexicredit_repayment",
      title: "FlexiCredit Repayment",
      description: `${formatRM(amount)} repaid`,
      amount,
      direction: "debit",
      timestamp: new Date().toISOString(),
      route: "/flexicredit",
    });
  };

  const appStatusBadge = fcAppStatusMeta(fc.status);

  if (!currentUser) return <Redirect href="/auth/login" />;
  if (!userHasPinSet()) return <Redirect href="/auth/app-pin-setup" />;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#12082E" />

      <Modal visible={pinGate !== null} transparent animationType="fade" onRequestClose={() => { setPinGate(null); setFcPin(""); setFcPinErr(""); }}>
        <View style={styles.pinOverlay}>
          <View style={styles.pinCard}>
            <Text style={styles.pinTitle}>{pinGate === "repay" ? "Confirm repayment" : "Confirm drawdown"}</Text>
            <Text style={styles.pinSub}>Enter your 6-digit SmartGX PIN.</Text>
            <TextInput
              style={styles.pinInput}
              value={fcPin}
              onChangeText={(t) => { setFcPin(t.replace(/\D/g, "").slice(0, 6)); setFcPinErr(""); }}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              placeholder="••••••"
              placeholderTextColor={colors.textMuted}
            />
            {fcPinErr ? <Text style={styles.pinErr}>{fcPinErr}</Text> : null}
            <View style={styles.pinBtns}>
              <Pressable style={styles.pinGhost} onPress={() => { setPinGate(null); setFcPin(""); setFcPinErr(""); }}>
                <Text style={styles.pinGhostText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.pinPrimary, fcPin.length < 6 && { opacity: 0.45 }]} onPress={confirmFlexiPin} disabled={fcPin.length < 6}>
                <Text style={styles.pinPrimaryText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={["#3B1578", "#2D0D6B", "#1A0845", "#070B14"]}
          locations={[0, 0.4, 0.75, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.hero}
        >
          <Pressable style={styles.backBtn} onPress={jumpBackHome}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18L9 12L15 6" stroke="#C4B5FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text style={styles.heroTitle}>FlexiCredit</Text>
          <Text style={styles.heroSub}>Smart credit support with AI debt protection</Text>
          <FcBadge label={appStatusBadge.label} tone={appStatusBadge.tone} />
          {progress ? (
            <Text style={styles.progressText}>Step {progress.idx} of {progress.total} · {stepLabel(step)}</Text>
          ) : (
            <Text style={styles.progressText}>Guided journey with document verification</Text>
          )}
        </LinearGradient>

        {step === "landing" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Responsible Credit, Guided by SmartGX</Text>
            <Text style={styles.muted}>
              FlexiCredit pairs a credit line with affordability checks, safer drawdown guidance, and clear repayment visibility.
            </Text>
            <View style={styles.fcBulletBlock}>
              <Text style={styles.fcBullet}>
                • <Text style={styles.fcEm}>Affordability</Text> — income, expenses, and commitments reviewed before approval.
              </Text>
              <Text style={styles.fcBullet}>
                • <Text style={styles.fcEm}>SmartGX Safe Drawdown</Text> — recommended amount sized to repayment capacity.
              </Text>
              <Text style={styles.fcBullet}>
                • <Text style={styles.fcEm}>AI debt readiness</Text> — score, risks, and actions before you submit.
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>AI Debt Protection</Text>
              <FcKeyRow label="Readiness score" value="Rule-based + optional AI review" valueTone="accent" />
              <FcKeyRow label="Safer limit" value="Recommended cap vs requested limit" valueTone="accent" />
              <FcKeyRow label="Repayment stress" value="Warnings when tenure or amount strains cashflow" valueTone="warn" />
            </View>
            <View style={styles.ctaRow}>
              <Pressable style={styles.btnGhost} onPress={jumpBackHome}>
                <Text style={styles.btnGhostText}>Back to Home</Text>
              </Pressable>
              <Pressable
                style={styles.btn}
                onPress={() => setStep(fc.status === "activated" ? "manage" : "eligibility")}
              >
                <Text style={styles.btnText}>
                  {fc.status === "not_applied"
                    ? "Start Application"
                    : fc.status === "activated"
                      ? "Manage FlexiCredit"
                      : "Continue Application"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === "eligibility" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Eligibility Check</Text>
            <FcBadge
              label={isEligible ? "Eligibility: Passed" : "Eligibility: Not met"}
              tone={isEligible ? "green" : "amber"}
            />
            <View style={styles.fcBulletBlock}>
              <Text style={styles.fcBullet}>
                • <Text style={styles.fcEm}>Age</Text> — 21–64 · <Text style={styles.fcEm}>MyKad</Text> holder · Malaysian
              </Text>
              <Text style={styles.fcBullet}>
                • <Text style={styles.fcEm}>Income</Text> — at least <Text style={styles.fcEm}>RM1,500</Text> / month
              </Text>
              <Text style={styles.fcBullet}>
                • <Text style={styles.fcEm}>Employment</Text> — active earning profile (student / retiree / unemployed blocked)
              </Text>
            </View>
            <Text style={styles.fieldLabel}>Employment type</Text>
            <View style={styles.rowWrap}>
              {EMPLOYMENT_OPTIONS.map((e) => (
                <Pressable key={e} style={[styles.pill, employmentType === e && styles.pillOn]} onPress={() => setEmploymentType(e)}>
                  <Text style={styles.pillText}>{formatEmployment(e)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Monthly income</Text>
            <TextInput
              style={styles.input}
              value={monthlyIncomeText}
              onChangeText={setMonthlyIncomeText}
              keyboardType="numeric"
              placeholder="Monthly income"
              placeholderTextColor={colors.textMuted}
            />
            {!isEligible ? (
              <FcKeyRow label="Eligibility detail" value={eligibilityReasons[0] ?? "Check inputs"} valueTone="warn" />
            ) : (
              <FcKeyRow label="Eligibility result" value="You may continue to profile" valueTone="success" />
            )}
            <View style={styles.ctaRow}>
              <Pressable style={styles.btnGhost} onPress={() => setStep("landing")}>
                <Text style={styles.btnGhostText}>Back</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={handleEligibilityCheck}>
                <Text style={styles.btnText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === "profile" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Personal & Employment Details</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Full name" placeholderTextColor={colors.textMuted} />
            <TextInput style={styles.input} value={myKadNumber} onChangeText={setMyKadNumber} placeholder="MyKad number" placeholderTextColor={colors.textMuted} />
            <TextInput style={styles.input} value={phoneNumber} onChangeText={setPhoneNumber} placeholder="Phone number" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.textMuted} keyboardType="email-address" />
            <TextInput style={styles.input} value={employerOrBusinessName} onChangeText={setEmployerOrBusinessName} placeholder="Employer / Business name" placeholderTextColor={colors.textMuted} />
            <TextInput style={styles.input} value={industry} onChangeText={setIndustry} placeholder="Industry" placeholderTextColor={colors.textMuted} />
            <TextInput
              style={styles.input}
              value={employmentDurationMonths}
              onChangeText={setEmploymentDurationMonths}
              placeholder="Employment duration (months)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
            <View style={styles.ctaRow}>
              <Pressable style={styles.btnGhost} onPress={() => setStep("eligibility")}>
                <Text style={styles.btnGhostText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, !profileValid && styles.btnDisabled]}
                onPress={() => setStep("documents")}
                disabled={!profileValid}
              >
                <Text style={styles.btnText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === "documents" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Required Documents</Text>
            <FcBadge
              label={allDocsReady ? "Document status: Ready" : "Document status: Action needed"}
              tone={allDocsReady ? "green" : "amber"}
            />
            <Text style={styles.muted}>Upload and verify identity and income proof before borrowing.</Text>

            {(["myKadFront", "myKadBack", "selfie"] as Array<keyof LocalDocs>).map((k) => {
              const tone = docTone(localDocs[k]);
              const label = k === "myKadFront" ? "MyKad Front" : k === "myKadBack" ? "MyKad Back" : "Selfie Verification";
              return (
                <View key={k} style={[styles.docCard, { borderColor: tone.border, backgroundColor: tone.bg }]}>
                  <View style={styles.docTop}>
                    <Text style={styles.docTitle}>{label}</Text>
                    <Text style={[styles.docStatus, { color: tone.text }]}>{tone.label}</Text>
                  </View>
                  <View style={styles.docActionRow}>
                    <Pressable style={styles.docBtn} onPress={() => uploadIdentityDoc(k)}>
                      <Text style={styles.docBtnText}>Upload</Text>
                    </Pressable>
                    <Pressable style={styles.docBtn} onPress={() => replaceIdentityDoc(k)}>
                      <Text style={styles.docBtnText}>Replace</Text>
                    </Pressable>
                    <Pressable style={styles.docBtn} onPress={() => viewIdentityDoc(k)}>
                      <Text style={styles.docBtnText}>View</Text>
                    </Pressable>
                    <Pressable style={styles.docBtn} onPress={() => verifyIdentityDoc(k)}>
                      <Text style={styles.docBtnText}>Verify</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

            {employmentDocRequired && (
              <View
                style={[
                  styles.docCard,
                  fc.docs[employmentDocRequired] === "verified"
                    ? { borderColor: "rgba(34,197,94,0.5)", backgroundColor: "rgba(34,197,94,0.12)" }
                    : fc.docs[employmentDocRequired] === "uploaded"
                      ? { borderColor: "rgba(56,189,248,0.5)", backgroundColor: "rgba(56,189,248,0.12)" }
                      : fc.docs[employmentDocRequired] === "needs_review"
                        ? { borderColor: "rgba(245,158,11,0.5)", backgroundColor: "rgba(245,158,11,0.12)" }
                        : { borderColor: "rgba(248,113,113,0.45)", backgroundColor: "rgba(248,113,113,0.1)" },
                ]}
              >
                <View style={styles.docTop}>
                  <Text style={styles.docTitle}>
                    {employmentDocRequired === "epfStatement" ? "EPF Statement" : "Business Bank Statements (6 months)"}
                  </Text>
                  <Text
                    style={[
                      styles.docStatus,
                      fc.docs[employmentDocRequired] === "verified"
                        ? { color: "#22C55E" }
                        : fc.docs[employmentDocRequired] === "uploaded"
                          ? { color: "#38BDF8" }
                          : fc.docs[employmentDocRequired] === "needs_review"
                            ? { color: "#F59E0B" }
                            : { color: "#F87171" },
                    ]}
                  >
                    {fc.docs[employmentDocRequired] === "not_uploaded" ? "Required" : fc.docs[employmentDocRequired].replace(/_/g, " ")}
                  </Text>
                </View>
                <View style={styles.docActionRow}>
                  <Pressable style={styles.docBtn} onPress={uploadEmploymentDoc}>
                    <Text style={styles.docBtnText}>Upload</Text>
                  </Pressable>
                  <Pressable style={styles.docBtn} onPress={replaceEmploymentDoc}>
                    <Text style={styles.docBtnText}>Replace</Text>
                  </Pressable>
                  <Pressable style={styles.docBtn} onPress={viewEmploymentDoc}>
                    <Text style={styles.docBtnText}>View</Text>
                  </Pressable>
                  <Pressable style={styles.docBtn} onPress={verifyEmploymentDoc}>
                    <Text style={styles.docBtnText}>Verify</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {docPreview ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>Document Preview</Text>
                <Text style={styles.muted}>Preview ready for {docPreview.replace(/([A-Z])/g, " $1").trim()}.</Text>
              </View>
            ) : null}

            <View style={styles.ctaRow}>
              <Pressable style={styles.btnGhost} onPress={() => setStep("profile")}>
                <Text style={styles.btnGhostText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, !allDocsReady && styles.btnDisabled]}
                onPress={() => setStep("borrowing")}
                disabled={!allDocsReady}
              >
                <Text style={styles.btnText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === "borrowing" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Borrowing Preference</Text>
            <Text style={styles.muted}>
              Preferences below feed SmartGX assessment. <Text style={styles.fcEm}>Approved limit</Text> and{" "}
              <Text style={styles.fcEm}>SmartGX Safe Drawdown</Text> may differ from what you request.
            </Text>
            <TextInput style={styles.input} value={desiredLimitText} onChangeText={setDesiredLimitText} keyboardType="numeric" placeholder="Requested credit limit" placeholderTextColor={colors.textMuted} />
            <TextInput style={styles.input} value={drawdownText} onChangeText={setDrawdownText} keyboardType="numeric" placeholder="Preferred first drawdown amount" placeholderTextColor={colors.textMuted} />
            <TextInput style={styles.input} value={tenureText} onChangeText={setTenureText} keyboardType="numeric" placeholder="Preferred tenure (months)" placeholderTextColor={colors.textMuted} />
            <TextInput style={styles.input} value={repaymentDay} onChangeText={setRepaymentDay} keyboardType="numeric" placeholder="Preferred repayment day (1-28)" placeholderTextColor={colors.textMuted} />
            <Text style={styles.fieldLabel}>Purpose</Text>
            <View style={styles.rowWrap}>
              {PURPOSE_OPTIONS.map((p) => (
                <Pressable key={p} style={[styles.pill, purpose === p && styles.pillOn]} onPress={() => setPurpose(p)}>
                  <Text style={styles.pillText}>{formatPurpose(p)}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.toggleRow} onPress={() => setAutoRepayment((v) => !v)}>
              <Text style={styles.toggleLabel}>Auto repayment</Text>
              <Text style={styles.toggleValue}>{autoRepayment ? "Enabled" : "Disabled"}</Text>
            </Pressable>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Repayment preview (estimate)</Text>
              <FcKeyRow label="Annual interest rate" value={`${(DEFAULT_ANNUAL_INTEREST_RATE * 100).toFixed(2)}% p.a.`} valueTone="accent" />
              <FcKeyRow label="Estimated interest" value={formatRM(repaymentPreview.interest)} valueTone="accent" />
              <FcKeyRow label="Total repayment" value={formatRM(repaymentPreview.totalRepayment)} valueTone="accent" />
              <FcKeyRow label="Monthly repayment" value={formatRM(repaymentPreview.monthlyRepayment)} valueTone="success" />
            </View>
            <View style={styles.ctaRow}>
              <Pressable style={styles.btnGhost} onPress={() => setStep("documents")}>
                <Text style={styles.btnGhostText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, !borrowingValid && styles.btnDisabled]}
                onPress={() => setStep("ai_review")}
                disabled={!borrowingValid}
              >
                <Text style={styles.btnText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === "ai_review" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>AI Debt Readiness Review</Text>
            <Text style={styles.muted}>
              SmartGX evaluates readiness score, repayment capacity, purpose risk, savings resilience, and debt pressure before submission.
            </Text>
            <Pressable style={styles.btn} onPress={runAiReview} disabled={analysisLoading}>
              <Text style={styles.btnText}>{analysisLoading ? "Analyzing..." : "Run AI Review"}</Text>
            </Pressable>
            {fc.debtAnalysis ? (
              <View style={styles.analysis}>
                <FcBadge
                  label={`Readiness level: ${fc.debtAnalysis.readinessLevel.replace(/_/g, " ")}`}
                  tone={readinessMeta(fc.debtAnalysis.readinessLevel).tone}
                />
                <FcKeyRow label="Readiness score" value={`${fc.debtAnalysis.debtReadinessScore}`} valueTone="accent" />
                {(() => {
                  const blocked = fc.debtAnalysis.readinessLevel === "not_recommended";
                  const over =
                    fc.debtAnalysis.readinessLevel === "risky" && drawdownAmount > fc.debtAnalysis.recommendedDrawdown;
                  const gateLabel = blocked
                    ? "Decision gate: Blocked — improve risk before proceeding"
                    : over
                      ? "Decision gate: Reduce to safe drawdown or smaller"
                      : "Decision gate: Cleared for your current preference";
                  const gateTone: FcBadgeTone = blocked ? "red" : over ? "amber" : "green";
                  return <FcBadge label={gateLabel} tone={gateTone} />;
                })()}
                <FcKeyRow label="Requested drawdown" value={formatRM(drawdownAmount)} valueTone="accent" />
                <FcKeyRow label="Recommended credit limit" value={formatRM(fc.debtAnalysis.recommendedLimit)} valueTone="accent" />
                <FcKeyRow
                  label="SmartGX Safe Drawdown"
                  value={formatRM(fc.debtAnalysis.recommendedDrawdown)}
                  valueTone="success"
                />
                <FcKeyRow
                  label="Repayment capacity"
                  value={`${formatRM(fc.debtAnalysis.repaymentCapacity)} / month`}
                  valueTone="accent"
                />
                <FcKeyRow
                  label="Estimated monthly repayment"
                  value={`${formatRM(repaymentPreview.monthlyRepayment)} / month`}
                  valueTone="accent"
                />
                <Text style={styles.infoTitle}>Risk factors</Text>
                {fc.debtAnalysis.riskFactors.map((r) => (
                  <Text key={r} style={styles.fcRiskLine}>
                    • {r}
                  </Text>
                ))}
                <Text style={styles.infoTitle}>Strengths</Text>
                {fc.debtAnalysis.positiveFactors.map((r) => (
                  <Text key={r} style={styles.fcPosLine}>
                    • {r}
                  </Text>
                ))}
                <Text style={styles.infoTitle}>AI explanation</Text>
                <Text style={styles.fcNarrative}>{fc.debtAnalysis.aiExplanation}</Text>
                <Text style={styles.infoTitle}>Recommended actions</Text>
                {fc.debtAnalysis.recommendedActions.map((a) => (
                  <Text key={a} style={styles.docItem}>
                    - {a}
                  </Text>
                ))}
              </View>
            ) : null}
            <View style={styles.ctaColumn}>
              <Pressable style={styles.btnGhost} onPress={() => setStep("borrowing")}>
                <Text style={styles.btnGhostText}>Back</Text>
              </Pressable>
              <Pressable style={styles.btnGhost} onPress={trySmallerAmount}>
                <Text style={styles.btnGhostText}>Reduce Amount</Text>
              </Pressable>
              <Pressable
                style={styles.btnGhost}
                onPress={() => {
                  if (!fc.debtAnalysis) return;
                  setDrawdownText(String(Math.round(fc.debtAnalysis.recommendedDrawdown)));
                }}
              >
                <Text style={styles.btnGhostText}>Use Recommended Amount</Text>
              </Pressable>
              <Pressable style={styles.btnGhost} onPress={() => router.push("/savings" as never)}>
                <Text style={styles.btnGhostText}>Save Instead</Text>
              </Pressable>
              <Pressable style={styles.btnGhost} onPress={() => setStep("landing")}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.btn,
                  (!fc.debtAnalysis ||
                    fc.debtAnalysis.readinessLevel === "not_recommended" ||
                    (fc.debtAnalysis.readinessLevel === "risky" && drawdownAmount > fc.debtAnalysis.recommendedDrawdown)) &&
                    styles.btnDisabled,
                ]}
                onPress={() => setStep("submit")}
                disabled={
                  !fc.debtAnalysis ||
                  fc.debtAnalysis.readinessLevel === "not_recommended" ||
                  (fc.debtAnalysis.readinessLevel === "risky" && drawdownAmount > fc.debtAnalysis.recommendedDrawdown)
                }
              >
                <Text style={styles.btnText}>Proceed to Submit</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === "submit" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Submit Application</Text>
            <Text style={styles.muted}>Review all details before final submission.</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Application summary</Text>
              <FcKeyRow label="Name" value={fullName} />
              <FcKeyRow label="Employment" value={formatEmployment(employmentType)} />
              <FcKeyRow label="Monthly income" value={formatRM(monthlyIncome)} valueTone="accent" />
              <FcKeyRow label="Requested credit limit" value={formatRM(desiredLimit)} valueTone="accent" />
              <FcKeyRow label="Drawdown request" value={formatRM(drawdownAmount)} valueTone="accent" />
              <FcKeyRow label="Purpose" value={formatPurpose(purpose)} valueTone="accent" />
            </View>
            <Pressable style={styles.toggleRow} onPress={() => setAgreeDeclaration((v) => !v)}>
              <Text style={styles.toggleLabel}>I confirm submitted data is accurate</Text>
              <Text style={styles.toggleValue}>{agreeDeclaration ? "Checked" : "Unchecked"}</Text>
            </Pressable>
            <View style={styles.ctaRow}>
              <Pressable style={styles.btnGhost} onPress={() => setStep("ai_review")}>
                <Text style={styles.btnGhostText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, (!agreeDeclaration || submitting) && styles.btnDisabled]}
                onPress={submitApplication}
                disabled={!agreeDeclaration || submitting}
              >
                <Text style={styles.btnText}>{submitting ? "Submitting..." : "Submit Application"}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === "result" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Application Result</Text>
            <FcBadge
              label={
                fc.status === "approved"
                  ? "Application result: Approved"
                  : fc.status === "rejected"
                    ? "Application result: Rejected"
                    : "Application result: Under review"
              }
              tone={fc.status === "approved" ? "green" : fc.status === "rejected" ? "red" : "amber"}
            />
            <Text style={styles.fcNarrative}>{resultMessage || "Your application result is ready."}</Text>
            {fc.status === "approved" ? (
              <View style={styles.infoBox}>
                <FcKeyRow label="Approved limit" value={formatRM(fc.approvedLimit)} valueTone="success" />
                <FcKeyRow
                  label="SmartGX Safe Drawdown"
                  value={formatRM(fc.safeDrawdownRecommendation || fc.debtAnalysis?.recommendedDrawdown || 0)}
                  valueTone="success"
                />
                <FcKeyRow
                  label="Interest example (6% p.a.)"
                  value={`${formatRM(estimateRepayment(1000, 12).interest)} on RM1,000 / 12 mo`}
                  valueTone="accent"
                />
              </View>
            ) : null}
            <View style={styles.ctaRow}>
              <Pressable style={styles.btnGhost} onPress={jumpBackHome}>
                <Text style={styles.btnGhostText}>Return Home</Text>
              </Pressable>
              {fc.status === "approved" ? (
                <Pressable style={styles.btn} onPress={() => setStep("activation")}>
                  <Text style={styles.btnText}>Activate FlexiCredit</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.btn} onPress={() => router.push("/savings" as never)}>
                  <Text style={styles.btnText}>Go to Saving & Automation</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {step === "activation" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Activate FlexiCredit</Text>
            <FcKeyRow label="Approved limit" value={formatRM(fc.approvedLimit)} valueTone="success" />
            <Text style={styles.muted}>Borrowed funds must be repaid on schedule; late payments can lower GXHealth.</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Before you activate</Text>
              <FcKeyRow
                label="SmartGX Safe Drawdown"
                value={formatRM(fc.debtAnalysis?.recommendedDrawdown ?? 0)}
                valueTone="accent"
              />
              <FcKeyRow
                label="Repayment capacity"
                value={`${formatRM(fc.debtAnalysis?.repaymentCapacity ?? 0)} / month`}
                valueTone="accent"
              />
              <FcKeyRow
                label="Annual interest rate"
                value={`${(DEFAULT_ANNUAL_INTEREST_RATE * 100).toFixed(2)}% p.a.`}
                valueTone="accent"
              />
            </View>
            <View style={styles.ctaRow}>
              <Pressable style={styles.btnGhost} onPress={() => setStep("result")}>
                <Text style={styles.btnGhostText}>Back</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={activate}>
                <Text style={styles.btnText}>Activate</Text>
              </Pressable>
            </View>
          </View>
        )}

        {(step === "manage" || fc.status === "activated") && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Manage FlexiCredit</Text>
            <FcBadge label="Line status: Active" tone="green" />
            <View style={styles.infoBox}>
              <FcKeyRow label="Available credit" value={formatRM(fc.availableLimit)} valueTone="accent" />
              <FcKeyRow label="Outstanding balance" value={formatRM(fc.outstanding)} valueTone="warn" />
              <FcKeyRow
                label="SmartGX Safe Drawdown"
                value={formatRM(fc.safeDrawdownRecommendation || fc.debtAnalysis?.recommendedDrawdown || 0)}
                valueTone="success"
              />
            </View>
            <Text style={styles.muted}>
              <Text style={styles.fcEm}>Available credit</Text> is your technical limit.{" "}
              <Text style={styles.fcEm}>SmartGX Safe Drawdown</Text> is what SmartGX recommends for manageable repayments.
            </Text>
            <FcKeyRow label="Next repayment date" value={fc.nextRepaymentDate ?? "—"} valueTone="accent" />
            <FcKeyRow label="Monthly repayment due" value={formatRM(fc.monthlyRepayment || 0)} valueTone="accent" />
            {!hasRepaymentDue ? (
              <Text style={styles.repayStatusHint}>Fully repaid — no repayment due right now.</Text>
            ) : null}
            <TextInput style={styles.input} value={drawdownText} onChangeText={setDrawdownText} keyboardType="numeric" placeholder="Drawdown amount" placeholderTextColor={colors.textMuted} />
            <TextInput style={styles.input} value={tenureText} onChangeText={setTenureText} keyboardType="numeric" placeholder="Tenure months" placeholderTextColor={colors.textMuted} />
            <View style={styles.ctaColumn}>
              <Pressable
                style={styles.btnGhost}
                onPress={() => setDrawdownText(String(Math.round(fc.safeDrawdownRecommendation || fc.debtAnalysis?.recommendedDrawdown || 0)))}
              >
                <Text style={styles.btnGhostText}>Use Recommended Amount</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={openDrawdownPin}>
                <Text style={styles.btnText}>Drawdown Funds</Text>
              </Pressable>
              <Pressable
                style={[styles.btnGhost, !hasRepaymentDue ? styles.btnDisabled : null]}
                onPress={openRepayPin}
                disabled={!hasRepaymentDue}
              >
                <Text style={[styles.btnGhostText, !hasRepaymentDue ? styles.btnGhostTextDisabled : null]}>
                  {hasRepaymentDue ? "Make Repayment" : "No repayment due"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.btnGhost}
                onPress={() => {
                  fc.toggleAutoRepayment();
                  const on = useFlexiCreditStore.getState().autoRepaymentEnabled;
                  notifications.addNotification({
                    id: `notif-fc-auto-${Date.now()}`,
                    title: "Auto repayment updated",
                    message: `Auto repayment ${on ? "enabled" : "disabled"}.`,
                    time: new Date().toISOString(),
                    read: false,
                    type: "info",
                  });
                }}
              >
                <Text style={styles.btnGhostText}>Auto Repayment: {fc.autoRepaymentEnabled ? "Enabled" : "Disabled"}</Text>
              </Pressable>
              <Pressable style={styles.btnGhost} onPress={() => setStatementOpen((v) => !v)}>
                <Text style={styles.btnGhostText}>{statementOpen ? "Hide Statement" : "View Statement"}</Text>
              </Pressable>
            </View>
            {statementOpen ? (
              <View style={styles.analysis}>
                <Text style={styles.infoTitle}>Statement summary</Text>
                {fc.activeDrawdowns.length === 0 && fc.repaymentHistory.length === 0 ? (
                  <Text style={styles.muted}>No statement entries yet.</Text>
                ) : null}
                {fc.activeDrawdowns.slice(0, 8).map((d) => (
                  <View key={d.drawdownId} style={styles.fcStatementCard}>
                    <FcKeyRow label="Drawdown principal" value={formatRM(d.principalAmount)} valueTone="accent" />
                    <FcKeyRow label="Purpose" value={formatPurpose(d.purpose)} />
                    <FcKeyRow label="Posted" value={d.createdAt.slice(0, 10)} />
                    <FcKeyRow label="Outstanding" value={formatRM(d.remainingBalance)} valueTone="warn" />
                    <FcKeyRow label="Next due" value={d.nextDueDate} valueTone="accent" />
                    <FcKeyRow
                      label="Drawdown status"
                      value={d.status}
                      valueTone={d.status === "overdue" ? "danger" : d.status === "active" ? "warn" : "success"}
                    />
                  </View>
                ))}
                {fc.repaymentHistory.slice(0, 8).map((r) => (
                  <View key={r.id} style={styles.fcStatementCard}>
                    <FcKeyRow label="Repayment total" value={formatRM(r.amount)} valueTone="success" />
                    <FcKeyRow label="Principal portion" value={formatRM(r.principalPortion)} valueTone="accent" />
                    <FcKeyRow label="Interest portion" value={formatRM(r.interestPortion)} valueTone="accent" />
                    <FcKeyRow label="Date" value={r.date.slice(0, 10)} />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 80, gap: spacing.md },
  hero: {
    marginTop: -2,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  backBtn: { padding: spacing.xs, alignSelf: "flex-start", marginBottom: spacing.xs },
  heroTitle: { color: "#FFFFFF", fontSize: typography.title, fontWeight: "800", letterSpacing: -0.3 },
  heroSub: { color: "#C4B5FD", fontSize: typography.body, opacity: 0.9 },
  progressText: { color: "#C4B5FD", fontSize: typography.caption, marginTop: spacing.xs, opacity: 0.85 },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { color: colors.textPrimary, fontSize: typography.subheading, fontWeight: "800" },
  value: { color: "#22C55E", fontSize: typography.body, fontWeight: "800" },
  muted: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 18 },
  fcBulletBlock: { gap: 6, marginTop: 4 },
  fcBullet: { color: colors.textSecondary, fontSize: typography.caption, lineHeight: 18 },
  fcEm: { fontWeight: "800", color: "#C4B5FD" },
  fcBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderWidth: 1,
  },
  fcBadgeGreen: { backgroundColor: "rgba(34,197,94,0.15)", borderColor: "rgba(34,197,94,0.45)" },
  fcBadgeAmber: { backgroundColor: "rgba(245,158,11,0.14)", borderColor: "rgba(245,158,11,0.45)" },
  fcBadgeRed: { backgroundColor: "rgba(248,113,113,0.12)", borderColor: "rgba(248,113,113,0.45)" },
  fcBadgeInfo: { backgroundColor: "rgba(56,189,248,0.12)", borderColor: "rgba(56,189,248,0.4)" },
  fcBadgeText: { fontSize: 11, fontWeight: "800", color: colors.textPrimary, textTransform: "uppercase", letterSpacing: 0.4 },
  fcKeyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  fcKeyLabel: { flex: 1, color: colors.textMuted, fontSize: typography.caption, fontWeight: "600" },
  fcKeyValue: { maxWidth: "58%", textAlign: "right", fontSize: typography.caption, fontWeight: "800" },
  fcValDefault: { color: colors.textSecondary },
  fcValAccent: { color: "#A78BFA" },
  fcValSuccess: { color: "#22C55E" },
  fcValWarn: { color: "#F59E0B" },
  fcValDanger: { color: "#F87171" },
  fcRiskLine: { color: "#F87171", fontSize: 11, lineHeight: 16, fontWeight: "600" },
  fcPosLine: { color: "#22C55E", fontSize: 11, lineHeight: 16, fontWeight: "600" },
  fcNarrative: { color: colors.textSecondary, fontSize: typography.caption, lineHeight: 20, fontWeight: "600" },
  fcStatementCard: {
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.35)",
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
    marginTop: spacing.xs,
    backgroundColor: "rgba(124,58,237,0.06)",
  },
  fieldLabel: { color: "#A78BFA", fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: spacing.xs },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: colors.textPrimary,
  },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  pillOn: { borderColor: "#7C3AED", backgroundColor: "rgba(124,58,237,0.2)" },
  pillText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  btn: {
    flex: 1,
    minHeight: 46,
    backgroundColor: "#7C3AED",
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: typography.body, textAlign: "center" },
  btnGhost: {
    flex: 1,
    minHeight: 46,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
  },
  btnGhostText: { color: colors.textSecondary, fontWeight: "700", fontSize: typography.body, textAlign: "center" },
  btnGhostTextDisabled: { color: colors.textMuted },
  btnDisabled: { opacity: 0.45 },
  repayStatusHint: { color: "#4ADE80", fontSize: typography.caption, fontWeight: "700", marginTop: 4 },
  ctaRow: { flexDirection: "row", gap: 10, marginTop: spacing.sm },
  ctaColumn: { gap: 8, marginTop: spacing.sm },
  infoBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.35)",
    backgroundColor: "rgba(124,58,237,0.1)",
    padding: spacing.md,
    gap: 4,
  },
  infoTitle: { color: "#A78BFA", fontSize: typography.caption, fontWeight: "800" },
  toggleRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.4)",
    backgroundColor: "rgba(56,189,248,0.12)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleLabel: { color: colors.textSecondary, fontSize: typography.caption, fontWeight: "700", flex: 1, marginRight: 8 },
  toggleValue: { color: "#38BDF8", fontSize: typography.caption, fontWeight: "800" },
  docCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  docTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  docTitle: { color: colors.textPrimary, fontSize: typography.caption, fontWeight: "700", flex: 1 },
  docStatus: { fontSize: typography.caption, fontWeight: "800", textTransform: "uppercase" },
  docActionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  docBtn: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  docBtnText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  previewBox: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.35)",
    backgroundColor: "rgba(56,189,248,0.1)",
    padding: spacing.md,
    gap: 4,
  },
  previewLabel: { color: "#38BDF8", fontSize: typography.caption, fontWeight: "800" },
  analysis: { marginTop: spacing.xs, gap: 4 },
  docItem: { color: colors.textSecondary, fontSize: 11, lineHeight: 17 },
  pinOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", padding: 20 },
  pinCard: { backgroundColor: "#1B1530", borderRadius: 16, borderWidth: 1, borderColor: "rgba(124,58,237,0.35)", padding: 18, gap: 10 },
  pinTitle: { color: "#FFF", fontSize: 17, fontWeight: "800", textAlign: "center" },
  pinSub: { color: colors.textMuted, fontSize: 12, textAlign: "center", lineHeight: 18 },
  pinInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    padding: 12,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: "center",
  },
  pinErr: { color: "#F87171", fontSize: 12, textAlign: "center", fontWeight: "600" },
  pinBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  pinGhost: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  pinGhostText: { color: colors.textSecondary, fontWeight: "700" },
  pinPrimary: { flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: "#7C3AED", alignItems: "center" },
  pinPrimaryText: { color: "#FFF", fontWeight: "800" },
});

