import { useEffect, useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Modal,
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
import { useHealthData } from "../src/hooks/useHealthData";
import { useTransactionStore } from "../src/store/transactionStore";
import { useSavingsStore } from "../src/store/savingsStore";
import { useNotificationStore } from "../src/store/notificationStore";
import { useAccountStore } from "../src/store/accountStore";
import { useFlexiCreditStore } from "../src/store/flexiCreditStore";
import { useActivityStore } from "../src/store/activityStore";
import {
  aggregateMonthly,
  aggregateCategorySpend,
  currentReportingMonthPrefix,
  generateAIInsight,
  generateAIInsightAsync,
  getTransactionRiskLabel,
  type TransactionInsightBuildOpts,
} from "../src/features/transactions/transactions.engine";
import type { CategorySpendMap } from "../src/features/transactions/transactions.engine";
import type { Transaction, TransactionCategory } from "../src/types/transaction";
import type { IncomeType } from "../src/features/savings/savings.types";
import { calcAllocation, ruleTotal } from "../src/features/savings/savings.engine";
import {
  classifyIncomingReceipt,
  generateIncomingReceipt,
  type IncomingClassifierResult,
  type IncomingReceipt,
} from "../src/features/income/incomeClassifier";
import { formatRM } from "../src/lib/currency";
import { transactionOccurredMs, visibleHistoryTransactions } from "../src/lib/transactionTime";
import { colors } from "../src/theme/colors";
import { radius } from "../src/theme/radius";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";

/* ─── Filter type ─────────────────────────────────────────────────── */

type FilterTab = "all" | "income" | "expense";
type ChartTab = "expense" | "income";
type IncomeCategory =
  | "salary"
  | "allowance"
  | "part_time_income"
  | "freelance_income"
  | "cash_income"
  | "transfer_in"
  | "refund"
  | "cashback"
  | "others";

/* ─── Category metadata ───────────────────────────────────────────── */

const CATEGORY_META: Record<TransactionCategory, { label: string; emoji: string }> = {
  food:          { label: "Food & Dining",     emoji: "🍔" },
  transport:     { label: "Transport",         emoji: "🚗" },
  shopping:      { label: "Shopping",          emoji: "🛍️" },
  bills:         { label: "Bills & Utilities", emoji: "📋" },
  education:     { label: "Education",         emoji: "📚" },
  entertainment: { label: "Entertainment",     emoji: "🎬" },
  subscription:  { label: "Subscriptions",     emoji: "🔄" },
  others:        { label: "Others",            emoji: "💼" },
};

/* ─── Pie chart colours ───────────────────────────────────────────── */

const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  bills:         "#A78BFA",
  shopping:      "#F472B6",
  food:          "#FB923C",
  subscription:  "#38BDF8",
  transport:     "#4ADE80",
  education:     "#FCD34D",
  entertainment: "#F87171",
  others:        "#6B7280",
};

const CATEGORY_ORDER: TransactionCategory[] = [
  "bills", "shopping", "food", "subscription",
  "transport", "education", "entertainment", "others",
];

const INCOME_COLORS: Record<IncomeCategory, string> = {
  salary: "#38BDF8",
  allowance: "#0EA5E9",
  part_time_income: "#22D3EE",
  freelance_income: "#3B82F6",
  cash_income: "#14B8A6",
  transfer_in: "#06B6D4",
  refund: "#60A5FA",
  cashback: "#2DD4BF",
  others: "#64748B",
};

const INCOME_LABELS: Record<IncomeCategory, string> = {
  salary: "Salary",
  allowance: "Allowance",
  part_time_income: "Part-time Income",
  freelance_income: "Freelance Income",
  cash_income: "Cash Income",
  transfer_in: "Transfer In",
  refund: "Refund",
  cashback: "Cashback",
  others: "Others",
};

const INCOME_ORDER: IncomeCategory[] = [
  "salary",
  "allowance",
  "part_time_income",
  "freelance_income",
  "cash_income",
  "transfer_in",
  "refund",
  "cashback",
  "others",
];

