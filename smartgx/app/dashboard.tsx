import React from "react";
import { Redirect, router, usePathname } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useAuth } from "../src/hooks/useAuth";
import { useSavingsStore } from "../src/store/savingsStore";
import { useNotificationStore } from "../src/store/notificationStore";
import { useAccountStore } from "../src/store/accountStore";
import { useHealthData } from "../src/hooks/useHealthData";
import { formatRM } from "../src/lib/currency";
import { useActivityStore } from "../src/store/activityStore";
import { useFlexiCreditStore } from "../src/store/flexiCreditStore";
import { MOCK_SMARTGX_USERS } from "../src/data/mockSmartGXUsers";
import { useGamificationStore } from "../src/store/gamificationStore";
import { userHasPinSet } from "../src/store/securityStore";
import { normalizeScore, normalizeSmartScore, safeNumber } from "../src/lib/number";
import { colors } from "../src/theme/colors";
import { radius } from "../src/theme/radius";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";
import { explainTreeHealth } from "../src/features/ai/gamification.ai";

/* ─── SVG Icon Components ─────────────────────────────────────────── */

function AddIncomeIcon({ size = 22, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M5 12H19" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

function TransferArrowsIcon({ size = 22, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Top arrow — pointing left */}
      <Path d="M18 8H6" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M10 4L6 8L10 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Bottom arrow — pointing right */}
      <Path d="M6 16H18" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M14 12L18 16L14 20" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CardIcon({ size = 22, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Card body */}
      <Rect x="2" y="5" width="20" height="14" rx="2.5" stroke={color} strokeWidth="2" />
      {/* Top stripe */}
      <Path d="M2 10H22" stroke={color} strokeWidth="2.5" />
      {/* Card number hints */}
      <Path d="M6 15H9" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M11 15H14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function BarcodeIcon({ size = 26, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Corner brackets */}
      <Path d="M3 9V3H9"   stroke={color} strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 3H21V9" stroke={color} strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 15V21H9" stroke={color} strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 15V21H15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Barcode vertical lines */}
      <Path d="M6 8V16"   stroke={color} strokeWidth="1"   strokeLinecap="round" />
      <Path d="M8 8V16"   stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M10 8V16"  stroke={color} strokeWidth="1"   strokeLinecap="round" />
      <Path d="M12 8V16"  stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M14 8V16"  stroke={color} strokeWidth="1"   strokeLinecap="round" />
      <Path d="M16 8V16"  stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M18 8V16"  stroke={color} strokeWidth="1"   strokeLinecap="round" />
      {/* Horizontal scan line */}
      <Path d="M5 12H19"  stroke={color} strokeWidth="0.8" strokeLinecap="round" strokeDasharray="2 1" />
    </Svg>
  );
}

/* ─── Action & Nav data ───────────────────────────────────────────── */

type ActionItem = {
  label: string;
  route?: string;
  renderIcon: (color?: string) => React.ReactNode;
};

const ACTIONS: ActionItem[] = [
  { label: "Add Money", route: "/addmoney", renderIcon: (c) => <AddIncomeIcon color={c} /> },
  { label: "Transfer",  route: "/transfer", renderIcon: (c) => <TransferArrowsIcon color={c} /> },
  { label: "Card",      route: "/card",     renderIcon: (c) => <CardIcon color={c} /> },
];

type NavTab = {
  label: string;
  primary?: boolean;
  route?: string;
  renderIcon: (color: string, size?: number) => React.ReactNode;
};

const TASKBAR_ACTIVE = "#A78BFA";

