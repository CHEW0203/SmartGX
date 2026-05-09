import { create } from "zustand";
import type { ActivityType, AppActivity } from "../types/activity";
import { MOCK_SMARTGX_USERS } from "../data/mockSmartGXUsers";
import { clamp, normalizeScore, normalizeSmartScore, safeNumber } from "../lib/number";
import { getAuthUserId, syncGamification, syncGamificationDebounced } from "../services/db/persist";

type MissionType = "daily" | "weekly";

export type MissionLifecycleStatus = "in_progress" | "ready_to_claim" | "claimed";

export interface MissionItem {
  id: string;
  type: MissionType;
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardWater: number;
  rewardPoints: number;
  rewardBonus?: number;
  completed: boolean;
  claimed: boolean;
  /** Derived from progress + claimed for UI (e.g. red dot). */
  status: MissionLifecycleStatus;
  expiry: string;
}

interface FriendEntry {
  id: string;
  name: string;
  contact: string;
  smartScore: number;
  gxHealth: number;
  streak: number;
}

export interface CampaignItem {
  id: "smartsave" | "roundup_boost" | "debt_free" | "friend_streak" | "emergency_builder";
  title: string;
  description: string;
  rewardBonus: number;
  rewardWater: number;
  rewardPoints: number;
  progress: number;
  target: number;
  status: "not_started" | "active" | "completed_reward_pending" | "reward_credited" | "expired";
}

interface GamificationState {
  currentStreak: number;
  longestStreak: number;
  todayCompleted: boolean;
  monthlySavedAmount: number;
  streakMilestonesClaimed: string[];
  savedByDate: Record<string, number>;
  smartScore: number;
  rankMovement: number;
  water: number;
  treeLevel: number;
  treeExp: number;
  treeHealth: number;
  treeState: "flourishing" | "healthy" | "needs_care" | "withering";
  friends: FriendEntry[];
  missions: MissionItem[];
  campaigns: CampaignItem[];
  autoCreditedStreakMilestones: string[];
  lastSyncedAt: string | null;
  scoreBreakdown: {
    gxHealth: number;
    streak: number;
    missions: number;
    savingsGrowth: number;
    debtBehavior: number;
    repayment: number;
    total: number;
  };
  syncFromData: (input: {
    activities: AppActivity[];
    gxHealthScore: number;
    totalSavings: number;
    debtPressure: number;
  }) => void;
  claimStreakMilestone: (id: string) => { water: number; points: number; bonusReward: number } | null;
  claimMission: (id: string) => { water: number; points: number; bonusReward: number } | null;
  waterTree: () => { ok: boolean; leveledUp: boolean; levelReward: number };
  addFriendByContact: (contact: string) => { ok: boolean; reason?: string; friend?: FriendEntry };
  autoCreditStreakMilestones: () => Array<{ id: string; bonus: number; water: number; points: number }>;
  /** Advance campaign progress; may set `completed_reward_pending`. Call `settlePendingCampaignRewards` after to credit. */
  recomputeCampaignProgress: (input: { activities: AppActivity[]; emergencyBalance: number }) => void;
  settlePendingCampaignRewards: () => Array<{ id: string; title: string; bonus: number; water: number; points: number }>;
}

const SAVING_ACTIVITY_TYPES: ActivityType[] = ["manual_save", "auto_allocation", "round_up_saving", "save_instead"];

const DAY_MS = 1000 * 60 * 60 * 24;