/* ─── SVG path helpers for donut chart ───────────────────────────── */

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArcPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number
): string {
  const span       = endDeg - startDeg;
  const effectEnd  = span >= 359.9 ? startDeg + 359.8 : endDeg;
  const largeArc   = span > 180 ? 1 : 0;

  const outerS = polarToXY(cx, cy, outerR, startDeg);
  const outerE = polarToXY(cx, cy, outerR, effectEnd);
  const innerS = polarToXY(cx, cy, innerR, startDeg);
  const innerE = polarToXY(cx, cy, innerR, effectEnd);

  return [
    `M ${outerS.x.toFixed(2)} ${outerS.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerE.x.toFixed(2)} ${outerE.y.toFixed(2)}`,
    `L ${innerE.x.toFixed(2)} ${innerE.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerS.x.toFixed(2)} ${innerS.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

/* ─── Pie chart component ─────────────────────────────────────────── */

const CX = 120;
const CY = 120;
const OUTER_R = 100;
const INNER_R = 64;
const CHART_SIZE = 240;
const GAP_DEG = 1.5;

function SpendingPieChart({
  categories,
  totalExpense,
}: {
  categories: CategorySpendMap;
  totalExpense: number;
}) {
  if (totalExpense === 0) {
    return (
      <View style={pieStyles.empty}>
        <Text style={pieStyles.emptyText}>No spending data this month</Text>
      </View>
    );
  }

  const activeCats = CATEGORY_ORDER.filter((cat) => categories[cat] > 0);
  const hasGap     = activeCats.length > 1;

  let cumDeg = 0;
  const slices = activeCats
    .map((cat) => {
      const deg   = (categories[cat] / totalExpense) * 360;
      const start = cumDeg + (hasGap ? GAP_DEG / 2 : 0);
      const end   = cumDeg + deg - (hasGap ? GAP_DEG / 2 : 0);
      cumDeg += deg;
      return { cat, start, end, color: CATEGORY_COLORS[cat] };
    })
    .filter((s) => s.end - s.start > 1);

  return (
    <View style={pieStyles.wrap}>
      {/* Chart */}
      <View style={pieStyles.chartWrap}>
        <Svg width={CHART_SIZE} height={CHART_SIZE} viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}>
          {slices.map((s) => (
            <Path
              key={s.cat}
              d={donutArcPath(CX, CY, OUTER_R, INNER_R, s.start, s.end)}
              fill={s.color}
            />
          ))}
        </Svg>
        {/* Center text overlay */}
        <View style={[StyleSheet.absoluteFill, pieStyles.centerText]}>
          <Text style={pieStyles.centerAmount}>{formatRM(totalExpense)}</Text>
          <Text style={pieStyles.centerLabel}>total expenses</Text>
        </View>
      </View>

      {/* Full-width legend rows */}
      <View style={pieStyles.legendList}>
        {slices.map((s) => {
          const pct  = Math.round((categories[s.cat] / totalExpense) * 100);
          const meta = CATEGORY_META[s.cat];
          return (
            <View key={s.cat} style={pieStyles.legendItem}>
              <View style={[pieStyles.legendDot, { backgroundColor: s.color }]} />
              <View style={pieStyles.legendBody}>
                <Text style={pieStyles.legendLabel} numberOfLines={1}>
                  {meta.emoji} {meta.label}
                </Text>
                <View style={pieStyles.legendRight}>
                  <Text style={pieStyles.legendAmount}>{formatRM(categories[s.cat])}</Text>
                  <Text style={pieStyles.legendPct}>{pct}%</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function IncomePieChart({
  categories,
  totalIncome,
}: {
  categories: Record<IncomeCategory, number>;
  totalIncome: number;
}) {
  if (totalIncome === 0) {
    return (
      <View style={pieStyles.empty}>
        <Text style={pieStyles.emptyText}>No income data this month</Text>
      </View>
    );
  }
  const active = INCOME_ORDER.filter((cat) => categories[cat] > 0);
  const hasGap = active.length > 1;
  let cumDeg = 0;
  const slices = active
    .map((cat) => {
      const deg = (categories[cat] / totalIncome) * 360;
      const start = cumDeg + (hasGap ? GAP_DEG / 2 : 0);
      const end = cumDeg + deg - (hasGap ? GAP_DEG / 2 : 0);
      cumDeg += deg;
      return { cat, start, end, color: INCOME_COLORS[cat] };
    })
    .filter((s) => s.end - s.start > 1);

  return (
    <View style={pieStyles.wrap}>
      <View style={pieStyles.chartWrap}>
        <Svg width={CHART_SIZE} height={CHART_SIZE} viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}>
          {slices.map((s) => (
            <Path key={s.cat} d={donutArcPath(CX, CY, OUTER_R, INNER_R, s.start, s.end)} fill={s.color} />
          ))}
        </Svg>
        <View style={[StyleSheet.absoluteFill, pieStyles.centerText]}>
          <Text style={pieStyles.centerAmount}>{formatRM(totalIncome)}</Text>
          <Text style={pieStyles.centerLabel}>total income</Text>
        </View>
      </View>
      <View style={pieStyles.legendList}>
        {slices.map((s) => {
          const pct = Math.round((categories[s.cat] / totalIncome) * 100);
          return (
            <View key={s.cat} style={pieStyles.legendItem}>
              <View style={[pieStyles.legendDot, { backgroundColor: s.color }]} />
              <View style={pieStyles.legendBody}>
                <Text style={pieStyles.legendLabel} numberOfLines={1}>{INCOME_LABELS[s.cat]}</Text>
                <View style={pieStyles.legendRight}>
                  <Text style={pieStyles.legendAmount}>{formatRM(categories[s.cat])}</Text>
                  <Text style={pieStyles.legendPct}>{pct}%</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const pieStyles = StyleSheet.create({
  wrap:        { alignItems: "center", gap: spacing.lg },
  chartWrap:   { width: CHART_SIZE, height: CHART_SIZE },
  centerText:  { alignItems: "center", justifyContent: "center" },
  centerAmount:{ color: "#FFFFFF", fontSize: 16, fontWeight: "800", letterSpacing: -0.5 },
  centerLabel: { color: "#A78BFA", fontSize: 10, marginTop: 1 },
  // Full-width legend rows instead of 2-column grid to avoid squeezing
  legendList:  { width: "100%", gap: 8 },
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot:   { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  legendBody:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  legendLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "600", flex: 1 },
  legendRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendAmount:{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  legendPct:   { color: colors.textMuted, fontSize: 12, fontWeight: "400" },
  empty:       { paddingVertical: spacing.xl, alignItems: "center" },
  emptyText:   { color: colors.textMuted, fontSize: typography.body },
});

/* ─── Taskbar icon ────────────────────────────────────────────────── */

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

function BanknoteIcon({ size = 22, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 8C3 6.9 3.9 6 5 6H19C20.1 6 21 6.9 21 8V16C21 17.1 20.1 18 19 18H5C3.9 18 3 17.1 3 16V8Z" stroke={color} strokeWidth="1.8" />
      <Path d="M15.5 12C15.5 13.93 13.93 15.5 12 15.5C10.07 15.5 8.5 13.93 8.5 12C8.5 10.07 10.07 8.5 12 8.5C13.93 8.5 15.5 10.07 15.5 12Z" stroke={color} strokeWidth="1.5" />
      <Path d="M5 9.5H6.5V11H5V9.5Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      <Path d="M17.5 13H19V14.5H17.5V13Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
    </Svg>
  );
}

/* ─── Taskbar tabs ────────────────────────────────────────────────── */

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
        <Path d="M9 17L8.5 20" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
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
    active: true,
    route: "/transactions",
    renderIcon: (c, s = 22) => <BanknoteIcon size={s} color={c} />,
  },
];

function aggregateIncomeCategories(txns: Transaction[]): Record<IncomeCategory, number> {
  const result: Record<IncomeCategory, number> = {
    salary: 0,
    allowance: 0,
    part_time_income: 0,
    freelance_income: 0,
    cash_income: 0,
    transfer_in: 0,
    refund: 0,
    cashback: 0,
    others: 0,
  };
  txns.forEach((t) => {
    if (t.type !== "income") return;
    const key = (
      t.incomeType === "part_time" ? "part_time_income"
      : t.incomeType ?? (t.paymentMethod === "online_transfer" ? "transfer_in" : "others")
    ) as IncomeCategory;
    result[key] = Math.round((result[key] + t.amount) * 100) / 100;
  });
  return result;
}

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function TransactionsScreen() {
  const { currentUser } = useAuth();
  const healthReport = useHealthData();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [chartTab, setChartTab] = useState<ChartTab>("expense");
  const { transactions, addTransaction } = useTransactionStore();
  const accountStore = useAccountStore();
  const mainBalance = useAccountStore((s) => s.mainBalance);
  const flexiCardUsed = useAccountStore((s) => s.flexiUsed);
  const flexiCardLimit = useAccountStore((s) => s.flexiLimit);
  const flexiCreditUsedAcc = useAccountStore((s) => s.flexiCreditUsed);
  const flexiOutstanding = useFlexiCreditStore((s) => s.outstanding);
  const flexiDrawdowns = useFlexiCreditStore((s) => s.activeDrawdowns.length);
  const flexiMonthlyRepay = useFlexiCreditStore((s) => s.monthlyRepayment);
  const savingsBuckets = useSavingsStore((s) => s.savingsBuckets);
  const { addNotification } = useNotificationStore();
  const { addActivity } = useActivityStore();
  const { userAllocationRule, allocationRule, applyIncomeAutoAllocation, addManualActivity } = useSavingsStore();
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [incomeReceipt, setIncomeReceipt] = useState<IncomingReceipt | null>(null);
  const [incomeClassify, setIncomeClassify] = useState<IncomingClassifierResult | null>(null);
  const [allocationResult, setAllocationResult] = useState<null | { spendingWallet: number; bonus: number; emergency: number; goals: number }>(null);
  const [incomeActionDone, setIncomeActionDone] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [incomeError, setIncomeError] = useState("");
  const [incomeReceiptMeta, setIncomeReceiptMeta] = useState<null | {
    transactionId: string;
    date: string;
    time: string;
    typeLabel: string;
    channel: string;
  }>(null);

  const userId = currentUser?.id ?? "";
  const monthlyIncome = currentUser?.financialProfile?.monthlyIncome ?? 0;
  const monthlyBudget = currentUser?.financialProfile?.monthlyBudget ?? null;
  const reportMonth = currentReportingMonthPrefix();

  const insightOpts: TransactionInsightBuildOpts = useMemo(() => {
    const totalSavings =
      (savingsBuckets.bonus ?? 0) + (savingsBuckets.emergency ?? 0) + (savingsBuckets.goals ?? 0);
    const outstanding = flexiOutstanding > 0 || flexiDrawdowns > 0 ? flexiOutstanding : flexiCreditUsedAcc;
    return {
      mainBalance,
      totalSavings,
      gxHealthScore: healthReport.score,
      flexiCreditOutstanding: outstanding,
      flexiCardUsed: flexiCardUsed,
      flexiCardLimit: flexiCardLimit,
      upcomingRepayment: flexiMonthlyRepay,
    };
  }, [
    mainBalance,
    savingsBuckets.bonus,
    savingsBuckets.emergency,
    savingsBuckets.goals,
    healthReport.score,
    flexiOutstanding,
    flexiDrawdowns,
    flexiCreditUsedAcc,
    flexiCardUsed,
    flexiCardLimit,
    flexiMonthlyRepay,
  ]);

  const [aiInsight, setAiInsight] = useState("");

  useEffect(() => {
    if (!userId) {
      setAiInsight("");
      return;
    }
    setAiInsight(generateAIInsight(transactions, monthlyIncome, userId, monthlyBudget, insightOpts));
    let cancelled = false;
    void generateAIInsightAsync(transactions, monthlyIncome, userId, monthlyBudget, insightOpts).then((text) => {
      if (!cancelled) setAiInsight(text);
    });
    return () => {
      cancelled = true;
    };
  }, [transactions, monthlyIncome, userId, monthlyBudget, insightOpts]);

  if (!currentUser) return <Redirect href="/auth/login" />;

  const summary    = aggregateMonthly(transactions, userId);
  const categories = aggregateCategorySpend(transactions, userId);
  const incomeCategories = aggregateIncomeCategories(
    visibleHistoryTransactions(transactions).filter((t) => t.userId === userId && t.transactionDate.startsWith(reportMonth))
  );
  const effectiveRule = userAllocationRule ?? allocationRule;
  const ruleOk = ruleTotal(effectiveRule) === 100;

  const resetIncomeModal = () => {
    setIncomeReceipt(null);
    setIncomeClassify(null);
    setAllocationResult(null);
    setIncomeActionDone(false);
    setClassifying(false);
    setIncomeError("");
    setIncomeReceiptMeta(null);
  };

  const mapDetectedTypeToIncomeType = (detected: IncomingClassifierResult["detectedType"]): Transaction["incomeType"] => {
    if (detected === "part_time_income") return "part_time";
    return detected;
  };

  const handleReceiveIncome = async () => {
    setIncomeError("");
    if (!ruleOk) return setIncomeError("Your allocation rule must total 100% in Saving & Automation.");
    setClassifying(true);
    const receipt = generateIncomingReceipt();
    setIncomeReceipt(receipt);
    const classified = await classifyIncomingReceipt({
      receipt,
      recentIncomingTransfers: transactions
        .filter((t) => t.type === "income")
        .slice(0, 5)
        .map((t) => ({ amount: t.amount, source: t.incomeSource ?? t.merchant, description: t.incomeDescription ?? t.note ?? "" })),
    });
    setIncomeClassify(classified);

    const mappedIncomeType = mapDetectedTypeToIncomeType(classified.detectedType);
    const now = new Date();
    const isoNow = now.toISOString();
    const date = isoNow.slice(0, 10);
    const time = now.toTimeString().slice(0, 5);
    let allocationApplied = false;
    let breakdown: Transaction["allocationBreakdown"] | undefined;
    let notificationTitle = "Income Received";
    let notificationMessage = `${formatRM(receipt.amount)} received from ${receipt.source}.`;

    if (classified.shouldAutoAllocate && (mappedIncomeType === "salary" || mappedIncomeType === "allowance" || mappedIncomeType === "part_time" || mappedIncomeType === "freelance_income" || mappedIncomeType === "cash_income")) {
      const alloc = calcAllocation(receipt.amount, effectiveRule);
      const apply = applyIncomeAutoAllocation({
        amount: receipt.amount,
        incomeType: mappedIncomeType as IncomeType,
        source: receipt.source,
        description: receipt.description,
        confidence: classified.confidence,
        detectionReason: classified.reason,
      });
      if (!apply.ok) {
        setClassifying(false);
        return setIncomeError(apply.error ?? "Unable to apply auto allocation.");
      }
      accountStore.creditBalance(alloc.spendingWallet);
      allocationApplied = true;
      breakdown = {
        spendingWallet: alloc.spendingWallet,
        bonus: alloc.bonusPocket,
        emergency: alloc.emergencyFund,
        goals: alloc.goalSavings,
        ruleUsed: {
          spendingWallet: effectiveRule.spendingWallet,
          bonus: effectiveRule.bonusPocket,
          emergency: effectiveRule.emergencyFund,
          goals: effectiveRule.goalSavings,
        },
      };
      setAllocationResult({
        spendingWallet: alloc.spendingWallet,
        bonus: alloc.bonusPocket,
        emergency: alloc.emergencyFund,
        goals: alloc.goalSavings,
      });
      notificationTitle = "Income Auto-Allocated";
      notificationMessage = `${formatRM(receipt.amount)} was received and auto-allocated by your current rule.`;
      addActivity({
        id: `act-auto-allocation-${Date.now()}`,
        type: "auto_allocation",
        title: "Income Auto-Allocated",
        description: `${formatRM(receipt.amount)} from ${receipt.source}`,
        amount: alloc.bonusPocket + alloc.emergencyFund + alloc.goalSavings,
        direction: "credit",
        timestamp: new Date(Date.parse(isoNow) + 1000).toISOString(),
        route: "/savings",
      });
    } else {
      accountStore.creditBalance(receipt.amount);
      addManualActivity({
        id: `act-transfer-in-${Date.now()}`,
        label: "Transfer received, no allocation applied",
        pocket: "Main Account",
        amount: receipt.amount,
        date,
        occurredAt: isoNow,
        type: "manual",
      });
      setAllocationResult(null);
      notificationTitle = "Transfer Received";
      notificationMessage = `${formatRM(receipt.amount)} received and credited to Main Account.`;
    }
    addActivity({
      id: `act-income-${Date.now()}`,
      type: "receive_income",
      title: "Income Received",
      description: `${formatRM(receipt.amount)} from ${receipt.source}`,
      amount: receipt.amount,
      direction: "credit",
      timestamp: isoNow,
      route: "/transactions",
    });

    const transactionId = `t-income-${Date.now()}`;
    addTransaction({
      id: transactionId,
      userId,
      merchant: receipt.source,
      category: "others",
      amount: receipt.amount,
      type: "income",
      paymentMethod: "auto_debit",
      transactionDate: date,
      riskLevel: "low",
      isSuspicious: false,
      note: receipt.description,
      incomeType: mappedIncomeType,
      incomeSource: receipt.source,
      incomeDescription: receipt.description,
      incomeConfidence: classified.confidence,
      classificationReason: classified.reason,
      allocationApplied,
      allocationBreakdown: breakdown,
      sourceAction: "receive_income",
      occurredAt: isoNow,
    });
    addNotification({
      id: `notif-income-alloc-${Date.now()}`,
      title: notificationTitle,
      message: notificationMessage,
      time: `${date} · ${time}`,
      read: false,
      type: "info",
    });
    setIncomeReceiptMeta({
      transactionId,
      date,
      time,
      typeLabel: allocationApplied ? "Income Received" : "Transfer Received",
      channel: receipt.channel,
    });
    setClassifying(false);
    setIncomeActionDone(true);
  };

  const allSorted = visibleHistoryTransactions(transactions)
    .filter((t) => t.userId === userId && t.transactionDate.startsWith(reportMonth))
    .sort((a, b) => transactionOccurredMs(b) - transactionOccurredMs(a));

  const visibleTxns: Transaction[] = (() => {
    if (activeFilter === "income")  return allSorted.filter((t) => t.type === "income");
    if (activeFilter === "expense") return allSorted.filter((t) => t.type === "expense");
    return allSorted;
  })();

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0529" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Gradient hero (matches Saving & Automation style) ── */}
        <LinearGradient
          colors={["#3B1578", "#2D0D6B", "#1A0845", "#070B14"]}
          locations={[0, 0.4, 0.75, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.hero}
        >
          <Pressable
            style={styles.backBtn}
            onPress={() => router.push("/dashboard" as never)}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15 18L9 12L15 6"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
          <Text style={styles.heroTitle}>Transaction</Text>
          <View style={styles.heroSubRow}>
            <Text style={styles.heroSub}>May 2026 · SmartGX</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{summary.count} entries</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Monthly summary ── */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardSectionLabel}>Monthly Overview</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryCellLabel}>Income</Text>
              <Text style={[styles.summaryCellAmount, { color: "#22C55E" }]}>
                +{formatRM(summary.totalIncome)}
              </Text>
              <Text style={styles.summaryCellCount}>{summary.incomeCount} entries</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCell}>
              <Text style={styles.summaryCellLabel}>Expense</Text>
              <Text style={[styles.summaryCellAmount, { color: "#EF4444" }]}>
                -{formatRM(summary.totalExpense)}
              </Text>
              <Text style={styles.summaryCellCount}>{summary.expenseCount} entries</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCell}>
              <Text style={styles.summaryCellLabel}>Net</Text>
              <Text
                style={[
                  styles.summaryCellAmount,
                  { color: summary.netCashflow >= 0 ? "#22C55E" : "#EF4444" },
                ]}
              >
                {summary.netCashflow >= 0 ? "+" : ""}
                {formatRM(summary.netCashflow)}
              </Text>
              <Text style={styles.summaryCellCount}>cashflow</Text>
            </View>
          </View>

          <Pressable style={styles.receiveIncomeBtn} onPress={() => { resetIncomeModal(); setShowIncomeModal(true); }}>
            <Text style={styles.receiveIncomeBtnText}>Receive Income</Text>
          </Pressable>
        </View>

        {/* ── AI Insight ── */}
        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <View style={styles.insightIconWrap}>
              <Text style={styles.insightIconText}>✦</Text>
            </View>
            <Text style={styles.insightTitle}>SmartGX Insight</Text>
          </View>
          <Text style={styles.insightBody}>{aiInsight}</Text>
        </View>

        {/* ── Expense / Income pie toggle ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Overview</Text>
          <View style={styles.chartToggleRow}>
            <Pressable style={[styles.chartToggleBtn, chartTab === "expense" && styles.chartToggleBtnActive]} onPress={() => setChartTab("expense")}>
              <Text style={[styles.chartToggleText, chartTab === "expense" && styles.chartToggleTextActive]}>Expense</Text>
            </Pressable>
            <Pressable style={[styles.chartToggleBtn, chartTab === "income" && styles.chartToggleBtnActive]} onPress={() => setChartTab("income")}>
              <Text style={[styles.chartToggleText, chartTab === "income" && styles.chartToggleTextActiveBlue]}>Income</Text>
            </Pressable>
          </View>
          <View style={styles.card}>
            {chartTab === "expense" ? (
              <SpendingPieChart categories={categories} totalExpense={summary.totalExpense} />
            ) : (
              <IncomePieChart categories={incomeCategories} totalIncome={summary.totalIncome} />
            )}
          </View>
        </View>

        {/* ── Transaction list ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transactions</Text>

          {/* Filter tabs */}
          <View style={styles.filterRow}>
            {(["all", "income", "expense"] as FilterTab[]).map((tab) => (
              <Pressable
                key={tab}
                style={[styles.filterTab, activeFilter === tab && styles.filterTabActive]}
                onPress={() => setActiveFilter(tab)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    activeFilter === tab && styles.filterTabTextActive,
                  ]}
                >
                  {tab === "all" ? "All" : tab === "income" ? "Income" : "Expense"}
                </Text>
              </Pressable>
            ))}
          </View>

          {visibleTxns.length === 0 ? (
            <View style={styles.emptyList}>
              <Text style={styles.emptyListText}>No transactions for this filter.</Text>
            </View>
          ) : (
            <View style={styles.txnList}>
              {visibleTxns.map((txn, idx) => {
                const isIncome  = txn.type === "income" || txn.type === "credit_drawdown";
                const isSavingWithdrawal = txn.type === "saving_withdrawal";
                const catMeta   = CATEGORY_META[txn.category];
                const isLast    = idx === visibleTxns.length - 1;

                return (
                  <View
                    key={txn.id}
                    style={[styles.txnItem, isLast && styles.txnItemLast]}
                  >
                    <View style={styles.txnIconWrap}>
                      <Text style={styles.txnEmoji}>{catMeta.emoji}</Text>
                    </View>
                    <View style={styles.txnBody}>
                      <Text style={styles.txnMerchant} numberOfLines={1}>
                        {txn.type === "credit_drawdown"
                          ? "FlexiCredit Drawdown"
                          : txn.type === "repayment"
                            ? "FlexiCredit Repayment"
                            : txn.type === "saving_withdrawal"
                              ? "Saving Withdrawal"
                              : txn.merchant}
                      </Text>
                      <View style={styles.txnMeta}>
                        <Text style={styles.txnCategory}>{catMeta.label}</Text>
                        <Text style={styles.txnDot}>·</Text>
                        <Text style={styles.txnDate}>{txn.transactionDate}</Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.txnAmount,
                        { color: isIncome ? "#22C55E" : isSavingWithdrawal ? "#FCD34D" : "#FFFFFF" },
                      ]}
                    >
                      {isIncome ? "+" : isSavingWithdrawal ? "↔" : "−"}{formatRM(txn.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showIncomeModal} transparent animationType="fade" onRequestClose={() => setShowIncomeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Incoming Receipt</Text>
            <Text style={styles.modalSub}>Incoming receipt will be detected and processed automatically.</Text>

            {incomeReceipt ? (
              <View style={styles.receiptCard}>
                <Text style={styles.receiptAmt}>+{formatRM(incomeReceipt.amount)}</Text>
                <Text style={styles.receiptLine}>From: {incomeReceipt.source}</Text>
                <Text style={styles.receiptLine}>Reference: {incomeReceipt.description}</Text>
                {incomeReceiptMeta ? <Text style={styles.receiptLine}>Date: {incomeReceiptMeta.date} · {incomeReceiptMeta.time}</Text> : null}
                {incomeReceiptMeta ? <Text style={styles.receiptLine}>Transaction ID: {incomeReceiptMeta.transactionId}</Text> : null}
                {incomeReceiptMeta ? <Text style={styles.receiptLine}>Type: {incomeReceiptMeta.typeLabel}</Text> : null}
                {incomeReceiptMeta ? <Text style={styles.receiptLine}>Channel: {incomeReceiptMeta.channel}</Text> : null}
                <Text style={styles.receiptStatus}>Status: Successful</Text>
              </View>
            ) : (
              <Text style={styles.receiptHint}>Ready to detect incoming receipt.</Text>
            )}

            {!ruleOk ? <Text style={styles.modalWarn}>Allocation rule must total 100% in Saving & Automation.</Text> : null}
            {incomeError ? <Text style={styles.modalError}>{incomeError}</Text> : null}
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalGhostBtn} onPress={() => { setShowIncomeModal(false); resetIncomeModal(); }}>
                <Text style={styles.modalGhostText}>Close</Text>
              </Pressable>
              {incomeActionDone ? (
                <Pressable
                  style={styles.modalPrimaryBtn}
                  onPress={() => {
                    setShowIncomeModal(false);
                    const toSavings = incomeClassify?.shouldAutoAllocate ?? false;
                    resetIncomeModal();
                    router.push((toSavings ? "/savings" : "/transactions") as never);
                  }}
                >
                  <Text style={styles.modalPrimaryText}>{incomeClassify?.shouldAutoAllocate ? "View in Saving" : "View Transaction"}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.modalPrimaryBtn, (classifying || !ruleOk) && styles.modalPrimaryDisabled]}
                  onPress={() => { void handleReceiveIncome(); }}
                  disabled={classifying || !ruleOk}
                >
                  <Text style={styles.modalPrimaryText}>{classifying ? "Detecting..." : "Receive Income"}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

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
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    paddingBottom: 100,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },

  /* Header */
  hero: {
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.xs,
  },
  backBtn:    { padding: spacing.xs, alignSelf: "flex-start", marginBottom: spacing.xs },
  heroTitle:  { color: "#FFFFFF", fontSize: typography.title, fontWeight: "800", letterSpacing: -0.3 },
  heroSubRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroSub:    { color: "#C4B5FD", fontSize: typography.body, opacity: 0.85 },
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(167,139,250,0.2)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.3)",
  },
  headerBadgeText: { color: "#A78BFA", fontSize: 12, fontWeight: "700" },

  /* Summary card */
  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardSectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryRow: { flexDirection: "row" },
  summaryCell: { flex: 1, alignItems: "center", gap: 3 },
  summaryCellLabel: { color: colors.textMuted, fontSize: typography.caption, fontWeight: "600" },
  summaryCellAmount: { fontSize: 13, fontWeight: "800", letterSpacing: -0.2 },
  summaryCellCount:  { color: colors.textMuted, fontSize: 10 },
  summaryDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  receiveIncomeBtn: {
    marginTop: spacing.xs,
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: "rgba(56,189,248,0.18)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.35)",
  },
  receiveIncomeBtnText: { color: "#7DD3FC", fontSize: typography.caption, fontWeight: "800" },

  /* AI Insight */
  insightCard: {
    backgroundColor: "rgba(109, 40, 217, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.20)",
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  insightIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(139, 92, 246, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  insightIconText: { fontSize: 13, color: "#C4B5FD" },
  insightTitle: {
    color: "#A78BFA",
    fontSize: typography.body,
    fontWeight: "700",
  },
  insightBody: {
    color: "#E4DCFF",
    fontSize: typography.body,
    lineHeight: 22,
  },

  /* Section */
  section: { gap: spacing.md },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: typography.subheading,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  chartToggleRow: { flexDirection: "row", gap: spacing.sm },
  chartToggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  chartToggleBtnActive: { borderColor: "#7C3AED", backgroundColor: "rgba(124,58,237,0.18)" },
  chartToggleText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: "700" },
  chartToggleTextActive: { color: "#A78BFA" },
  chartToggleTextActiveBlue: { color: "#38BDF8" },

  /* Filter */
  filterRow: { flexDirection: "row", gap: spacing.sm },
  filterTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: "rgba(109, 40, 217, 0.22)",
    borderColor: "#7C3AED",
  },
  filterTabText:       { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  filterTabTextActive: { color: "#A78BFA" },

  /* Transaction list */
  txnList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  txnItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txnItemLast: { borderBottomWidth: 0 },
  txnIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  txnEmoji:    { fontSize: 18 },
  txnBody:     { flex: 1, gap: 3 },
  txnMerchant: { color: "#FFFFFF", fontSize: typography.body, fontWeight: "600" },
  txnMeta:     { flexDirection: "row", alignItems: "center", gap: 5 },
  txnCategory: { color: colors.textMuted, fontSize: 11 },
  txnDot:      { color: colors.textMuted, fontSize: 11 },
  txnDate:     { color: colors.textMuted, fontSize: 11 },
  txnAmount:   { fontSize: typography.body, fontWeight: "800", letterSpacing: -0.2, flexShrink: 0 },

  emptyList:     { paddingVertical: spacing.xl, alignItems: "center" },
  emptyListText: { color: colors.textMuted, fontSize: typography.body },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    backgroundColor: "#0C0920",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.3)",
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: 10,
  },
  modalTitle: { color: colors.textPrimary, fontSize: typography.subheading, fontWeight: "900", textAlign: "center" },
  modalSub: { color: colors.textMuted, fontSize: typography.caption, textAlign: "center", lineHeight: 18, marginBottom: 2 },
  receiptCard: {
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.28)",
    backgroundColor: "rgba(15,23,42,0.65)",
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
  },
  receiptAmt: { color: "#22C55E", fontSize: typography.subheading, fontWeight: "900", textAlign: "center" },
  receiptLine: { color: colors.textSecondary, fontSize: typography.caption, lineHeight: 18 },
  receiptStatus: { color: "#22C55E", fontSize: typography.caption, fontWeight: "800", marginTop: 2 },
  receiptReason: { color: "#7DD3FC", fontSize: typography.caption, lineHeight: 18, marginTop: 2 },
  receiptHint: { color: colors.textMuted, fontSize: typography.caption, textAlign: "center", paddingVertical: spacing.sm },
  receiptAllocGrid: { marginTop: 4, borderTopWidth: 1, borderTopColor: "rgba(148,163,184,0.22)", paddingTop: 6, gap: 2 },
  receiptAllocLine: { color: "#E0F2FE", fontSize: 12, fontWeight: "700" },
  inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "800", marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(15,23,42,0.65)",
    borderRadius: radius.md,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  chipOn: { borderColor: "rgba(56,189,248,0.55)", backgroundColor: "rgba(56,189,248,0.16)" },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  chipTextOn: { color: "#E0F2FE" },
  modalWarn: { color: "#F59E0B", fontSize: typography.caption, fontWeight: "700" },
  modalError: { color: "#FCA5A5", fontSize: typography.caption, fontWeight: "700" },
  modalBtnRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  modalGhostBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  modalGhostText: { color: colors.textMuted, fontWeight: "800" },
  modalPrimaryBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: "center", backgroundColor: "#0284C7" },
  modalPrimaryDisabled: { backgroundColor: "rgba(2,132,199,0.35)" },
  modalPrimaryText: { color: "#FFFFFF", fontWeight: "900" },

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
  tabItem:         { flex: 1, alignItems: "center", paddingBottom: spacing.sm, gap: 3 },
  tabLabel:        { color: colors.textMuted, fontSize: 10, fontWeight: "600" },
  tabLabelActive:  { color: "#A78BFA" },
  tabLabelPrimary: { color: "#A78BFA", fontSize: 10, fontWeight: "700" },
  tabPrimaryWrap:  { flex: 1, alignItems: "center", marginTop: -20, paddingBottom: spacing.xs, gap: 3 },
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
  tabSafeArea: { backgroundColor: colors.surface, height: 16 },
});