const NAV_TABS: NavTab[] = [
  { label: "Home", route: "/dashboard", renderIcon: (c, s = 22) => (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.6 5.4 21 6 21H9M19 10L21 12M19 10V20C19 20.6 18.6 21 18 21H15M9 21V15C9 14.4 9.4 14 10 14H14C14.6 14 15 14.4 15 15V21M9 21H15" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  { label: "Saving", route: "/savings", renderIcon: (c, s = 22) => (
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
  { label: "Scan", primary: true, route: "/scan", renderIcon: (c, s = 26) => <BarcodeIcon size={s} color={c} /> },
  { label: "GXHealth", route: "/gxhealth", renderIcon: (c, s = 22) => (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M12 21C12 21 4 13.5 4 8.5C4 5.42 6.42 3 9.5 3C11.04 3 12 4 12 4C12 4 12.96 3 14.5 3C17.58 3 20 5.42 20 8.5C20 13.5 12 21 12 21Z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M9 11L11 13L15 9" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  { label: "Transaction", route: "/transactions", renderIcon: (c, s = 22) => (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M3 8C3 6.9 3.9 6 5 6H19C20.1 6 21 6.9 21 8V16C21 17.1 20.1 18 19 18H5C3.9 18 3 17.1 3 16V8Z" stroke={c} strokeWidth="1.8" />
        <Path d="M15.5 12C15.5 13.93 13.93 15.5 12 15.5C10.07 15.5 8.5 13.93 8.5 12C8.5 10.07 10.07 8.5 12 8.5C13.93 8.5 15.5 10.07 15.5 12Z" stroke={c} strokeWidth="1.5" />
        <Path d="M5 9.5H6.5V11H5V9.5Z" stroke={c} strokeWidth="1.2" strokeLinejoin="round" />
        <Path d="M17.5 13H19V14.5H17.5V13Z" stroke={c} strokeWidth="1.2" strokeLinejoin="round" />
      </Svg>
    ),
  },
];

/* ─── Bot icon ────────────────────────────────────────────────────── */

function BotIcon({ size = 20, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2V5M12 2C12 2 10 2 10 3.5C10 4.2 11 5 12 5C13 5 14 4.2 14 3.5C14 2 12 2 12 2Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M5 8H19C20.1 8 21 8.9 21 10V17C21 18.1 20.1 19 19 19H5C3.9 19 3 18.1 3 17V10C3 8.9 3.9 8 5 8Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 13H9.01M15 13H15.01" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M9.5 16C10.5 17 13.5 17 14.5 16" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M1 13H3M21 13H23" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

/* ─── Bell icon ───────────────────────────────────────────────────── */

function BellIcon({ size = 20, color = "#C4B5FD" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8C18 6.4 17.4 4.8 16.2 3.6C15 2.4 13.5 2 12 2C10.5 2 9 2.4 7.8 3.6C6.6 4.8 6 6.4 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M13.73 21C13.55 21.3 13.3 21.55 12.99 21.72C12.68 21.9 12.34 21.99 12 21.99C11.66 21.99 11.32 21.9 11.01 21.72C10.7 21.55 10.45 21.3 10.27 21"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function DashboardScreen() {
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const { savingsBuckets } =
    useSavingsStore();
  const { unreadCount } = useNotificationStore();
  const notificationStore = useNotificationStore();
  const accountStore = useAccountStore();
  const { activities: sharedActivities } = useActivityStore();
  const activityStore = useActivityStore();
  const flexiCredit = useFlexiCreditStore();
  const syncGamification = useGamificationStore((s) => s.syncFromData);
  const gamifyCurrentStreak = useGamificationStore((s) => s.currentStreak);
  const gamifyWater = useGamificationStore((s) => s.water);
  const gamifyTreeLevel = useGamificationStore((s) => s.treeLevel);
  const gamifyTreeExp = useGamificationStore((s) => s.treeExp);
  const gamifyTreeHealth = useGamificationStore((s) => s.treeHealth);
  const gamifyTreeState = useGamificationStore((s) => s.treeState);
  const waterTree = useGamificationStore((s) => s.waterTree);
  const gamifyCampaigns = useGamificationStore((s) => s.campaigns);
  const gamifyMissions = useGamificationStore((s) => s.missions);
  const gamifyFriends = useGamificationStore((s) => s.friends);
  const gamifySmartScore = useGamificationStore((s) => s.smartScore);
  const gamifyStreakForMilestones = useGamificationStore((s) => s.currentStreak);
  const gamifyAutoCreditedKey = useGamificationStore((s) => s.autoCreditedStreakMilestones.join(","));
  const healthReport     = useHealthData();

  const safeHealthScore = normalizeScore(healthReport.score, 70);
  const safeSmartScore = normalizeSmartScore(gamifySmartScore, 420);

  const moneyTreeRank = React.useMemo(() => {
    const byId = new Map<string, number>();
    const add = (id: string, score: number) => {
      if (!byId.has(id)) byId.set(id, normalizeSmartScore(score, 420));
    };
    add("me", safeSmartScore);
    MOCK_SMARTGX_USERS.forEach((u) => add(u.id, safeNumber(u.smartScore, 420)));
    gamifyFriends.forEach((f) => add(f.id, safeNumber(f.smartScore, 420)));
    const sorted = [...byId.entries()].sort((a, b) => b[1] - a[1]);
    const idx = sorted.findIndex(([id]) => id === "me");
    return idx >= 0 ? idx + 1 : 1;
  }, [safeSmartScore, gamifyFriends]);

  const bonusBalance     = savingsBuckets.bonus;
  const emergencyBalance = savingsBuckets.emergency;
  const goalBalance      = savingsBuckets.goals;
  const totalSavings     = bonusBalance + emergencyBalance + goalBalance;
  const mainBalance = accountStore.mainBalance;
  // Phase 7 consistency: Total Balance mirrors spendable Main Account.
  const totalBalance     = mainBalance;

  // Profile avatar: first letter of full name, or "U" as ultimate fallback
  const firstName    = currentUser?.fullName?.trim().split(" ")[0] ?? "";
  const avatarLetter = (currentUser?.fullName ?? currentUser?.id ?? "U").trim().charAt(0).toUpperCase();

  const hasUnclaimedMissionReward = gamifyMissions.some((m) => m.status === "ready_to_claim");
  const missionCompletedCount = gamifyMissions.filter((m) => m.completed).length;
  const riskyDrawdownCount = sharedActivities.filter((a) => a.type === "flexicredit_drawdown").length;
  const [treeAiLine, setTreeAiLine] = React.useState<string | null>(null);

  const activities = React.useMemo(
    () =>
      sharedActivities
        .filter((a) => !Number.isNaN(Date.parse(a.timestamp)) && Date.parse(a.timestamp) <= Date.now())
        .slice()
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .slice(0, 3),
    [sharedActivities]
  );

  React.useEffect(() => {
    const totalSavingsNow = bonusBalance + emergencyBalance + goalBalance;
    const debtPressure = (accountStore.flexiUsed ?? 0) + (accountStore.flexiCreditUsed ?? 0);
    syncGamification({
      activities: sharedActivities,
      gxHealthScore: safeHealthScore,
      totalSavings: totalSavingsNow,
      debtPressure,
    });
  }, [
    sharedActivities,
    safeHealthScore,
    bonusBalance,
    emergencyBalance,
    goalBalance,
    accountStore.flexiUsed,
    accountStore.flexiCreditUsed,
    syncGamification,
  ]);

  React.useEffect(() => {
    const earned = useGamificationStore.getState().autoCreditStreakMilestones();
    if (earned.length === 0) return;
    const addNotification = useNotificationStore.getState().addNotification;
    const addActivity = useActivityStore.getState().addActivity;
    for (const e of earned) {
      useSavingsStore.getState().manualSave("bonus", e.bonus);
      addNotification({
        id: `notif-streak-auto-${e.id}-${Date.now()}`,
        title: "Streak Reward Credited",
        message: `${formatRM(e.bonus)} credited to Bonus for ${e.id.replace("-", " ")}.`,
        read: false,
        type: "info",
        time: "Just now",
      });
      addActivity({
        id: `act-streak-auto-${e.id}-${Date.now()}`,
        type: "streak_milestone_reward",
        title: "Streak Reward Credited",
        description: `${formatRM(e.bonus)} added to Bonus`,
        amount: e.bonus,
        direction: "credit",
        timestamp: new Date().toISOString(),
        route: "/savings",
      });
    }
  }, [gamifyStreakForMilestones, gamifyAutoCreditedKey]);

  React.useEffect(() => {
    const g = useGamificationStore.getState();
    g.recomputeCampaignProgress({ activities: sharedActivities, emergencyBalance });
    const tid = setTimeout(() => {
      const rewards = g.settlePendingCampaignRewards();
      if (rewards.length === 0) return;
      const addNotification = useNotificationStore.getState().addNotification;
      const addActivity = useActivityStore.getState().addActivity;
      for (const r of rewards) {
        if (r.bonus > 0) useSavingsStore.getState().manualSave("bonus", r.bonus);
        addNotification({
          id: `notif-camp-${r.id}-${Date.now()}`,
          title: "Campaign completed",
          message: `${r.title} reward credited: ${formatRM(r.bonus)} + ${r.water} water · +${r.points} SmartScore.`,
          read: false,
          type: "campaign",
          time: "Just now",
          linkedScreen: `/campaign?id=${encodeURIComponent(r.id)}`,
        });
        addActivity({
          id: `act-camp-${r.id}-${Date.now()}`,
          type: "mission_completed",
          title: "Campaign Completed",
          description: `${r.title} reward credited`,
          amount: r.bonus > 0 ? r.bonus : undefined,
          direction: r.bonus > 0 ? "credit" : undefined,
          timestamp: new Date().toISOString(),
          route: "/campaign",
        });
      }
    }, 0);
    return () => {
      clearTimeout(tid);
      g.settlePendingCampaignRewards();
    };
  }, [sharedActivities, emergencyBalance]);

  const onWaterTree = () => {
    const res = waterTree();
    if (!res.ok) return;
    activityStore.addActivity({
      id: `act-water-${Date.now()}`,
      type: "money_tree_watered",
      title: "Money Tree Watered",
      description: "You spent 1 water and gained +20 EXP",
      timestamp: new Date().toISOString(),
      route: "/dashboard",
    });
    if (res.leveledUp) {
      if (res.levelReward > 0) {
        useSavingsStore.getState().manualSave("bonus", res.levelReward);
      }
      activityStore.addActivity({
        id: `act-tree-level-${Date.now()}`,
        type: "money_tree_level_up",
        title: "Money Tree Level Up",
        description: `Reached level ${useGamificationStore.getState().treeLevel}`,
        amount: res.levelReward > 0 ? res.levelReward : undefined,
        direction: res.levelReward > 0 ? "credit" : undefined,
        timestamp: new Date().toISOString(),
        route: "/dashboard",
      });
      notificationStore.addNotification({
        id: `notif-tree-level-${Date.now()}`,
        title: "Money Tree Level Up",
        message: res.levelReward > 0 ? `Level up reward credited: ${formatRM(res.levelReward)}.` : "Your tree reached a new level.",
        read: false,
        type: "info",
        time: "Just now",
      });
    }
  };

  if (!currentUser) return <Redirect href="/auth/login" />;
  if (!userHasPinSet()) return <Redirect href="/auth/app-pin-setup" />;

  const normalizedPath = pathname.replace(/\/$/, "") || "/";
  const isTabActive = (route?: string) =>
    Boolean(route) && (normalizedPath === route || normalizedPath === `${route}/`);

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1E0D4E" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Hero: soft gradient, greeting, balance ── */}
        <LinearGradient
          colors={["#3B1578", "#2D0D6B", "#1E0A50", "#12082E"]}
          locations={[0, 0.35, 0.7, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.hero}
        >
          {/* Subtle top tint overlay for depth */}
          <View style={styles.heroTint} pointerEvents="none" />

          {/* Top bar */}
          <View style={styles.topBar}>
            <View>
              <Text style={styles.brand}>SmartGX</Text>
              <Text style={styles.greeting}>
                {firstName ? `Hello, ${firstName}` : "Hello"}
              </Text>
              <Text style={styles.welcome}>Your financial overview today</Text>
            </View>

            {/* Right icons: bell + profile */}
            <View style={styles.topBarIcons}>
              <Pressable style={styles.streakBadge} onPress={() => router.push("/savingstreak" as never)}>
                <Text style={styles.streakEmoji}>🔥</Text>
                <Text style={styles.streakCount}>{gamifyCurrentStreak}</Text>
              </Pressable>
              <Pressable
                style={styles.iconButton}
                onPress={() => router.push("/notifications" as never)}
              >
                <BellIcon />
                {unreadCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {unreadCount > 9 ? "9+" : String(unreadCount)}
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                style={styles.profileButton}
                onPress={() => router.push("/profile" as never)}
              >
                <Text style={styles.profileAvatarLetter}>{avatarLetter}</Text>
              </Pressable>
            </View>
          </View>

          {/* Balance — text in gradient, no hard card */}
          <View style={styles.balanceArea}>
            <Text style={styles.balanceLabel}>Total balance</Text>
            <Text style={styles.totalBalance}>{formatRM(totalBalance)}</Text>
            <View style={styles.heroPillRow}>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>SmartGX secured · Balance info</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ── Shortcuts ── */}
        <View style={styles.actionsWrap}>
          {ACTIONS.map((item) => (
            <Pressable
              key={item.label}
              style={styles.actionItem}
              onPress={() => item.route && router.push(item.route as never)}
            >
              <View style={styles.actionIconWrap}>
                {item.renderIcon("#FFFFFF")}
              </View>
              <Text style={styles.actionLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Account cards ── */}
        <View style={styles.section}>
          <View style={styles.accountGrid}>
            <Pressable
              style={styles.accountCard}
              onPress={() => router.push("/transactions" as never)}
            >
              <Text style={styles.accountLabel}>Main account</Text>
              <Text style={styles.accountAmount}>{formatRM(mainBalance)}</Text>
              <View style={styles.accountLinkRow}>
                <Text style={styles.accountLink}>View Transaction</Text>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M9 18L15 12L9 6" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
            </Pressable>
            <Pressable
              style={styles.accountCard}
              onPress={() => router.push("/savings" as never)}
            >
              <Text style={styles.accountLabel}>Saving Pockets</Text>
              <Text style={styles.accountAmount}>{formatRM(totalSavings)}</Text>
              <Text style={styles.accountHint}>Bonus · Emergency · Goals →</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>Latest Activity</Text>
            </View>
            {activities.length === 0 ? <Text style={styles.emptyHint}>No recent activity yet.</Text> : null}
            {activities.map((act, idx) => (
              <Pressable key={act.id} style={styles.activityRow} onPress={() => act.route && router.push(act.route as never)}>
                <View style={styles.activityDot} />
                <View style={styles.activityBody}>
                  <Text style={styles.activityTitle}>{act.title}</Text>
                  <Text style={styles.activitySub}>{act.description}</Text>
                </View>
                {typeof act.amount === "number" ? (
                  <Text style={[styles.activityAmt, act.direction === "debit" ? styles.activityAmtDebit : styles.activityAmtCredit]}>
                    {act.direction === "debit" ? "-" : "+"}{formatRM(act.amount)}
                  </Text>
                ) : null}
                {idx < activities.length - 1 ? <View style={styles.activityDivider} /> : null}
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── GXHealth preview card ── */}
        <View style={styles.section}>
          <Pressable
            style={styles.healthCard}
            onPress={() => router.push("/gxhealth" as never)}
          >
            {/* Left: score ring mini */}
            <View style={styles.healthRingWrap}>
              <Svg width={56} height={56} viewBox="0 0 56 56">
                <Circle cx={28} cy={28} r={22} stroke="rgba(255,255,255,0.08)" strokeWidth={5} fill="none" />
                <Circle
                  cx={28} cy={28} r={22}
                  stroke={healthReport.statusColor}
                  strokeWidth={5}
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 22} ${2 * Math.PI * 22}`}
                  strokeDashoffset={2 * Math.PI * 22 * (1 - safeHealthScore / 100)}
                  strokeLinecap="round"
                  rotation="-90"
                  origin="28,28"
                />
              </Svg>
              <View style={styles.healthRingScore}>
                <Text style={[styles.healthRingNum, { color: healthReport.statusColor }]}>
                  {safeHealthScore}
                </Text>
              </View>
            </View>

            {/* Middle: text */}
            <View style={styles.healthCardBody}>
              <View style={styles.healthCardTitleRow}>
                <Text style={styles.healthCardTitle}>GXHealth</Text>
                <View style={[styles.healthStatusPill, { backgroundColor: healthReport.statusColor + "22", borderColor: healthReport.statusColor + "55" }]}>
                  <Text style={[styles.healthStatusPillText, { color: healthReport.statusColor }]}>
                    {healthReport.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.healthCardHint} numberOfLines={2}>
                {healthReport.aiAnalysis}
              </Text>
            </View>

            {/* Right: chevron */}
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M9 18L15 12L9 6" stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>

        {/* ── FlexiCredit + Campaign promo carousel near bottom ── */}
        <View style={styles.section}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={320}
            contentContainerStyle={styles.flexiCarouselContent}
          >
            <Pressable style={styles.flexiCreditCard} onPress={() => router.push("/flexicredit" as never)}>
              <LinearGradient
                colors={["#20114A", "#1A1240", "#111827"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.flexiGradient}
              >
                <View style={styles.flexiCreditTopRow}>
                  <Text style={styles.flexiCreditTitle}>FlexiCredit</Text>
                  <View style={styles.flexiCreditBadge}>
                    <Text style={styles.flexiCreditBadgeText}>AI Debt Guard</Text>
                  </View>
                </View>
                <Text style={styles.flexiCreditBody}>
                  Smart credit support with AI debt protection.
                </Text>
                <Text style={styles.flexiCreditBody}>
                  AI checks your repayment readiness before drawdown.
                </Text>
                <Text style={styles.flexiCreditSub}>
                  {flexiCredit.status === "not_applied"
                    ? "Check your FlexiCredit readiness"
                    : flexiCredit.status === "under_review"
                      ? "Application under review"
                      : flexiCredit.status === "approved"
                        ? `Approved limit ${formatRM(flexiCredit.approvedLimit)}`
                        : flexiCredit.status === "activated"
                          ? `Available credit ${formatRM(flexiCredit.availableLimit)}`
                          : flexiCredit.status.replace(/_/g, " ")}
                </Text>
                <Text style={styles.flexiCreditExplore}>Explore →</Text>
              </LinearGradient>
            </Pressable>
            {gamifyCampaigns.map((c) => (
              <Pressable key={c.id} style={styles.flexiCreditCard} onPress={() => router.push(`/campaign?id=${c.id}` as never)}>
                <LinearGradient
                  colors={c.id === "smartsave" ? ["#12213A", "#162D58", "#1A1B3A"] : c.id === "roundup_boost" ? ["#2D183C", "#3D1F59", "#1E1633"] : c.id === "debt_free" ? ["#2A1A1A", "#3D231E", "#1C1B27"] : c.id === "friend_streak" ? ["#1A2B2E", "#1C3F4D", "#162233"] : ["#1E2A21", "#234533", "#14251D"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.flexiGradient}
                >
                  <View style={styles.flexiCreditTopRow}>
                    <Text style={styles.flexiCreditTitleCampaign} numberOfLines={2}>
                      {c.title}
                    </Text>
                    <View style={styles.campaignHeaderRight}>
                      {c.status === "reward_credited" ? (
                        <View style={styles.campaignDonePill}>
                          <Text style={styles.campaignDonePillText}>Credited</Text>
                        </View>
                      ) : null}
                      {c.status === "completed_reward_pending" ? (
                        <View style={styles.campaignPendingDotWrap}>
                          <View style={styles.notifyDotSmallInline} />
                        </View>
                      ) : null}
                      <View style={styles.flexiCreditBadgeCampaign}>
                        <Text style={styles.flexiCreditBadgeTextCampaign}>Campaign</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.flexiCreditBody}>{c.description}</Text>
                  <Text style={styles.flexiCreditBody}>Progress {c.progress}/{c.target}</Text>
                  <Text style={styles.flexiCreditSub}>Reward {formatRM(c.rewardBonus)} + {c.rewardWater} water</Text>
                  <Text style={styles.flexiCreditExplore}>View campaign →</Text>
                </LinearGradient>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.treeCard}>
            <View style={styles.treeTopRow}>
              <Text style={styles.treeTitle}>Money Tree</Text>
              <View style={styles.treeHeaderActions}>
                <Pressable style={styles.treeRankChip} onPress={() => router.push("/leaderboard" as never)}>
                  <Text style={styles.treeRankChipEmoji}>🏆</Text>
                  <View>
                    <Text style={styles.treeRankChipTitle}>Rank #{moneyTreeRank}</Text>
                    <Text style={styles.treeRankChipSub}>View SmartScore</Text>
                  </View>
                </Pressable>
                <Text style={styles.treeLvl}>Level {gamifyTreeLevel}</Text>
              </View>
            </View>
            <View style={styles.treeVisualWrap}>
              <Text style={styles.treeVisual}>
                {gamifyTreeLevel >= 5 ? "🌳✨" : gamifyTreeLevel >= 4 ? "🌳" : gamifyTreeLevel >= 3 ? "🌿" : gamifyTreeLevel >= 2 ? "🪴" : "🌱"}
              </Text>
              <View style={styles.treeMetaCol}>
                <Text style={styles.treeMeta}>Health {gamifyTreeHealth}/100</Text>
                <Text style={styles.treeMeta}>EXP {gamifyTreeExp}/100</Text>
                <View style={styles.waterRow}>
                  <Text style={styles.treeMeta}>Water 💧 {gamifyWater}</Text>
                  <View style={styles.missionIconWrap}>
                    <Pressable style={styles.waterPlusBtn} onPress={() => router.push("/missions" as never)}>
                      <Text style={styles.waterPlusText}>+</Text>
                    </Pressable>
                    {hasUnclaimedMissionReward ? <View style={styles.notifyDotSmall} /> : null}
                  </View>
                </View>
                <View style={styles.expTrack}>
                  <View style={[styles.expFill, { width: `${gamifyTreeExp}%` }]} />
                </View>
              </View>
            </View>
            <Text style={styles.treeStateText}>
              {gamifyTreeState === "flourishing" ? "Flourishing" : gamifyTreeState === "healthy" ? "Healthy" : gamifyTreeState === "needs_care" ? "Needs Care" : "Withering"}
            </Text>
            {treeAiLine ? <Text style={styles.treeAiInsight}>{treeAiLine}</Text> : null}
            <Pressable style={styles.waterBtn} onPress={onWaterTree}>
              <Text style={styles.waterBtnText}>Water Tree</Text>
            </Pressable>
            <View style={styles.missionBtnWrap}>
              <Pressable style={styles.missionsBtn} onPress={() => router.push("/missions" as never)}>
                <Text style={styles.missionsBtnText}>Go to Missions</Text>
              </Pressable>
              {hasUnclaimedMissionReward ? <View style={styles.notifyDotOnButton} /> : null}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── Floating FAQ / ChatNow button ── */}
      <Pressable
        style={styles.floatingFAQ}
        onPress={() => router.push("/chatnow" as never)}
      >
        <BotIcon size={18} />
        <Text style={styles.floatingFAQLabel}>FAQ</Text>
      </Pressable>

      {/* ── Fixed bottom taskbar ── */}
      <View style={styles.tabBar}>
        {NAV_TABS.map((tab) =>
          tab.primary ? (
            <View key={tab.label} style={styles.tabPrimaryWrap}>
              <Pressable
                style={styles.tabScanBtn}
                onPress={() => tab.route && router.push(tab.route as never)}
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
              {tab.renderIcon(isTabActive(tab.route) ? TASKBAR_ACTIVE : colors.textMuted)}
              <Text style={[styles.tabLabel, isTabActive(tab.route) && styles.tabLabelActive]}>
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
    paddingBottom: 44,
    gap: spacing.xl,
    overflow: "hidden",
  },
  heroTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(90, 30, 180, 0.06)",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brand: {
    color: "#C4B5FD",
    fontWeight: "800",
    fontSize: typography.caption,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
    opacity: 0.85,
  },
  greeting: {
    color: "#FFFFFF",
    fontSize: typography.heading,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  welcome: {
    color: "#BFB0E8",
    fontSize: typography.body,
    marginTop: 2,
    opacity: 0.8,
  },

  /* Top-right icon group */
  topBarIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.45)",
    backgroundColor: "rgba(31,17,58,0.55)",
  },
  streakEmoji: { fontSize: 13 },
  streakCount: { color: "#F3F4F6", fontWeight: "800", fontSize: 12 },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: "#1E0D4E",
  },
  bellBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },

  /* Profile avatar */
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(109, 40, 217, 0.45)",
    borderWidth: 1.5,
    borderColor: "rgba(196, 181, 253, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarLetter: {
    color: "#EDE9FE",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 20,
  },

  /* Balance */
  balanceArea: {
    gap: spacing.sm,
  },
  balanceLabel: {
    color: "#C4B5FD",
    fontSize: typography.body,
    opacity: 0.9,
  },
  totalBalance: {
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
  },
  heroPillRow: {
    flexDirection: "row",
  },
  heroPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(139, 92, 246, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.22)",
  },
  heroPillText: {
    color: "#C4B5FD",
    fontSize: typography.caption,
    opacity: 0.85,
  },

  /* Actions */
  actionsWrap: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  actionItem: {
    alignItems: "center",
    gap: spacing.sm,
  },
  actionIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: "600",
    textAlign: "center",
  },

  /* Everyday account */
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.subheading,
  },
  accountGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  accountCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  accountLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  accountAmount: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: typography.subheading,
  },
  accountHint: {
    color: colors.textSecondary,
    fontSize: typography.caption,
  },
  accountLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  accountLink: {
    color: "#A78BFA",
    fontSize: typography.caption,
    fontWeight: "700",
  },

  /* Latest activity card */
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  emptyHint: { color: colors.textMuted, fontSize: typography.caption, textAlign: "center", paddingVertical: spacing.sm },
  activityRow: { paddingVertical: 8, position: "relative", flexDirection: "row", alignItems: "center", gap: spacing.sm },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#A78BFA" },
  activityBody: { flex: 1, gap: 1 },
  activityTitle: { color: colors.textPrimary, fontSize: typography.caption, fontWeight: "800" },
  activitySub: { color: colors.textMuted, fontSize: 11 },
  activityAmt: { fontSize: typography.caption, fontWeight: "800" },
  activityAmtCredit: { color: "#22D3EE" },
  activityAmtDebit: { color: "#EF4444" },
  activityDivider: { position: "absolute", left: 14, right: 0, bottom: 0, height: 1, backgroundColor: colors.border },
  flexiCarouselContent: {
    paddingRight: spacing.lg,
  },
  flexiCreditCard: {
    width: 320,
    minHeight: 196,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.35)",
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  flexiGradient: {
    flex: 1,
    minHeight: 196,
    padding: spacing.md,
    gap: spacing.xs,
    justifyContent: "space-between",
  },
  flexiCreditTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  flexiCreditTitle: { color: "#FFFFFF", fontWeight: "800", fontSize: typography.subheading },
  flexiCreditTitleCampaign: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: typography.subheading,
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  flexiCreditBadge: {
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.5)",
    backgroundColor: "rgba(56,189,248,0.15)",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  flexiCreditBadgeText: { color: "#38BDF8", fontSize: 10, fontWeight: "800" },
  flexiCreditBadgeCampaign: {
    backgroundColor: "#5B21B6",
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.95)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  flexiCreditBadgeTextCampaign: {
    color: "#F5F3FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  flexiCreditBody: { color: colors.textSecondary, fontSize: typography.caption, lineHeight: 18 },
  flexiCreditSub: { color: "#A78BFA", fontSize: typography.caption, fontWeight: "700" },
  flexiCreditExplore: { color: "#C4B5FD", fontSize: typography.caption, fontWeight: "700", marginTop: 2 },
  treeCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.35)",
    backgroundColor: "rgba(19,15,31,0.9)",
    padding: spacing.md,
    gap: spacing.sm,
  },
  treeTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  treeHeaderActions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  treeRankChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.45)",
    backgroundColor: "rgba(250,204,21,0.1)",
    shadowColor: "#FACC15",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  treeRankChipEmoji: { fontSize: 16 },
  treeRankChipTitle: { color: "#FDE68A", fontWeight: "900", fontSize: 12 },
  treeRankChipSub: { color: "rgba(226,232,240,0.85)", fontSize: 10, fontWeight: "600", marginTop: 1 },
  treeTitle: { color: "#FFF", fontSize: typography.subheading, fontWeight: "800" },
  treeLvl: { color: "#A78BFA", fontSize: typography.caption, fontWeight: "700" },
  treeVisualWrap: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  treeVisual: { fontSize: 44, width: 68, textAlign: "center" },
  treeMetaCol: { flex: 1, gap: 4 },
  waterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  missionIconWrap: { position: "relative" },
  missionBtnWrap: { position: "relative", marginTop: 4 },
  campaignHeaderRight: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    maxWidth: "46%",
    flexShrink: 0,
  },
  campaignDonePill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.25)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.45)",
  },
  campaignDonePillText: { color: "#86EFAC", fontSize: 9, fontWeight: "900" },
  campaignPendingDotWrap: { justifyContent: "center", paddingVertical: 2 },
  notifyDotSmallInline: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.9)",
  },
  notifyDotSmall: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.9)",
    zIndex: 2,
  },
  notifyDotOnButton: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    borderWidth: 1,
    borderColor: "#1E1533",
  },
  waterPlusBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34,211,238,0.2)",
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.45)",
  },
  waterPlusText: { color: "#22D3EE", fontWeight: "900", lineHeight: 16, marginTop: -1 },
  treeMeta: { color: "#CFC5EA", fontSize: typography.caption, fontWeight: "600" },
  expTrack: { height: 8, backgroundColor: "#2A1F42", borderRadius: 99, overflow: "hidden", marginTop: 2 },
  expFill: { height: "100%", backgroundColor: "#22D3EE" },
  treeStateText: { color: "#8BDEFF", fontSize: typography.caption, fontWeight: "700" },
  treeAiInsight: { color: "#C4B5FD", fontSize: 12, lineHeight: 17, marginTop: 6, opacity: 0.92 },
  waterBtn: {
    marginTop: 2,
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  waterBtnText: { color: "#FFF", fontWeight: "800" },
  missionsBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
    backgroundColor: "rgba(124,58,237,0.18)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  missionsBtnText: { color: "#D8B4FE", fontWeight: "800" },

  /* GXHealth preview card */
  healthCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  healthRingWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  healthRingScore: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  healthRingNum: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 16,
  },
  healthCardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  healthCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  healthCardTitle: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: "700",
  },
  healthStatusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  healthStatusPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  healthCardHint: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },

  /* Floating FAQ — sit clearly above tab bar / scan FAB */
  floatingFAQ: {
    position: "absolute",
    bottom: 100,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    zIndex: 100,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingFAQLabel: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
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
    color: TASKBAR_ACTIVE,
    fontWeight: "700",
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
