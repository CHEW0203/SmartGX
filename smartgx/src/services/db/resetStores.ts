import { useAccountStore } from "../../store/accountStore";
import { DEFAULT_CREDIT_CARD_LIMIT, DEFAULT_DEBIT_DAILY_LIMIT } from "../../features/card/cardSpend";
import { useActivityStore } from "../../store/activityStore";
import { useFlexiCreditStore } from "../../store/flexiCreditStore";
import { useGamificationStore } from "../../store/gamificationStore";
import { useNotificationStore } from "../../store/notificationStore";
import { useSavingsStore } from "../../store/savingsStore";
import { useSecurityStore } from "../../store/securityStore";
import { useTransactionStore } from "../../store/transactionStore";
import { DEFAULT_RULE } from "../../features/savings/savings.engine";

/** Reset data stores when logging out (no mock seed). */
export function resetAllDataStores() {
  useTransactionStore.setState({ transactions: [] });
  useNotificationStore.setState({ notifications: [], unreadCount: 0 });
  useActivityStore.setState({ activities: [] });

  useAccountStore.setState({
    mainBalance: 0,
    flexiLimit: 0,
    flexiUsed: 0,
    flexiCreditLimit: 0,
    flexiCreditUsed: 0,
  });

  useSavingsStore.setState({
    allocationRule: DEFAULT_RULE,
    userAllocationRule: DEFAULT_RULE,
    useAIAllocation: false,
    manualIncomes: [],
    roundUpEnabled: true,
    roundUpTotal: 0,
    savingsBuckets: { bonus: 0, emergency: 0, goals: 0 },
    manualActivities: [],
    pendingBonusBoost: 0,
    withdrawalHistory: [],
    roundUpDestination: "bonus",
    latestAutoAllocation: null,
  });

  useFlexiCreditStore.setState({
    status: "not_applied",
    eligibility: null,
    docs: { epfStatement: "not_uploaded", businessBank6Months: "not_uploaded", myKad: "not_uploaded" },
    application: null,
    debtAnalysis: null,
    approvedLimit: 0,
    availableLimit: 0,
    outstanding: 0,
    nextRepaymentDate: null,
    monthlyRepayment: 0,
    annualInterestRate: 0.06,
    autoRepaymentEnabled: true,
    safeDrawdownRecommendation: 0,
    activeDrawdowns: [],
    repaymentHistory: [],
  });

  useGamificationStore.setState({
    currentStreak: 0,
    longestStreak: 0,
    todayCompleted: false,
    monthlySavedAmount: 0,
    streakMilestonesClaimed: [],
    savedByDate: {},
    smartScore: 420,
    rankMovement: 0,
    water: 3,
    treeLevel: 1,
    treeExp: 0,
    treeHealth: 62,
    treeState: "healthy",
    friends: [],
    missions: [],
    campaigns: [
      { id: "smartsave", title: "SmartSave Challenge", description: "Save RM300 this month", rewardBonus: 5, rewardWater: 5, rewardPoints: 60, progress: 0, target: 300, status: "not_started" },
      { id: "roundup_boost", title: "Round-up Boost", description: "Complete 10 round-up savings", rewardBonus: 3, rewardWater: 3, rewardPoints: 40, progress: 0, target: 10, status: "not_started" },
      { id: "debt_free", title: "Debt-Free Month", description: "Avoid risky credit drawdown for 30 days", rewardBonus: 0, rewardWater: 5, rewardPoints: 80, progress: 0, target: 30, status: "not_started" },
      { id: "friend_streak", title: "Friend Streak Challenge", description: "Add a friend and hit 7-day streak", rewardBonus: 3, rewardWater: 2, rewardPoints: 50, progress: 0, target: 2, status: "not_started" },
      { id: "emergency_builder", title: "Emergency Builder", description: "Increase Emergency saving by RM100", rewardBonus: 2, rewardWater: 2, rewardPoints: 30, progress: 0, target: 100, status: "not_started" },
    ],
    autoCreditedStreakMilestones: [],
    lastSyncedAt: null,
    scoreBreakdown: { gxHealth: 0, streak: 0, missions: 0, savingsGrowth: 0, debtBehavior: 0, repayment: 0, total: 420 },
  });

  useSecurityStore.setState({
    pinSetFromServer: false,
    serverPinHash: null,
    wrongPinAttempts: 0,
    sensitiveLockUntil: 0,
    emergencyLock: false,
    deviceTrusted: true,
    transactionAlertsEnabled: true,
    biometricEnabledLocal: false,
    lastLoginAt: new Date().toISOString(),
    lastSafetyCheckAt: null,
    safetyCheckStatus: "idle",
    safetyCheckItems: [],
    mockSuspiciousSession: false,
    mockRiskyLinkFlag: false,
    lastScamCheck: null,
  });
}
