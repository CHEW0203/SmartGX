/**
 * Pitch / development only — synthetic challenge records. Does not alter engine rules.
 */
import type {
  ChallengeDurationDays,
  ChallengeParticipant,
  ChallengeRecord,
  ChallengeRewardRecord,
  StoredRewardQualification,
} from "../../types/challenge";
import { randomUUIDCompat } from "../../lib/uuid";
import {
  assignRanks,
  challengeTitleForDuration,
  rewardConfigForDuration,
} from "./challenge.engine";

export const CHALLENGE_PITCH_DEMO_COMPLETED_ID = "__smartgx_pitch_demo_7day_complete__";
export const CHALLENGE_PITCH_DEMO_ACTIVE_ID = "__smartgx_pitch_demo_garden_active__";
export const CHALLENGE_PITCH_DEMO_FRIEND_AINA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
export const CHALLENGE_PITCH_DEMO_FRIEND_JASON = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
export const CHALLENGE_PITCH_DEMO_REWARD_ID = "__smartgx_pitch_demo_reward_row__";

let pitchFriendLevelUpRotation = 0;

export function nextPitchDemoFriendSlot(friendCount: number): number {
  const i = pitchFriendLevelUpRotation % friendCount;
  pitchFriendLevelUpRotation += 1;
  return i;
}

function nowIso(): string {
  return new Date().toISOString();
}

function qualSnapshot(args: {
  missions: number;
  tree: number;
  smart: number;
  evaluatedAt: string;
}): StoredRewardQualification {
  const thM = 21;
  const thT = 2;
  const thS = 120;
  return {
    isQualified: true,
    completedMissions: args.missions,
    requiredMissions: thM,
    treeLevel: args.tree,
    requiredTreeLevel: thT,
    smartScore: args.smart,
    requiredSmartScore: thS,
    checks: {
      missionCompletion: args.missions >= thM,
      treeLevel: args.tree >= thT,
      smartScore: args.smart >= thS,
    },
    missingRequirements: [],
    evaluatedAt: args.evaluatedAt,
  };
}

