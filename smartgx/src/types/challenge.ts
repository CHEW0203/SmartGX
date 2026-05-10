export type ChallengeStatus = "pending" | "active" | "completed" | "cancelled";

export type ChallengeInviteStatus = "invited" | "accepted" | "declined";

/** Legacy persisted values may include `reward_granted` (migrate to `claimed`). */
export type ChallengeMissionStatus = "in_progress" | "completed_unclaimed" | "claimed";

export type ChallengeDurationDays = 7 | 14 | 30;

export interface ChallengeRewardTier {
  rank: 1 | 2 | 3;
  amountRm: number;
}

export interface ChallengeRewardConfig {
  tiers: ChallengeRewardTier[];
}

/** Snapshot after challenge end; optional on active challenges (computed live in UI). */
export interface StoredRewardQualification {
  isQualified: boolean;
  completedMissions: number;
  requiredMissions: number;
  treeLevel: number;
  requiredTreeLevel: number;
  smartScore: number;
  requiredSmartScore: number;
  checks: {
    missionCompletion: boolean;
    treeLevel: boolean;
    smartScore: boolean;
  };
  missingRequirements: string[];
  evaluatedAt: string;
}

export interface ChallengeParticipant {
  id: string;
  challengeId: string;
  userId: string;
  displayName: string;
  inviteStatus: ChallengeInviteStatus;
  joinedAt: string;
  challengeTreeLevel: number;
  challengeTreeExp: number;
  challengeWater: number;
  challengeSmartScore: number;
  finalChallengeScore: number;
  currentRank: number | null;
  fullCompletionStreak: number;
  lastFullCompletionDate: string | null;
  streakBonusesClaimed: string[];
  gxHealthAtStart: number | null;
  flags: {
    lastInsightReviewDay?: string;
  };
  createdAt: string;
  updatedAt: string;
  /** Set when the challenge is finalized; used for results and reward eligibility. */
  rewardQualification?: StoredRewardQualification;
}

export interface ChallengeDailyMission {
  id: string;
  challengeId: string;
  userId: string;
  missionDate: string;
  missionKey: string;
  title: string;
  description: string;
  missionType: string;
  targetValue: number;
  progressValue: number;
  status: ChallengeMissionStatus;
  rewardWater: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ChallengeDailyProgress {
  id: string;
  challengeId: string;
  userId: string;
  date: string;
  completedMissionCount: number;
  allFiveCompleted: boolean;
  dailyBonusGranted: boolean;
  streakBonusGranted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChallengeLevelEvent {
  id: string;
  challengeId: string;
  userId: string;
  oldLevel: number;
  newLevel: number;
  rankBefore: number | null;
  rankAfter: number | null;
  createdAt: string;
}

export interface ChallengeRewardRecord {
  id: string;
  challengeId: string;
  userId: string;
  rank: number;
  rewardAmount: number;
  rewardBucket: "bonus";
  credited: boolean;
  creditedAt: string | null;
  createdAt: string;
}

export interface ChallengeRecord {
  id: string;
  creatorUserId: string;
  title: string;
  durationDays: ChallengeDurationDays;
  startDate: string;
  endDate: string;
  status: ChallengeStatus;
  rewardConfig: ChallengeRewardConfig;
  createdAt: string;
  updatedAt: string;
  participants: ChallengeParticipant[];
  missions: ChallengeDailyMission[];
  dailyProgress: ChallengeDailyProgress[];
  rewards: ChallengeRewardRecord[];
  levelEvents: ChallengeLevelEvent[];
  finalizationDone: boolean;
  endingSoonNotified: boolean;
  /** Per-user idempotency for end-of-challenge push notifications (local client). */
  challengeEndNotifiedUserIds?: string[];
}
