import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { randomUUIDCompat } from "../lib/uuid";
import type {
  ChallengeDailyMission,
  ChallengeDailyProgress,
  ChallengeDurationDays,
  ChallengeLevelEvent,
  ChallengeParticipant,
  ChallengeRecord,
  ChallengeRewardRecord,
} from "../types/challenge";
import {
  assignRanks,
  applyWaterToChallengeTree,
  buildMissionRows,
  challengeTitleForDuration,
  eligibleRewardRanks,
  evaluateMission,
  migrateLegacyChallengeMissionRow,
  pickDailyMissionDefs,
  recalcChallengeSmartScore,
  rewardConfigForDuration,
  WATER_DAILY_PERFECT_BONUS,
  WATER_STREAK_14_BONUS,
  WATER_STREAK_3_BONUS,
  WATER_STREAK_7_BONUS,
} from "../features/challenge/challenge.engine";
import {
  countClaimedChallengeMissionsForUser,
  evaluateChallengeQualification,
} from "../features/challenge/challenge.qualification";
import { formatRM } from "../lib/currency";
import { buildChallengeEvalContextForUser } from "../features/challenge/challengeEvalContext";
import { getSyncGxHealthScore } from "../features/health/gxHealthSync";
import { useSavingsStore } from "./savingsStore";
import { useNotificationStore } from "./notificationStore";
import { useActivityStore } from "./activityStore";
import { getAuthUserId } from "../services/db/persist";
import { persistChallengeBundle, loadChallengeBundleFromSupabase } from "../services/db/challengePersist";
import { useTransactionStore } from "./transactionStore";
import type { NotificationType } from "../types/notification";
import {
  buildPitchDemoActiveChallenge,
  buildPitchDemoCompletedChallenge,
  CHALLENGE_PITCH_DEMO_ACTIVE_ID,
  CHALLENGE_PITCH_DEMO_COMPLETED_ID,
  nextPitchDemoFriendSlot,
} from "../features/challenge/challengePitchDemo";

const STORAGE_KEY = "smartgx_challenge_bundle_v1";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDay(ts: string): string {
  return ts.slice(0, 10);
}

function challengeActiveOnDate(c: ChallengeRecord, day: string): boolean {
  return c.status === "active" && day >= c.startDate && day <= c.endDate;
}

function migrateMissionStatus(m: ChallengeDailyMission): ChallengeDailyMission {
  const s = m.status as string;
  if (s === "reward_granted") return { ...m, status: "claimed" };
  if (s === "completed") return { ...m, status: "completed_unclaimed" };
  if (s === "in_progress" || s === "completed_unclaimed" || s === "claimed") return { ...m, status: m.status };
  return { ...m, status: "in_progress" };
}

function migrateChallengesList(list: ChallengeRecord[]): ChallengeRecord[] {
  return list.map((c) => ({
    ...c,
    missions: c.missions.map((m) => migrateLegacyChallengeMissionRow(migrateMissionStatus(m))),
  }));
}

function missionIsClaimed(m: ChallengeDailyMission): boolean {
  const s = m.status as string;
  return s === "claimed" || s === "reward_granted";
}

function applyDailyPerfectAndStreak(
  ch: ChallengeRecord,
  me: ChallengeParticipant,
  dp: ChallengeDailyProgress,
  dayMissions: ChallengeDailyMission[],
  day: string
): { me: ChallengeParticipant; dp: ChallengeDailyProgress } {
  let nextMe = { ...me };
  let nextDp = { ...dp, updatedAt: new Date().toISOString() };
  const allFiveClaimed = dayMissions.length >= 5 && dayMissions.every((m) => missionIsClaimed(m));

  nextDp.completedMissionCount = dayMissions.filter((m) => missionIsClaimed(m)).length;
  nextDp.allFiveCompleted = allFiveClaimed;

  if (!allFiveClaimed) return { me: nextMe, dp: nextDp };

  if (!nextDp.dailyBonusGranted) {
    nextMe = {
      ...nextMe,
      challengeWater: nextMe.challengeWater + WATER_DAILY_PERFECT_BONUS,
      updatedAt: new Date().toISOString(),
    };
    nextDp = { ...nextDp, dailyBonusGranted: true };
  }

  if (nextMe.lastFullCompletionDate !== day) {
    if (!nextMe.lastFullCompletionDate) {
      nextMe.fullCompletionStreak = 1;
    } else {
      const prev = new Date(nextMe.lastFullCompletionDate + "T12:00:00");
      const cur = new Date(day + "T12:00:00");
      const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000);
      if (diff === 1) nextMe.fullCompletionStreak = nextMe.fullCompletionStreak + 1;
      else if (diff > 1) nextMe.fullCompletionStreak = 1;
    }
    nextMe.lastFullCompletionDate = day;

    const streak = nextMe.fullCompletionStreak;
    const claimed = new Set(nextMe.streakBonusesClaimed);
    if (streak >= 3 && !claimed.has("streak-3")) {
      nextMe.challengeWater += WATER_STREAK_3_BONUS;
      claimed.add("streak-3");
    }
    if (streak >= 7 && !claimed.has("streak-7")) {
      nextMe.challengeWater += WATER_STREAK_7_BONUS;
      claimed.add("streak-7");
    }
    if (streak >= 14 && ch.durationDays >= 14 && !claimed.has("streak-14")) {
      nextMe.challengeWater += WATER_STREAK_14_BONUS;
      claimed.add("streak-14");
    }
    nextMe.streakBonusesClaimed = [...claimed];
    nextMe.updatedAt = new Date().toISOString();
  }

  return { me: nextMe, dp: nextDp };
}