function baseParticipant(
  challengeId: string,
  userId: string,
  displayName: string,
  treeLevel: number,
  treeExp: number,
  smart: number
): ChallengeParticipant {
  const now = nowIso();
  return {
    id: randomUUIDCompat(),
    challengeId,
    userId,
    displayName,
    inviteStatus: "accepted",
    joinedAt: now,
    challengeTreeLevel: treeLevel,
    challengeTreeExp: treeExp,
    challengeWater: 0,
    challengeSmartScore: smart,
    finalChallengeScore: 0,
    currentRank: null,
    fullCompletionStreak: 0,
    lastFullCompletionDate: null,
    streakBonusesClaimed: [],
    gxHealthAtStart: 70,
    flags: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** Completed 7-day challenge: you 1st, qualified, optional uncredited reward for first credit. */
export function buildPitchDemoCompletedChallenge(
  uid: string,
  displayName: string,
  existing: ChallengeRecord | undefined
): ChallengeRecord {
  const durationDays: ChallengeDurationDays = 7;
  const title = challengeTitleForDuration(durationDays);
  const cfg = rewardConfigForDuration(durationDays);
  const firstRm = cfg.tiers[0].amountRm;
  const now = nowIso();
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const endDate = end.toISOString().slice(0, 10);
  const start = new Date(endDate + "T12:00:00");
  start.setUTCDate(start.getUTCDate() - 7);
  const startDate = start.toISOString().slice(0, 10);

  const evaluatedAt = now;
  const meQual = qualSnapshot({ missions: 29, tree: 4, smart: 235, evaluatedAt });
  const qAina = qualSnapshot({ missions: 28, tree: 4, smart: 221, evaluatedAt });
  const qDan = qualSnapshot({ missions: 26, tree: 3, smart: 198, evaluatedAt });
  const qChloe: StoredRewardQualification = {
    isQualified: false,
    completedMissions: 8,
    requiredMissions: 21,
    treeLevel: 1,
    requiredTreeLevel: 2,
    smartScore: 42,
    requiredSmartScore: 120,
    checks: { missionCompletion: false, treeLevel: false, smartScore: false },
    missingRequirements: ["Below qualification thresholds (demo)"],
    evaluatedAt,
  };

  let raw: ChallengeParticipant[] = [
    {
      ...baseParticipant(CHALLENGE_PITCH_DEMO_COMPLETED_ID, uid, displayName || "You", 4, 80, 235),
      rewardQualification: meQual,
    },
    {
      ...baseParticipant(CHALLENGE_PITCH_DEMO_COMPLETED_ID, CHALLENGE_PITCH_DEMO_FRIEND_AINA, "Aina Rahman", 4, 60, 221),
      rewardQualification: qAina,
    },
    {
      ...baseParticipant(CHALLENGE_PITCH_DEMO_COMPLETED_ID, CHALLENGE_PITCH_DEMO_FRIEND_JASON, "Daniel Wong", 3, 40, 198),
      rewardQualification: qDan,
    },
    {
      ...baseParticipant(CHALLENGE_PITCH_DEMO_COMPLETED_ID, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3", "Chloe Tan", 1, 10, 42),
      rewardQualification: qChloe,
    },
  ];
  raw = assignRanks(raw);

  const prevReward = existing?.rewards.find((r) => r.userId === uid);
  const credited = prevReward?.credited === true;
  const rewards: ChallengeRewardRecord[] = [
    {
      id: CHALLENGE_PITCH_DEMO_REWARD_ID,
      challengeId: CHALLENGE_PITCH_DEMO_COMPLETED_ID,
      userId: uid,
      rank: 1,
      rewardAmount: firstRm,
      rewardBucket: "bonus",
      credited,
      creditedAt: credited ? prevReward?.creditedAt ?? now : null,
      createdAt: prevReward?.createdAt ?? now,
    },
  ];

  return {
    id: CHALLENGE_PITCH_DEMO_COMPLETED_ID,
    creatorUserId: uid,
    title,
    durationDays,
    startDate,
    endDate,
    status: "completed",
    rewardConfig: cfg,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    participants: raw,
    missions: existing?.missions ?? [],
    dailyProgress: existing?.dailyProgress ?? [],
    rewards,
    levelEvents: existing?.levelEvents ?? [],
    finalizationDone: true,
    endingSoonNotified: true,
    challengeEndNotifiedUserIds: existing?.challengeEndNotifiedUserIds ?? [],
  };
}

/** Active sandbox challenge (appended last so real `getActiveChallengeForUser` stays preferred). */
export function buildPitchDemoActiveChallenge(uid: string, displayName: string): ChallengeRecord {
  const durationDays: ChallengeDurationDays = 7;
  const title = `${challengeTitleForDuration(durationDays)} (pitch sandbox)`;
  const now = nowIso();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 3);
  const startDate = start.toISOString().slice(0, 10);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 60);
  const endDate = end.toISOString().slice(0, 10);

  let raw: ChallengeParticipant[] = [
    baseParticipant(CHALLENGE_PITCH_DEMO_ACTIVE_ID, uid, displayName || "You", 4, 80, 280),
    baseParticipant(CHALLENGE_PITCH_DEMO_ACTIVE_ID, CHALLENGE_PITCH_DEMO_FRIEND_AINA, "Aina Rahman", 3, 50, 260),
    baseParticipant(CHALLENGE_PITCH_DEMO_ACTIVE_ID, CHALLENGE_PITCH_DEMO_FRIEND_JASON, "Jason Lee", 2, 30, 200),
  ];
  raw = assignRanks(raw);

  return {
    id: CHALLENGE_PITCH_DEMO_ACTIVE_ID,
    creatorUserId: uid,
    title,
    durationDays,
    startDate,
    endDate,
    status: "active",
    rewardConfig: rewardConfigForDuration(durationDays),
    createdAt: now,
    updatedAt: now,
    participants: raw,
    missions: [],
    dailyProgress: [],
    rewards: [],
    levelEvents: [],
    finalizationDone: false,
    endingSoonNotified: false,
  };
}