function isoDay(iso: string): string {
  return iso.slice(0, 10);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function buildMissions(savedByDate: Record<string, number>, activities: AppActivity[], gxHealth: number): MissionItem[] {
  const today = todayKey();
  const weekCutoff = Date.now() - DAY_MS * 6;
  const todayActs = activities.filter((a) => isoDay(a.timestamp) === today);
  const weekActs = activities.filter((a) => Date.parse(a.timestamp) >= weekCutoff);
  const saveToday = Math.round((savedByDate[today] ?? 0) * 100) / 100;
  const manualSaveToday = todayActs.filter((a) => a.type === "manual_save").length;
  const roundUpToday = todayActs.filter((a) => a.type === "round_up_saving").length;
  const saveInsteadToday = todayActs.filter((a) => a.type === "save_instead").length;
  const saveDaysWeek = new Set(
    weekActs.filter((a) => SAVING_ACTIVITY_TYPES.includes(a.type)).map((a) => isoDay(a.timestamp))
  ).size;
  const roundUpWeek = weekActs.filter((a) => a.type === "round_up_saving").length;
  const repayWeek = weekActs.filter((a) => a.type === "flexicredit_repayment").length;

  const mk = (
    id: string,
    type: MissionType,
    title: string,
    description: string,
    progress: number,
    target: number,
    rewardWater: number,
    rewardPoints: number,
    rewardBonus = 0
  ): MissionItem => ({
    id,
    type,
    title,
    description,
    progress: Math.min(progress, target),
    target,
    rewardWater,
    rewardPoints,
    rewardBonus,
    completed: progress >= target,
    claimed: false,
    expiry: type === "daily" ? today : new Date(Date.now() + DAY_MS * 7).toISOString().slice(0, 10),
    status: "in_progress",
  });

  return [
    mk("d-save-5", "daily", "Save RM5 today", "Save at least RM5 into Bonus/Emergency/Goals.", saveToday, 5, 1, 20),
    mk("d-manual", "daily", "Complete one Manual Save", "Do one manual save today.", manualSaveToday, 1, 1, 20),
    mk("d-roundup", "daily", "Complete one Round-up Saving", "Trigger one round-up saving today.", roundUpToday, 1, 1, 15),
    mk("d-saveinstead", "daily", "Use Save Instead once", "Choose Save Instead one time today.", saveInsteadToday, 1, 1, 30),
    mk("w-save-3days", "weekly", "Save on 3 days this week", "Complete saving action on at least 3 different days.", saveDaysWeek, 3, 3, 80, 2),
    mk("w-roundup-5", "weekly", "Complete 5 Round-up Savings", "Build consistency with round-up actions.", roundUpWeek, 5, 3, 80),
    mk("w-repay", "weekly", "Make one repayment on time", "Complete one FlexiCredit repayment this week.", repayWeek, 1, 2, 50),
    mk("w-gx70", "weekly", "Keep GXHealth above 70", "Maintain strong financial health this week.", gxHealth >= 70 ? 1 : 0, 1, 2, 70),
  ];
}

function treeStateFromHealth(h: number): GamificationState["treeState"] {
  if (h >= 80) return "flourishing";
  if (h >= 60) return "healthy";
  if (h >= 40) return "needs_care";
  return "withering";
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
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
  scoreBreakdown: { gxHealth: 0, streak: 0, missions: 0, savingsGrowth: 0, debtBehavior: 0, repayment: 0, total: 420 },
  lastSyncedAt: null,

  syncFromData: ({ activities, gxHealthScore, totalSavings, debtPressure }) => {
    const savedByDate: Record<string, number> = { ...get().savedByDate };
    for (const a of activities) {
      if (!SAVING_ACTIVITY_TYPES.includes(a.type)) continue;
      if (typeof a.amount !== "number") continue;
      const d = isoDay(a.timestamp);
      savedByDate[d] = Math.round(((savedByDate[d] ?? 0) + a.amount) * 100) / 100;
    }

    const savedDays = Object.keys(savedByDate).filter((d) => savedByDate[d] >= 1).sort();
    const today = todayKey();
    let currentStreak = 0;
    let longestStreak = 0;
    let rolling = 0;
    let prev: string | null = null;
    for (const d of savedDays) {
      if (!prev) {
        rolling = 1;
      } else {
        const gap = Math.round((Date.parse(d) - Date.parse(prev)) / DAY_MS);
        rolling = gap === 1 ? rolling + 1 : 1;
      }
      if (rolling > longestStreak) longestStreak = rolling;
      prev = d;
    }
    if (savedDays.length > 0) {
      const last = savedDays[savedDays.length - 1];
      const gapToToday = Math.round((Date.parse(today) - Date.parse(last)) / DAY_MS);
      if (gapToToday === 0) {
        currentStreak = rolling;
      } else if (gapToToday === 1) {
        currentStreak = rolling;
      } else {
        currentStreak = 0;
      }
    }
    const todayCompleted = (savedByDate[today] ?? 0) >= 1;
    const month = today.slice(0, 7);
    const monthlySavedAmount = Math.round(
      Object.entries(savedByDate)
        .filter(([d]) => d.startsWith(month))
        .reduce((sum, [, v]) => sum + v, 0) * 100
    ) / 100;

    const normalizedGxHealth = normalizeScore(gxHealthScore, 70);
    const normalizedTotalSavings = Math.max(0, safeNumber(totalSavings, 0));
    const normalizedDebtPressure = Math.max(0, safeNumber(debtPressure, 0));

    const missions = buildMissions(savedByDate, activities, normalizedGxHealth).map((m) => {
      const old = get().missions.find((x) => x.id === m.id);
      const claimed = old?.claimed ?? false;
      const merged = old ? { ...m, claimed } : { ...m, claimed: false };
      const status: MissionLifecycleStatus =
        merged.claimed ? "claimed" : merged.completed ? "ready_to_claim" : "in_progress";
      return { ...merged, status };
    });

    const completedDaily = missions.filter((m) => m.type === "daily" && m.completed).length;
    const completedWeekly = missions.filter((m) => m.type === "weekly" && m.completed).length;
    const saveInsteadCount = activities.filter((a) => a.type === "save_instead").length;
    const repayCount = activities.filter((a) => a.type === "flexicredit_repayment").length;
    const riskyContinue = activities.filter((a) => a.type === "flexicredit_drawdown").length;
    const missionRate = missions.length === 0 ? 0 : (missions.filter((m) => m.completed).length / missions.length);
    const debtBehavior = Math.max(0, 100 - Math.min(100, normalizedDebtPressure));
    const savingsGrowthScore = Math.min(100, normalizedTotalSavings / 10);

    const scoreGX = Math.round(normalizedGxHealth * 0.3 * 10) / 10;
    const scoreStreak = Math.round(Math.min(100, currentStreak * 10) * 0.2 * 10) / 10;
    const scoreMissions = Math.round((missionRate * 100) * 0.2 * 10) / 10;
    const scoreSavings = Math.round(savingsGrowthScore * 0.15 * 10) / 10;
    const scoreDebt = Math.round(debtBehavior * 0.1 * 10) / 10;
    const scoreRepay = Math.round(Math.min(100, repayCount * 30) * 0.05 * 10) / 10;
    const newScore = clamp(
      Math.round(
        scoreGX +
          scoreStreak +
          scoreMissions +
          scoreSavings +
          scoreDebt +
          scoreRepay +
          saveInsteadCount * 3 -
          riskyContinue * 8
      ),
      0,
      1000
    );

    set((s) => {
      const breakdownTotal = safeNumber(s.scoreBreakdown?.total, safeNumber(s.smartScore, 420));
      const rewardScoreExtra = Math.max(0, Math.round((safeNumber(s.smartScore, 420) - breakdownTotal) * 100) / 100);
      const baseScore = normalizeSmartScore(newScore, 420);
      return {
        savedByDate,
        currentStreak,
        longestStreak: Math.max(s.longestStreak, longestStreak),
        todayCompleted,
        monthlySavedAmount,
        missions,
        rankMovement: baseScore > safeNumber(s.smartScore, 420) ? 1 : baseScore < safeNumber(s.smartScore, 420) ? -1 : 0,
        scoreBreakdown: {
          gxHealth: safeNumber(scoreGX, 0),
          streak: safeNumber(scoreStreak, 0),
          missions: safeNumber(scoreMissions, 0),
          savingsGrowth: safeNumber(scoreSavings, 0),
          debtBehavior: safeNumber(scoreDebt, 0),
          repayment: safeNumber(scoreRepay, 0),
          total: baseScore,
        },
        smartScore: normalizeSmartScore(Math.round((baseScore + rewardScoreExtra) * 100) / 100, 420),
        // Money Tree health / state come from watering & DB — do not overwrite on every dashboard sync.
        lastSyncedAt: new Date().toISOString(),
      };
    });
    if (getAuthUserId()) syncGamificationDebounced();
  },

  autoCreditStreakMilestones: () => {
    const s = get();
    const milestones = [
      { id: "streak-3", minStreak: 3, bonus: 1, water: 2, points: 30 },
      { id: "streak-7", minStreak: 7, bonus: 3, water: 5, points: 60 },
      { id: "streak-14", minStreak: 14, bonus: 8, water: 8, points: 120 },
      { id: "streak-30", minStreak: 30, bonus: 20, water: 12, points: 220 },
    ];
    const earned = milestones.filter((m) => s.currentStreak >= m.minStreak && !s.autoCreditedStreakMilestones.includes(m.id));
    if (earned.length === 0) return [];
    set((st) => ({
      autoCreditedStreakMilestones: [...st.autoCreditedStreakMilestones, ...earned.map((e) => e.id)],
      streakMilestonesClaimed: [...st.streakMilestonesClaimed, ...earned.map((e) => e.id)],
      water: st.water + earned.reduce((sum, e) => sum + e.water, 0),
      smartScore: st.smartScore + earned.reduce((sum, e) => sum + e.points, 0),
    }));
    return earned.map((e) => ({ id: e.id, bonus: e.bonus, water: e.water, points: e.points }));
  },

  recomputeCampaignProgress: ({ activities, emergencyBalance }) => {
    const s = get();
    const month = todayKey().slice(0, 7);
    const savingAmountMonth = activities
      .filter((a) => SAVING_ACTIVITY_TYPES.includes(a.type) && a.timestamp.startsWith(month))
      .reduce((sum, a) => sum + (a.amount ?? 0), 0);
    const roundUpMonth = activities.filter((a) => a.type === "round_up_saving" && a.timestamp.startsWith(month)).length;
    const riskyCreditCount = activities.filter((a) => a.type === "flexicredit_drawdown").length;
    const friendCount = s.friends.length;
    const debtFreeDays = riskyCreditCount === 0 ? Math.min(30, Math.max(0, s.currentStreak)) : 0;
    const emergencyProgress = Math.max(0, emergencyBalance);

    const flowStatus = (c: CampaignItem, activeWhen: boolean): CampaignItem["status"] => {
      if (c.status === "reward_credited") return "reward_credited";
      if (c.status === "expired") return "expired";
      if (c.status === "completed_reward_pending") return "completed_reward_pending";
      return activeWhen ? "active" : c.status === "active" ? "active" : "not_started";
    };

    const next = s.campaigns.map((c) => {
      if (c.id === "smartsave") {
        const progress = Math.min(c.target, Math.round(savingAmountMonth * 100) / 100);
        return { ...c, progress, status: flowStatus(c, progress > 0) };
      }
      if (c.id === "roundup_boost") {
        const progress = Math.min(c.target, roundUpMonth);
        return { ...c, progress, status: flowStatus(c, roundUpMonth > 0) };
      }
      if (c.id === "debt_free") {
        const progress = Math.min(c.target, debtFreeDays);
        return { ...c, progress, status: flowStatus(c, debtFreeDays > 0) };
      }
      if (c.id === "friend_streak") {
        const progress = (friendCount > 0 ? 1 : 0) + (s.currentStreak >= 7 ? 1 : 0);
        return { ...c, progress, status: flowStatus(c, progress > 0) };
      }
      const progress = Math.min(c.target, emergencyProgress);
      return { ...c, progress, status: flowStatus(c, emergencyProgress > 0) };
    }).map((c) => {
      if (c.status === "reward_credited" || c.status === "expired") return c;
      if (c.status === "completed_reward_pending") return c;
      if (c.progress >= c.target) return { ...c, status: "completed_reward_pending" as const };
      return c;
    });

    set({ campaigns: next });
  },

  settlePendingCampaignRewards: () => {
    const s = get();
    const pending = s.campaigns.filter((c) => c.status === "completed_reward_pending");
    if (pending.length === 0) return [];
    const waterDelta = pending.reduce((sum, c) => sum + c.rewardWater, 0);
    const pointsDelta = pending.reduce((sum, c) => sum + c.rewardPoints, 0);
    set((st) => ({
      campaigns: st.campaigns.map((c) =>
        c.status === "completed_reward_pending" ? { ...c, status: "reward_credited" as const } : c
      ),
      water: st.water + waterDelta,
      smartScore: st.smartScore + pointsDelta,
    }));
    return pending.map((c) => ({
      id: c.id,
      title: c.title,
      bonus: c.rewardBonus,
      water: c.rewardWater,
      points: c.rewardPoints,
    }));
  },

  claimStreakMilestone: (id) => {
    const s = get();
    if (s.streakMilestonesClaimed.includes(id)) return null;
    const milestones: Record<string, { minStreak?: number; minMonthly?: number; bonus: number; water: number; points: number }> = {
      "streak-3": { minStreak: 3, bonus: 1, water: 2, points: 30 },
      "streak-7": { minStreak: 7, bonus: 3, water: 5, points: 60 },
      "streak-14": { minStreak: 14, bonus: 8, water: 8, points: 120 },
      "streak-30": { minStreak: 30, bonus: 20, water: 12, points: 220 },
      "save-100": { minMonthly: 100, bonus: 2, water: 2, points: 40 },
      "save-300": { minMonthly: 300, bonus: 5, water: 4, points: 80 },
      "save-500": { minMonthly: 500, bonus: 10, water: 6, points: 120 },
    };
    const m = milestones[id];
    if (!m) return null;
    if (typeof m.minStreak === "number" && s.currentStreak < m.minStreak) return null;
    if (typeof m.minMonthly === "number" && s.monthlySavedAmount < m.minMonthly) return null;
    set((st) => ({
      streakMilestonesClaimed: [...st.streakMilestonesClaimed, id],
      water: st.water + m.water,
      smartScore: st.smartScore + m.points,
    }));
    if (getAuthUserId()) syncGamification();
    return { water: m.water, points: m.points, bonusReward: m.bonus };
  },

  claimMission: (id) => {
    const s = get();
    const mission = s.missions.find((m) => m.id === id);
    if (!mission || !mission.completed || mission.claimed) return null;
    set((st) => ({
      missions: st.missions.map((m) =>
        m.id === id ? { ...m, claimed: true, status: "claimed" as const } : m
      ),
      water: st.water + mission.rewardWater,
      smartScore: st.smartScore + mission.rewardPoints,
    }));
    if (getAuthUserId()) syncGamification();
    return { water: mission.rewardWater, points: mission.rewardPoints, bonusReward: mission.rewardBonus ?? 0 };
  },

  waterTree: () => {
    const s = get();
    if (s.water <= 0) return { ok: false, leveledUp: false, levelReward: 0 };
    let nextExp = s.treeExp + 20;
    let nextLevel = s.treeLevel;
    let levelReward = 0;
    while (nextExp >= 100 && nextLevel < 5) {
      nextExp -= 100;
      nextLevel += 1;
      if (nextLevel === 2) levelReward += 1;
      if (nextLevel === 3) levelReward += 3;
      if (nextLevel === 4) levelReward += 5;
      if (nextLevel === 5) levelReward += 10;
    }
    const nextHealth = Math.min(100, s.treeHealth + 2);
    set({
      water: s.water - 1,
      treeExp: nextExp,
      treeLevel: nextLevel,
      treeHealth: nextHealth,
      treeState: treeStateFromHealth(nextHealth),
    });
    if (getAuthUserId()) syncGamification();
    return { ok: true, leveledUp: nextLevel > s.treeLevel, levelReward };
  },

  addFriendByContact: (contact) => {
    const normalize = contact.replace(/\s+/g, "");
    const valid = /^(\+?6?01)[0-9]{8,9}$/.test(normalize);
    if (!valid) return { ok: false, reason: "Invalid contact format." };
    const match = MOCK_SMARTGX_USERS.find((u) => u.contact === normalize);
    if (!match) return { ok: false, reason: "This contact is not using SmartGX yet." };
    const s = get();
    if (s.friends.some((f) => f.contact === normalize)) return { ok: false, reason: "Already in your friends list." };
    const friend: FriendEntry = {
      id: match.id,
      name: match.name,
      contact: match.contact,
      smartScore: match.smartScore,
      gxHealth: match.gxHealth,
      streak: match.streak,
    };
    set((st) => ({ friends: [...st.friends, friend] }));
    return { ok: true, friend };
  },
}));