function aggregateChallengeStats(
  c: ChallengeRecord,
  userId: string,
  activities: { type: string; timestamp: string }[],
  transactions: { transactionDate: string; type: string; riskLevel: string }[]
): {
  missionsCompleted: number;
  fullCompletionDays: number;
  saveInstead: number;
  flexiDrawdowns: number;
  highRiskTxn: number;
} {
  const start = c.startDate;
  const end = c.endDate;
  const missions = c.missions.filter((m) => m.userId === userId && m.missionDate >= start && m.missionDate <= end);
  const missionsCompleted = missions.filter((m) => missionIsClaimed(m)).length;

  const byDate = new Map<string, ChallengeDailyMission[]>();
  for (const m of missions) {
    const arr = byDate.get(m.missionDate) ?? [];
    arr.push(m);
    byDate.set(m.missionDate, arr);
  }
  let fullCompletionDays = 0;
  for (const [, dayM] of byDate) {
    if (dayM.length >= 5 && dayM.every((m) => missionIsClaimed(m))) fullCompletionDays += 1;
  }

  const saveInstead = activities.filter(
    (a) => a.type === "save_instead" && isoDay(a.timestamp) >= start && isoDay(a.timestamp) <= end
  ).length;
  const flexiDrawdowns = activities.filter(
    (a) => a.type === "flexicredit_drawdown" && isoDay(a.timestamp) >= start && isoDay(a.timestamp) <= end
  ).length;
  const highRiskTxn = transactions.filter(
    (t) =>
      t.type === "expense" &&
      (t.riskLevel === "high" || t.riskLevel === "critical") &&
      t.transactionDate >= start &&
      t.transactionDate <= end
  ).length;

  return { missionsCompleted, fullCompletionDays, saveInstead, flexiDrawdowns, highRiskTxn };
}

function upsertParticipant(list: ChallengeParticipant[], next: ChallengeParticipant): ChallengeParticipant[] {
  const i = list.findIndex((p) => p.userId === next.userId);
  if (i < 0) return [...list, next];
  const copy = [...list];
  copy[i] = next;
  return copy;
}

function upsertMission(list: ChallengeDailyMission[], next: ChallengeDailyMission): ChallengeDailyMission[] {
  const i = list.findIndex((m) => m.id === next.id);
  if (i < 0) return [...list, next];
  const copy = [...list];
  copy[i] = next;
  return copy;
}

function upsertDailyProgress(
  list: ChallengeDailyProgress[],
  next: ChallengeDailyProgress
): ChallengeDailyProgress[] {
  const i = list.findIndex((p) => p.id === next.id);
  if (i < 0) return [...list, next];
  const copy = [...list];
  copy[i] = next;
  return copy;
}

interface ChallengeBundle {
  challenges: ChallengeRecord[];
  /** challengeId -> userId -> last seen tree level (for peer level-up toasts). */
  peerLevelSnapshot: Record<string, Record<string, number>>;
}

interface ChallengeState {
  challenges: ChallengeRecord[];
  peerLevelSnapshot: Record<string, Record<string, number>>;
  hydrateFromStorage: () => Promise<void>;
  hydrateFromSupabase: (userId: string) => Promise<void>;
  persistLocal: () => Promise<void>;
  reset: () => void;
  getActiveChallengeForUser: (userId: string) => ChallengeRecord | null;
  getChallenge: (challengeId: string) => ChallengeRecord | undefined;
  createAndStartChallenge: (input: {
    creatorId: string;
    creatorName: string;
    durationDays: ChallengeDurationDays;
    invited: { userId: string; displayName: string }[];
  }) => { ok: boolean; reason?: string; challengeId?: string };
  refreshProgressForUser: (userId: string) => void;
  markInsightReviewed: (userId: string, day: string) => void;
  claimChallengeMission: (challengeId: string, userId: string, missionId: string) => { ok: boolean; reason?: string };
  waterChallengeTree: (challengeId: string, userId: string) => { ok: boolean; leveledUp?: boolean };
  onGardenFocused: (challengeId: string, viewerId: string) => void;
  finalizeChallengeIfNeeded: (challengeId: string) => void;
  creditMyPendingChallengeRewards: (challengeId: string) => void;
  notifyChallengeEndForViewerIfNeeded: (challengeId: string) => void;
  /** Dev-only pitch demos — no-ops outside `__DEV__`. */
  ensurePitchDemoCompletedChallenge: (displayName?: string) => void;
  runPitchDemo7DayCompletion: (displayName?: string) => void;
  ensurePitchDemoActiveChallenge: (displayName?: string) => void;
  simulatePitchFriendTreeLevelUp: (displayName?: string) => void;
}

