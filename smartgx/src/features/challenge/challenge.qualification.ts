import type {
  ChallengeDurationDays,
  ChallengeParticipant,
  ChallengeRecord,
} from "../../types/challenge";

export type ChallengeQualificationThresholds = {
  totalMissions: number;
  minCompletedMissions: number;
  minTreeLevel: number;
  minSmartScore: number;
};

/** Thresholds by challenge duration (5 missions/day). */
export const CHALLENGE_QUALIFICATION_CONFIG: Record<ChallengeDurationDays, ChallengeQualificationThresholds> = {
  7: { totalMissions: 35, minCompletedMissions: 21, minTreeLevel: 2, minSmartScore: 120 },
  14: { totalMissions: 70, minCompletedMissions: 42, minTreeLevel: 4, minSmartScore: 260 },
  30: { totalMissions: 150, minCompletedMissions: 90, minTreeLevel: 8, minSmartScore: 600 },
};

export function qualificationThresholdsForDuration(days: ChallengeDurationDays): ChallengeQualificationThresholds {
  return CHALLENGE_QUALIFICATION_CONFIG[days];
}

function missionCountedAsCompleted(status: string): boolean {
  return status === "claimed" || status === "reward_granted";
}

/** Claimed challenge missions for this user within the challenge date window. */
export function countClaimedChallengeMissionsForUser(challenge: ChallengeRecord, userId: string): number {
  const { startDate, endDate } = challenge;
  return challenge.missions.filter(
    (m) =>
      m.userId === userId &&
      m.missionDate >= startDate &&
      m.missionDate <= endDate &&
      missionCountedAsCompleted(m.status as string)
  ).length;
}

export type ChallengeQualificationChecks = {
  missionCompletion: boolean;
  treeLevel: boolean;
  smartScore: boolean;
};

export type ChallengeQualificationResult = {
  isQualified: boolean;
  completedMissions: number;
  requiredMissions: number;
  treeLevel: number;
  requiredTreeLevel: number;
  smartScore: number;
  requiredSmartScore: number;
  checks: ChallengeQualificationChecks;
  missingRequirements: string[];
};

export function evaluateChallengeQualification(
  challenge: Pick<ChallengeRecord, "durationDays">,
  participant: Pick<ChallengeParticipant, "challengeTreeLevel" | "challengeSmartScore">,
  completedMissions: number
): ChallengeQualificationResult {
  const th = qualificationThresholdsForDuration(challenge.durationDays);
  const checks: ChallengeQualificationChecks = {
    missionCompletion: completedMissions >= th.minCompletedMissions,
    treeLevel: participant.challengeTreeLevel >= th.minTreeLevel,
    smartScore: participant.challengeSmartScore >= th.minSmartScore,
  };
  const isQualified = checks.missionCompletion && checks.treeLevel && checks.smartScore;

  const missingRequirements: string[] = [];
  if (!checks.missionCompletion) {
    missingRequirements.push(
      `Complete at least ${th.minCompletedMissions} challenge missions (${completedMissions}/${th.minCompletedMissions})`
    );
  }
  if (!checks.treeLevel) {
    missingRequirements.push(`Reach Challenge Tree Level ${th.minTreeLevel} (currently ${participant.challengeTreeLevel})`);
  }
  if (!checks.smartScore) {
    missingRequirements.push(
      `Reach Challenge SmartScore ${th.minSmartScore} (currently ${participant.challengeSmartScore})`
    );
  }

  return {
    isQualified,
    completedMissions,
    requiredMissions: th.minCompletedMissions,
    treeLevel: participant.challengeTreeLevel,
    requiredTreeLevel: th.minTreeLevel,
    smartScore: participant.challengeSmartScore,
    requiredSmartScore: th.minSmartScore,
    checks,
    missingRequirements,
  };
}