function notif(title: string, message: string, linkedScreen?: string, type: NotificationType = "challenge") {
  useNotificationStore.getState().addNotification({
    id: randomUUIDCompat(),
    title,
    message,
    time: new Date().toISOString(),
    read: false,
    type,
    linkedScreen,
  });
}

const SV_CHALLENGE_RW = "sv-challenge-reward-";
const ACT_CHALLENGE_RW = "challenge-act-";
const NOTIF_CHALLENGE_RW = "challenge-notif-";

function friendChallengeDisplayName(c: ChallengeRecord): string {
  return challengeTitleForDuration(c.durationDays);
}

function challengeRewardSavingsLabel(c: ChallengeRecord): string {
  return `Challenge Reward · ${friendChallengeDisplayName(c)} reward credited to Bonus`;
}

function challengeRewardLatestDescription(c: ChallengeRecord, rw: ChallengeRewardRecord): string {
  return `${formatRM(rw.rewardAmount)} credited to Bonus from ${friendChallengeDisplayName(c)}`;
}

function challengeRewardNotifBody(c: ChallengeRecord, rw: ChallengeRewardRecord): string {
  return `You finished #${rw.rank} in ${friendChallengeDisplayName(c)} and ${formatRM(rw.rewardAmount)} was credited to your Bonus Pocket.`;
}

function appendChallengeRewardLatestActivity(c: ChallengeRecord, rw: ChallengeRewardRecord, timestamp: string) {
  useActivityStore.getState().addActivity({
    id: `${ACT_CHALLENGE_RW}${rw.id}`,
    type: "challenge_reward",
    title: "Challenge Reward",
    description: challengeRewardLatestDescription(c, rw),
    amount: rw.rewardAmount,
    direction: "credit",
    timestamp,
    route: "/savings",
  });
}

function appendChallengeRewardNotification(c: ChallengeRecord, rw: ChallengeRewardRecord) {
  useNotificationStore.getState().addNotification({
    id: `${NOTIF_CHALLENGE_RW}${rw.id}`,
    title: "Challenge Reward Credited",
    message: challengeRewardNotifBody(c, rw),
    time: new Date().toISOString(),
    read: false,
    type: "reward",
    linkedScreen: "/savings",
  });
}

function backfillChallengeSavingsRecentIfMissing(c: ChallengeRecord, rw: ChallengeRewardRecord, timestamp: string) {
  const sid = `${SV_CHALLENGE_RW}${rw.id}`;
  if (useSavingsStore.getState().manualActivities.some((a) => a.id === sid)) return;
  const rounded = Math.round(rw.rewardAmount * 100) / 100;
  useSavingsStore.getState().addManualActivity({
    id: sid,
    label: challengeRewardSavingsLabel(c),
    pocket: "Bonus",
    amount: rounded,
    date: timestamp.slice(0, 10),
    occurredAt: timestamp,
    type: "challenge_reward",
  });
}

function mergeEndNotified(ch: ChallengeRecord, uid: string): string[] {
  return [...new Set([...(ch.challengeEndNotifiedUserIds ?? []), uid])];
}

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  challenges: [],
  peerLevelSnapshot: {},

  persistLocal: async () => {
    const bundle: ChallengeBundle = {
      challenges: get().challenges,
      peerLevelSnapshot: get().peerLevelSnapshot,
    };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
    } catch {
      /* ignore */
    }
    const uid = getAuthUserId();
    if (uid) void persistChallengeBundle(uid, bundle);
  },

  hydrateFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ChallengeBundle;
      if (parsed?.challenges?.length) {
        set({
          challenges: migrateChallengesList(parsed.challenges),
          peerLevelSnapshot: parsed.peerLevelSnapshot ?? {},
        });
      }
    } catch {
      /* ignore */
    }
  },

  hydrateFromSupabase: async (userId: string) => {
    const remote = await loadChallengeBundleFromSupabase(userId);
    if (!remote) return;
    set((s) => {
      const byId = new Map(s.challenges.map((c) => [c.id, c]));
      for (const c of migrateChallengesList(remote.challenges)) {
        const prev = byId.get(c.id);
        if (!prev || new Date(c.updatedAt).getTime() >= new Date(prev.updatedAt).getTime()) {
          byId.set(c.id, c);
        }
      }
      return {
        challenges: [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        peerLevelSnapshot: { ...s.peerLevelSnapshot, ...(remote.peerLevelSnapshot ?? {}) },
      };
    });
  },

  reset: () => set({ challenges: [], peerLevelSnapshot: {} }),

  getChallenge: (challengeId) => get().challenges.find((c) => c.id === challengeId),

  getActiveChallengeForUser: (userId) => {
    const t = todayStr();
    return (
      get().challenges.find(
        (c) =>
          challengeActiveOnDate(c, t) && c.participants.some((p) => p.userId === userId && p.inviteStatus === "accepted")
      ) ?? null
    );
  },

  createAndStartChallenge: (input) => {
    const total = 1 + input.invited.length;
    if (total < 2) return { ok: false, reason: "Invite at least one friend to start a challenge." };

    const id = randomUUIDCompat();
    const now = new Date().toISOString();
    const startDate = todayStr();
    const end = new Date(startDate);
    end.setUTCDate(end.getUTCDate() + input.durationDays);
    const endDate = end.toISOString().slice(0, 10);
    const durationDays = input.durationDays;
    const rewardConfig = rewardConfigForDuration(durationDays);

    const participants: ChallengeParticipant[] = [
      {
        id: randomUUIDCompat(),
        challengeId: id,
        userId: input.creatorId,
        displayName: input.creatorName,
        inviteStatus: "accepted",
        joinedAt: now,
        challengeTreeLevel: 0,
        challengeTreeExp: 0,
        challengeWater: 0,
        challengeSmartScore: 0,
        finalChallengeScore: 0,
        currentRank: null,
        fullCompletionStreak: 0,
        lastFullCompletionDate: null,
        streakBonusesClaimed: [],
        gxHealthAtStart: getSyncGxHealthScore(),
        flags: {},
        createdAt: now,
        updatedAt: now,
      },
      ...input.invited.map((inv) => ({
        id: randomUUIDCompat(),
        challengeId: id,
        userId: inv.userId,
        displayName: inv.displayName,
        inviteStatus: "accepted" as const,
        joinedAt: now,
        challengeTreeLevel: 0,
        challengeTreeExp: 0,
        challengeWater: 0,
        challengeSmartScore: 0,
        finalChallengeScore: 0,
        currentRank: null,
        fullCompletionStreak: 0,
        lastFullCompletionDate: null,
        streakBonusesClaimed: [],
        gxHealthAtStart: null,
        flags: {},
        createdAt: now,
        updatedAt: now,
      })),
    ];

    const roundUp = useSavingsStore.getState().roundUpEnabled;
    let missions: ChallengeDailyMission[] = [];
    for (const p of participants) {
      const defs = pickDailyMissionDefs(id, p.userId, startDate, roundUp);
      missions = missions.concat(buildMissionRows(id, p.userId, startDate, defs, now));
    }

    const ranked = assignRanks(participants);

    const record: ChallengeRecord = {
      id,
      creatorUserId: input.creatorId,
      title: challengeTitleForDuration(durationDays),
      durationDays,
      startDate,
      endDate,
      status: "active",
      rewardConfig,
      createdAt: now,
      updatedAt: now,
      participants: ranked,
      missions,
      dailyProgress: [],
      rewards: [],
      levelEvents: [],
      finalizationDone: false,
      endingSoonNotified: false,
      challengeEndNotifiedUserIds: [],
    };

    set((s) => ({ challenges: [record, ...s.challenges.filter((c) => c.id !== id)] }));
    void get().persistLocal();

    const link = `/challenge-garden?id=${encodeURIComponent(id)}`;
    notif("Challenge started", `Your ${durationDays}-Day Friend Challenge is live. Grow your Challenge Tree from Level 0.`, link);
    useActivityStore.getState().addActivity({
      id: `act-challenge-start-${id}`,
      type: "challenge_started",
      title: "Challenge Started",
      description: record.title,
      timestamp: now,
      route: link,
    });

    return { ok: true, challengeId: id };
  },

  markInsightReviewed: (userId, day) => {
    const t = todayStr();
    const active = get().getActiveChallengeForUser(userId);
    if (!active || active.status !== "active") return;
    set((s) => ({
      challenges: s.challenges.map((c) => {
        if (c.id !== active.id) return c;
        return {
          ...c,
          participants: c.participants.map((p) =>
            p.userId === userId
              ? { ...p, flags: { ...p.flags, lastInsightReviewDay: day }, updatedAt: new Date().toISOString() }
              : p
          ),
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
    get().refreshProgressForUser(userId);
  },

  claimChallengeMission: (challengeId, userId, missionId) => {
    const c = get().getChallenge(challengeId);
    if (!c || c.status !== "active") return { ok: false, reason: "Challenge not active." };
    const day = todayStr();
    if (day < c.startDate || day > c.endDate) return { ok: false, reason: "Not an active challenge day." };
    const m = c.missions.find((x) => x.id === missionId && x.userId === userId);
    if (!m) return { ok: false, reason: "Mission not found." };
    if (m.status !== "completed_unclaimed") return { ok: false, reason: "Nothing to claim yet." };

    set((s) => ({
      challenges: s.challenges.map((ch) => {
        if (ch.id !== challengeId) return ch;
        const now = new Date().toISOString();
        const pIdx = ch.participants.findIndex((p) => p.userId === userId);
        if (pIdx < 0) return ch;
        let me = { ...ch.participants[pIdx] };

        const missions = ch.missions.map((mi) =>
          mi.id === missionId && mi.userId === userId
            ? { ...mi, status: "claimed" as const, updatedAt: now }
            : mi
        );

        me = {
          ...me,
          challengeWater: me.challengeWater + m.rewardWater,
          updatedAt: now,
        };

        const dayMissions = missions.filter((dm) => dm.userId === userId && dm.missionDate === day);
        const progId = `${ch.id}:${userId}:${day}`;
        let dp =
          ch.dailyProgress.find((d) => d.challengeId === ch.id && d.userId === userId && d.date === day) ?? null;
        if (!dp) {
          dp = {
            id: progId,
            challengeId: ch.id,
            userId,
            date: day,
            completedMissionCount: 0,
            allFiveCompleted: false,
            dailyBonusGranted: false,
            streakBonusGranted: false,
            createdAt: now,
            updatedAt: now,
          };
        }

        const applied = applyDailyPerfectAndStreak({ ...ch, missions }, me, dp, dayMissions, day);
        me = applied.me;
        dp = applied.dp;

        const acts = useActivityStore.getState().activities;
        const txns = useTransactionStore.getState().transactions;
        const stats = aggregateChallengeStats(
          { ...ch, missions },
          userId,
          acts,
          txns.map((t) => ({
            transactionDate: t.transactionDate,
            type: t.type,
            riskLevel: t.riskLevel,
          }))
        );
        me.challengeSmartScore = recalcChallengeSmartScore({
          participant: me,
          missionsCompletedInChallenge: stats.missionsCompleted,
          fullCompletionDays: stats.fullCompletionDays,
          saveInsteadCountInChallenge: stats.saveInstead,
          flexiDrawdownsInChallenge: stats.flexiDrawdowns,
          highRiskTxnCountInChallenge: stats.highRiskTxn,
          gxHealthNow: getSyncGxHealthScore(),
        });

        let participants = upsertParticipant(ch.participants, me);
        participants = assignRanks(participants);

        return {
          ...ch,
          missions,
          participants,
          dailyProgress: upsertDailyProgress(ch.dailyProgress, dp),
          updatedAt: now,
        };
      }),
    }));

    void get().persistLocal();
    return { ok: true };
  },

  refreshProgressForUser: (userId) => {
    const day = todayStr();
    const gx = getSyncGxHealthScore();
    const acts = useActivityStore.getState().activities;
    const txns = useTransactionStore.getState().transactions;

    set((state) => {
      let nextChallenges = state.challenges.map((c) => {
        if (c.status !== "active") return c;
        if (!c.participants.some((p) => p.userId === userId && p.inviteStatus === "accepted")) return c;
        if (day < c.startDate || day > c.endDate) return c;

        let ch = { ...c };
        const pIdx = ch.participants.findIndex((p) => p.userId === userId);
        if (pIdx < 0) return c;

        let me = { ...ch.participants[pIdx] };
        const insightDay = me.flags.lastInsightReviewDay === day;
        const ctx = buildChallengeEvalContextForUser({
          userId,
          today: day,
          challengeStart: ch.startDate,
          challengeEnd: ch.endDate,
          insightReviewedToday: insightDay,
          gxHealth: gx,
        });

        const roundUp = useSavingsStore.getState().roundUpEnabled;
        const existingToday = ch.missions.filter((m) => m.userId === userId && m.missionDate === day);
        if (existingToday.length < 5) {
          const now = new Date().toISOString();
          const defs = pickDailyMissionDefs(ch.id, userId, day, roundUp);
          const rows = buildMissionRows(ch.id, userId, day, defs, now);
          const byKey = new Map(existingToday.map((m) => [m.missionKey, m]));
          for (const row of rows) {
            if (!byKey.has(row.missionKey)) {
              ch.missions = upsertMission(ch.missions, row);
            }
          }
        }

        let missions = ch.missions.map((m) => {
          if (m.userId !== userId || m.missionDate !== day) return m;
          if (missionIsClaimed(m)) return m;

          const prog = evaluateMission(m, ctx);
          const now = new Date().toISOString();

          if (m.status === "completed_unclaimed") {
            if (prog < m.targetValue) {
              return { ...m, progressValue: prog, status: "in_progress" as const, updatedAt: now };
            }
            return { ...m, progressValue: prog, updatedAt: now };
          }

          if (prog >= m.targetValue) {
            return {
              ...m,
              progressValue: prog,
              status: "completed_unclaimed" as const,
              updatedAt: now,
            };
          }
          return { ...m, progressValue: prog, status: "in_progress" as const, updatedAt: now };
        });

        ch.missions = missions;

        const dayMissions = ch.missions.filter((m) => m.userId === userId && m.missionDate === day);

        const progId = `${ch.id}:${userId}:${day}`;
        let dp =
          ch.dailyProgress.find((d) => d.challengeId === ch.id && d.userId === userId && d.date === day) ?? null;
        if (!dp) {
          dp = {
            id: progId,
            challengeId: ch.id,
            userId,
            date: day,
            completedMissionCount: 0,
            allFiveCompleted: false,
            dailyBonusGranted: false,
            streakBonusGranted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }

        const bonusApplied = applyDailyPerfectAndStreak(ch, me, dp, dayMissions, day);
        me = bonusApplied.me;
        dp = bonusApplied.dp;

        const stats = aggregateChallengeStats(
          { ...ch, missions: ch.missions },
          userId,
          acts,
          txns.map((t) => ({
            transactionDate: t.transactionDate,
            type: t.type,
            riskLevel: t.riskLevel,
          }))
        );
        me.challengeSmartScore = recalcChallengeSmartScore({
          participant: me,
          missionsCompletedInChallenge: stats.missionsCompleted,
          fullCompletionDays: stats.fullCompletionDays,
          saveInsteadCountInChallenge: stats.saveInstead,
          flexiDrawdownsInChallenge: stats.flexiDrawdowns,
          highRiskTxnCountInChallenge: stats.highRiskTxn,
          gxHealthNow: gx,
        });

        ch.participants = upsertParticipant(ch.participants, me);
        ch.dailyProgress = upsertDailyProgress(ch.dailyProgress, dp);
        ch.participants = assignRanks(ch.participants);
        ch.updatedAt = new Date().toISOString();

        const daysLeft = Math.max(0, Math.round((Date.parse(ch.endDate) - Date.parse(day)) / 86400000));
        if (daysLeft === 1 && !ch.endingSoonNotified) {
          ch.endingSoonNotified = true;
          queueMicrotask(() =>
            notif(
              "Challenge ending soon",
              `${ch.title} ends tomorrow. Finish today’s missions to protect your rank.`,
              `/challenge-garden?id=${encodeURIComponent(ch.id)}`
            )
          );
        }

        return ch;
      });

      return { challenges: nextChallenges };
    });

    const post = get().challenges;
    for (const c of post) {
      if (c.status === "active" && todayStr() > c.endDate) {
        get().finalizeChallengeIfNeeded(c.id);
      }
    }

    void get().persistLocal();
  },

  waterChallengeTree: (challengeId, userId) => {
    const c = get().getChallenge(challengeId);
    if (!c || c.status !== "active") return { ok: false };
    const day = todayStr();
    if (day < c.startDate || day > c.endDate) return { ok: false };

    const me = c.participants.find((p) => p.userId === userId);
    if (!me || me.challengeWater <= 0) return { ok: false };

    const { next, leveledUp, oldLevel, newLevel } = applyWaterToChallengeTree(me);
    const rankedBefore = c.participants.find((p) => p.userId === userId)?.currentRank ?? null;

    const now = new Date().toISOString();
    let levelEvent: ChallengeLevelEvent | null = null;
    if (leveledUp) {
      levelEvent = {
        id: randomUUIDCompat(),
        challengeId,
        userId,
        oldLevel,
        newLevel,
        rankBefore: rankedBefore,
        rankAfter: null,
        createdAt: now,
      };
    }

    set((s) => ({
      challenges: s.challenges.map((ch) => {
        if (ch.id !== challengeId) return ch;
        let participants = upsertParticipant(ch.participants, next);
        participants = assignRanks(participants);
        const rankAfter = participants.find((p) => p.userId === userId)?.currentRank ?? null;
        const events = levelEvent
          ? [
              ...ch.levelEvents,
              { ...levelEvent!, rankAfter },
            ]
          : ch.levelEvents;
        return {
          ...ch,
          participants,
          levelEvents: events,
          updatedAt: now,
        };
      }),
    }));

    void get().persistLocal();
    return { ok: true, leveledUp };
  },

  onGardenFocused: (challengeId, viewerId) => {
    const c = get().getChallenge(challengeId);
    if (!c) return;
    const snap = { ...(get().peerLevelSnapshot[challengeId] ?? {}) };
    for (const p of c.participants) {
      if (p.userId === viewerId) continue;
      const prev = snap[p.userId];
      if (prev !== undefined && p.challengeTreeLevel > prev) {
        const name = p.displayName.split(" ")[0] ?? p.displayName;
        const me = c.participants.find((x) => x.userId === viewerId);
        const rankMe = me?.currentRank ?? 0;
        const rankThem = p.currentRank ?? 0;
        let msg = `${name}’s Challenge Tree reached Level ${p.challengeTreeLevel} 🌱`;
        let peerType: NotificationType = "challenge";
        if (p.challengeTreeLevel === me?.challengeTreeLevel) {
          msg = `${name} is now tied with you at Level ${p.challengeTreeLevel}.`;
        } else if (rankThem < rankMe) {
          msg = `${name} overtook you in the challenge. Their tree reached Level ${p.challengeTreeLevel} and they’re ranked #${rankThem}.`;
          peerType = "challenge_overtake";
        }
        notif("Challenge update", msg, `/challenge-garden?id=${encodeURIComponent(challengeId)}`, peerType);
      }
      snap[p.userId] = p.challengeTreeLevel;
    }
    set((s) => ({
      peerLevelSnapshot: { ...s.peerLevelSnapshot, [challengeId]: snap },
    }));
    void get().persistLocal();
    get().refreshProgressForUser(viewerId);
    get().finalizeChallengeIfNeeded(challengeId);
  },

  creditMyPendingChallengeRewards: (challengeId) => {
    const uid = getAuthUserId();
    if (!uid) return;
    const c = get().getChallenge(challengeId);
    if (!c?.finalizationDone) return;
    const now = new Date().toISOString();
    const myRewards = c.rewards.filter((r) => r.userId === uid);
    const pending = myRewards.filter((r) => !r.credited);

    for (const rw of pending) {
      useSavingsStore.getState().creditBonusPocket(rw.rewardAmount, {
        idempotencyKey: `${SV_CHALLENGE_RW}${rw.id}`,
        label: challengeRewardSavingsLabel(c),
        type: "challenge_reward",
      });
      appendChallengeRewardLatestActivity(c, rw, now);
      appendChallengeRewardNotification(c, rw);
    }

    if (pending.length > 0) {
      const pendingIds = new Set(pending.map((r) => r.id));
      set((s) => ({
        challenges: s.challenges.map((ch) => {
          if (ch.id !== challengeId) return ch;
          return {
            ...ch,
            rewards: ch.rewards.map((rw) =>
              pendingIds.has(rw.id) ? { ...rw, credited: true, creditedAt: now } : rw
            ),
            challengeEndNotifiedUserIds: mergeEndNotified(ch, uid),
          };
        }),
      }));
      void get().persistLocal();
    }

    const c2 = get().getChallenge(challengeId);
    if (!c2) return;
    for (const rw of c2.rewards.filter((r) => r.userId === uid && r.credited)) {
      const ts = rw.creditedAt ?? now;
      backfillChallengeSavingsRecentIfMissing(c2, rw, ts);
      appendChallengeRewardLatestActivity(c2, rw, ts);
      appendChallengeRewardNotification(c2, rw);
    }
  },

  notifyChallengeEndForViewerIfNeeded: (challengeId) => {
    const uid = getAuthUserId();
    if (!uid) return;
    const c = get().getChallenge(challengeId);
    if (!c?.finalizationDone) return;
    if ((c.challengeEndNotifiedUserIds ?? []).includes(uid)) return;
    if (!c.participants.some((p) => p.userId === uid)) return;
    const me = c.participants.find((p) => p.userId === uid);
    const myReward = c.rewards.find((r) => r.userId === uid);
    if (myReward?.credited) {
      set((s) => ({
        challenges: s.challenges.map((ch) =>
          ch.id === challengeId ? { ...ch, challengeEndNotifiedUserIds: mergeEndNotified(ch, uid) } : ch
        ),
      }));
      void get().persistLocal();
      return;
    }

    const linkResult = `/challenge-result?id=${encodeURIComponent(challengeId)}`;
    if (me?.rewardQualification) {
      if (c.rewards.length === 0) {
        notif(
          "Challenge complete",
          `No participant reached the minimum qualification threshold. No Bonus Rewards were issued for ${c.title}.`,
          linkResult
        );
      } else if (me.rewardQualification.isQualified) {
        notif(
          "Challenge complete",
          `You completed ${c.title} and qualified for rewards, but finished outside the paid positions.`,
          linkResult
        );
      } else {
        notif(
          "Challenge complete",
          `You completed ${c.title} but did not meet the reward qualification threshold this time.`,
          linkResult
        );
      }
    }

    set((s) => ({
      challenges: s.challenges.map((ch) =>
        ch.id === challengeId ? { ...ch, challengeEndNotifiedUserIds: mergeEndNotified(ch, uid) } : ch
      ),
    }));
    void get().persistLocal();
  },

  ensurePitchDemoCompletedChallenge: (displayName) => {
    if (!__DEV__) return;
    const uid = getAuthUserId();
    if (!uid) return;
    const existing = get().getChallenge(CHALLENGE_PITCH_DEMO_COMPLETED_ID);
    const record = buildPitchDemoCompletedChallenge(uid, displayName ?? "You", existing);
    set((s) => ({
      challenges: [record, ...s.challenges.filter((c) => c.id !== CHALLENGE_PITCH_DEMO_COMPLETED_ID)],
    }));
    void get().persistLocal();
  },

  runPitchDemo7DayCompletion: (displayName) => {
    if (!__DEV__) return;
    const uid = getAuthUserId();
    if (!uid) return;
    get().ensurePitchDemoCompletedChallenge(displayName);
    get().creditMyPendingChallengeRewards(CHALLENGE_PITCH_DEMO_COMPLETED_ID);
  },

  ensurePitchDemoActiveChallenge: (displayName) => {
    if (!__DEV__) return;
    const uid = getAuthUserId();
    if (!uid) return;
    let created = false;
    set((s) => {
      if (s.challenges.some((c) => c.id === CHALLENGE_PITCH_DEMO_ACTIVE_ID)) return s;
      created = true;
      const record = buildPitchDemoActiveChallenge(uid, displayName ?? "You");
      return { challenges: [...s.challenges, record] };
    });
    if (created) void get().persistLocal();
  },

  simulatePitchFriendTreeLevelUp: (displayName) => {
    if (!__DEV__) return;
    const uid = getAuthUserId();
    if (!uid) return;
    get().ensurePitchDemoActiveChallenge(displayName);
    const c0 = get().getChallenge(CHALLENGE_PITCH_DEMO_ACTIVE_ID);
    if (!c0) return;
    const friends = c0.participants.filter((p) => p.userId !== uid);
    if (friends.length === 0) return;
    const friend = friends[nextPitchDemoFriendSlot(friends.length)]!;
    const prevLevel = friend.challengeTreeLevel;
    const newLevel = prevLevel + 1;
    const now = new Date().toISOString();

    set((s) => {
      const branch = { ...(s.peerLevelSnapshot[CHALLENGE_PITCH_DEMO_ACTIVE_ID] ?? {}) };
      branch[friend.userId] = prevLevel;
      const challenges = s.challenges.map((ch) => {
        if (ch.id !== CHALLENGE_PITCH_DEMO_ACTIVE_ID) return ch;
        const participants = ch.participants.map((p) =>
          p.userId === friend.userId ? { ...p, challengeTreeLevel: newLevel, updatedAt: now } : p
        );
        return { ...ch, participants: assignRanks(participants), updatedAt: now };
      });
      return {
        challenges,
        peerLevelSnapshot: { ...s.peerLevelSnapshot, [CHALLENGE_PITCH_DEMO_ACTIVE_ID]: branch },
      };
    });

    queueMicrotask(() => {
      get().onGardenFocused(CHALLENGE_PITCH_DEMO_ACTIVE_ID, uid);
    });
  },

  finalizeChallengeIfNeeded: (challengeId) => {
    const c = get().getChallenge(challengeId);
    if (!c) return;
    if (c.finalizationDone) {
      get().creditMyPendingChallengeRewards(challengeId);
      get().notifyChallengeEndForViewerIfNeeded(challengeId);
      return;
    }
    const day = todayStr();
    if (day <= c.endDate) return;

    const now = new Date().toISOString();
    const participants = assignRanks([...c.participants]);
    const tiers = c.rewardConfig.tiers;
    const n = participants.length;
    const ranks = eligibleRewardRanks(n);

    const withQual: ChallengeParticipant[] = participants.map((p) => {
      const completed = countClaimedChallengeMissionsForUser(c, p.userId);
      const q = evaluateChallengeQualification(c, p, completed);
      return {
        ...p,
        rewardQualification: { ...q, evaluatedAt: now },
        updatedAt: now,
      };
    });

    const qualifiedSorted = withQual
      .filter((p) => p.rewardQualification?.isQualified)
      .sort((a, b) => (a.currentRank ?? 99) - (b.currentRank ?? 99));

    const rewards: ChallengeRewardRecord[] = [];
    for (let i = 0; i < qualifiedSorted.length; i++) {
      const rewardRank = i + 1;
      if (!ranks.includes(rewardRank)) continue;
      const tier = tiers.find((t) => t.rank === rewardRank);
      if (!tier) continue;
      const winner = qualifiedSorted[i];
      rewards.push({
        id: randomUUIDCompat(),
        challengeId,
        userId: winner.userId,
        rank: rewardRank,
        rewardAmount: tier.amountRm,
        rewardBucket: "bonus",
        credited: false,
        creditedAt: null,
        createdAt: now,
      });
    }

    set((s) => ({
      challenges: s.challenges.map((ch) =>
        ch.id === challengeId
          ? {
              ...ch,
              status: "completed",
              participants: withQual,
              rewards,
              finalizationDone: true,
              updatedAt: now,
            }
          : ch
      ),
    }));

    get().creditMyPendingChallengeRewards(challengeId);
    get().notifyChallengeEndForViewerIfNeeded(challengeId);

    void get().persistLocal();
  },
}));
