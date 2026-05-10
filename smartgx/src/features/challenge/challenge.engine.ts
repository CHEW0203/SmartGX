import type {
  ChallengeDailyMission,
  ChallengeDurationDays,
  ChallengeParticipant,
  ChallengeRewardConfig,
} from "../../types/challenge";
import type { AppActivity } from "../../types/activity";
import type { Transaction } from "../../types/transaction";

export const CHALLENGE_EXP_PER_WATER = 20;
export const CHALLENGE_EXP_PER_LEVEL = 100;
export const CHALLENGE_MISSIONS_PER_DAY = 5;
export const WATER_PER_MISSION = 1;
export const WATER_DAILY_PERFECT_BONUS = 2;
export const WATER_STREAK_3_BONUS = 3;
export const WATER_STREAK_7_BONUS = 5;
export const WATER_STREAK_14_BONUS = 8;

export function rewardConfigForDuration(days: ChallengeDurationDays): ChallengeRewardConfig {
  if (days === 7) {
    return { tiers: [{ rank: 1, amountRm: 5 }, { rank: 2, amountRm: 3 }, { rank: 3, amountRm: 1 }] };
  }
  if (days === 14) {
    return { tiers: [{ rank: 1, amountRm: 10 }, { rank: 2, amountRm: 6 }, { rank: 3, amountRm: 3 }] };
  }
  return { tiers: [{ rank: 1, amountRm: 20 }, { rank: 2, amountRm: 12 }, { rank: 3, amountRm: 6 }] };
}

/** How many top ranks receive cash rewards given participant count. */
export function eligibleRewardRanks(participantCount: number): number[] {
  if (participantCount <= 1) return [];
  if (participantCount === 2) return [1];
  if (participantCount === 3) return [1, 2, 3];
  return [1, 2, 3];
}

export function challengeTitleForDuration(days: ChallengeDurationDays): string {
  return `${days}-Day Friend Challenge`;
}

function hashSeed(parts: string[]): number {
  const s = parts.join("|");
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export interface MissionDef {
  key: string;
  title: string;
  description: string;
  missionType: string;
  targetValue: number;
  rewardWater: number;
}

/** Legacy key from pool before replacement; persisted rows may still use this. */
export const CHALLENGE_MISSION_KEY_SAVE_INSTEAD_LEGACY = "save_instead_once";

export function migrateLegacyChallengeMissionRow(m: ChallengeDailyMission): ChallengeDailyMission {
  if (m.missionKey !== CHALLENGE_MISSION_KEY_SAVE_INSTEAD_LEGACY) return m;
  const replacement = CHALLENGE_MISSION_POOL.find((d) => d.key === "no_credit_spend_today");
  if (!replacement) return m;
  const suffix = `:${CHALLENGE_MISSION_KEY_SAVE_INSTEAD_LEGACY}`;
  const newId = m.id.endsWith(suffix)
    ? `${m.id.slice(0, -suffix.length)}:${replacement.key}`
    : `${m.challengeId}:${m.userId}:${m.missionDate}:${replacement.key}`;
  const st = m.status as string;
  const terminal = st === "claimed" || st === "reward_granted";
  return {
    ...m,
    id: newId,
    missionKey: replacement.key,
    title: replacement.title,
    description: replacement.description,
    missionType: replacement.missionType,
    targetValue: replacement.targetValue,
    rewardWater: replacement.rewardWater,
    ...(terminal
      ? {}
      : {
          progressValue: 0,
          status: "in_progress" as ChallengeDailyMission["status"],
        }),
  };
}

export const CHALLENGE_MISSION_POOL: MissionDef[] = [
  {
    key: "save_buckets_5",
    title: "Save RM5 into pockets",
    description: "Save at least RM5 into Bonus, Emergency, or Goals today.",
    missionType: "save",
    targetValue: 1,
    rewardWater: WATER_PER_MISSION,
  },
  {
    key: "round_up_once",
    title: "Complete one round-up saving",
    description: "Trigger at least one round-up save today.",
    missionType: "roundup",
    targetValue: 1,
    rewardWater: WATER_PER_MISSION,
  },
  {
    key: "no_credit_spend_today",
    title: "Skip unnecessary credit use",
    description: "No credit-line drawdown or FlexiCard TapPay transactions today.",
    missionType: "credit_skip",
    targetValue: 1,
    rewardWater: WATER_PER_MISSION,
  },
  {
    key: "avoid_risky_today",
    title: "Avoid high-risk spending",
    description: "No high or critical risk transactions today.",
    missionType: "risk",
    targetValue: 1,
    rewardWater: WATER_PER_MISSION,
  },
  {
    key: "no_flexi_drawdown_today",
    title: "Skip FlexiCredit drawdown",
    description: "Do not take a new FlexiCredit drawdown today.",
    missionType: "flexi",
    targetValue: 1,
    rewardWater: WATER_PER_MISSION,
  },
  {
    key: "emergency_add_5",
    title: "Boost Emergency RM5",
    description: "Add at least RM5 into Emergency today.",
    missionType: "emergency",
    targetValue: 1,
    rewardWater: WATER_PER_MISSION,
  },
  {
    key: "insight_review",
    title: "Review Transaction Insight",
    description: "Open Transactions and review today’s SmartGX Insight.",
    missionType: "insight",
    targetValue: 1,
    rewardWater: WATER_PER_MISSION,
  },
  {
    key: "food_under_cap",
    title: "Keep Food spending sensible",
    description: "Keep Food category spending under RM80 today.",
    missionType: "food_cap",
    targetValue: 1,
    rewardWater: WATER_PER_MISSION,
  },
  {
    key: "device_safety_check",
    title: "Device Safety Check",
    description: "Complete a Device Safety Check in Security today.",
    missionType: "security",
    targetValue: 1,
    rewardWater: WATER_PER_MISSION,
  },
  {
    key: "main_positive",
    title: "Healthy Main balance",
    description: "Keep a positive Main Account balance today.",
    missionType: "balance",
    targetValue: 1,
    rewardWater: WATER_PER_MISSION,
  },
  {
    key: "gxhealth_maintain",
    title: "Maintain GXHealth",
    description: "Keep GXHealth at 70 or above.",
    missionType: "health",
    targetValue: 1,
    rewardWater: WATER_PER_MISSION,
  },
];

export function pickDailyMissionDefs(
  challengeId: string,
  userId: string,
  missionDate: string,
  roundUpEnabled: boolean
): MissionDef[] {
  let pool = [...CHALLENGE_MISSION_POOL];
  if (!roundUpEnabled) {
    pool = pool.filter((m) => m.key !== "round_up_once");
  }
  const seed = hashSeed([challengeId, userId, missionDate]);
  const rotated = [...pool].sort((a, b) => {
    const ha = hashSeed([a.key, String(seed)]);
    const hb = hashSeed([b.key, String(seed)]);
    return ha - hb;
  });
  return rotated.slice(0, CHALLENGE_MISSIONS_PER_DAY);
}

export function buildMissionRows(
  challengeId: string,
  userId: string,
  missionDate: string,
  defs: MissionDef[],
  nowIso: string
): ChallengeDailyMission[] {
  return defs.map((d) => ({
    id: `${challengeId}:${userId}:${missionDate}:${d.key}`,
    challengeId,
    userId,
    missionDate,
    missionKey: d.key,
    title: d.title,
    description: d.description,
    missionType: d.missionType,
    targetValue: d.targetValue,
    progressValue: 0,
    status: "in_progress",
    rewardWater: d.rewardWater,
    metadata: {},
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
}

export interface ChallengeEvalContext {
  userId: string;
  today: string;
  challengeStart: string;
  challengeEnd: string;
  activities: AppActivity[];
  transactions: Transaction[];
  savedToBonusEmergencyGoalsToday: number;
  emergencyAddedToday: number;
  roundUpEnabled: boolean;
  roundUpCountToday: number;
  saveInsteadToday: number;
  flexiDrawdownToday: number;
  creditSpendToday: number;
  foodSpendToday: number;
  riskyTxnToday: boolean;
  mainBalance: number;
  gxHealth: number;
  lastSafetyCheckDay: string | null;
  insightReviewedToday: boolean;
}

function isoDay(ts: string): string {
  return ts.slice(0, 10);
}

export function buildEvalContext(input: {
  userId: string;
  today: string;
  challengeStart: string;
  challengeEnd: string;
  activities: AppActivity[];
  transactions: Transaction[];
  savingsManualTodayTotal: number;
  emergencyAddedToday: number;
  roundUpEnabled: boolean;
  mainBalance: number;
  gxHealth: number;
  lastSafetyCheckAt: string | null;
  insightReviewedToday: boolean;
}): ChallengeEvalContext {
  const acts = input.activities.filter((a) => {
    const d = isoDay(a.timestamp);
    return d === input.today;
  });
  const tx = input.transactions.filter((t) => t.transactionDate === input.today && t.type === "expense");
  const flexiDrawdownToday = acts.filter((a) => a.type === "flexicredit_drawdown").length;
  const saveInsteadToday = acts.filter((a) => a.type === "save_instead").length;
  const roundUpCountToday = acts.filter((a) => a.type === "round_up_saving").length;
  const creditSpendToday = input.transactions.filter(
    (t) => t.transactionDate === input.today && (t.type === "credit_drawdown" || t.tapPaySource === "flexicard")
  ).length;
  const foodSpendToday = tx.filter((t) => t.category === "food").reduce((s, t) => s + t.amount, 0);
  const riskyTxnToday = input.transactions.some(
    (t) =>
      t.transactionDate === input.today &&
      t.type === "expense" &&
      (t.riskLevel === "high" || t.riskLevel === "critical")
  );
  const lastSafetyCheckDay = input.lastSafetyCheckAt ? isoDay(input.lastSafetyCheckAt) : null;

  return {
    userId: input.userId,
    today: input.today,
    challengeStart: input.challengeStart,
    challengeEnd: input.challengeEnd,
    activities: input.activities,
    transactions: input.transactions,
    savedToBonusEmergencyGoalsToday: input.savingsManualTodayTotal,
    emergencyAddedToday: input.emergencyAddedToday,
    roundUpEnabled: input.roundUpEnabled,
    roundUpCountToday,
    saveInsteadToday,
    flexiDrawdownToday,
    creditSpendToday,
    foodSpendToday,
    riskyTxnToday,
    mainBalance: input.mainBalance,
    gxHealth: input.gxHealth,
    lastSafetyCheckDay,
    insightReviewedToday: input.insightReviewedToday,
  };
}

export function evaluateMission(m: ChallengeDailyMission, ctx: ChallengeEvalContext): number {
  switch (m.missionKey) {
    case "save_buckets_5":
      return ctx.savedToBonusEmergencyGoalsToday >= 5 ? 1 : 0;
    case "round_up_once":
      return ctx.roundUpCountToday >= 1 ? 1 : 0;
    case "save_instead_once":
      return ctx.saveInsteadToday >= 1 ? 1 : 0;
    case "no_credit_spend_today":
      return ctx.creditSpendToday === 0 ? 1 : 0;
    case "avoid_risky_today":
      return !ctx.riskyTxnToday ? 1 : 0;
    case "no_flexi_drawdown_today":
      return ctx.flexiDrawdownToday === 0 ? 1 : 0;
    case "emergency_add_5":
      return ctx.emergencyAddedToday >= 5 ? 1 : 0;
    case "insight_review":
      return ctx.insightReviewedToday ? 1 : 0;
    case "food_under_cap":
      return ctx.foodSpendToday < 80 ? 1 : 0;
    case "device_safety_check":
      return ctx.lastSafetyCheckDay === ctx.today ? 1 : 0;
    case "main_positive":
      return ctx.mainBalance > 0 ? 1 : 0;
    case "gxhealth_maintain":
      return ctx.gxHealth >= 70 ? 1 : 0;
    default:
      return 0;
  }
}

export function growthScore(p: Pick<ChallengeParticipant, "challengeTreeLevel" | "challengeTreeExp">): number {
  return p.challengeTreeLevel * 100 + p.challengeTreeExp;
}

export function finalChallengeScore(p: ChallengeParticipant): number {
  const g = growthScore(p);
  return Math.round(g * 0.6 + p.challengeSmartScore * 0.4);
}

/** Recalculate Challenge SmartScore from challenge-period signals only (starts from base 0 + deltas). */
export function recalcChallengeSmartScore(input: {
  participant: ChallengeParticipant;
  missionsCompletedInChallenge: number;
  fullCompletionDays: number;
  saveInsteadCountInChallenge: number;
  flexiDrawdownsInChallenge: number;
  highRiskTxnCountInChallenge: number;
  gxHealthNow: number;
}): number {
  let s = 0;
  s += Math.min(400, input.missionsCompletedInChallenge * 12);
  s += Math.min(200, input.fullCompletionDays * 18);
  s += Math.min(120, input.saveInsteadCountInChallenge * 15);
  s -= Math.min(200, input.flexiDrawdownsInChallenge * 40);
  s -= Math.min(200, input.highRiskTxnCountInChallenge * 35);
  if (input.participant.gxHealthAtStart != null) {
    s += Math.max(0, Math.min(80, (input.gxHealthNow - input.participant.gxHealthAtStart) * 4));
  } else {
    s += input.gxHealthNow >= 70 ? 30 : 0;
  }
  s += Math.min(150, input.participant.fullCompletionStreak * 10);
  if (input.participant.fullCompletionStreak >= 3) s += 25;
  if (input.participant.fullCompletionStreak >= 7) s += 55;
  if (input.participant.fullCompletionStreak >= 14) s += 90;
  return Math.max(0, Math.round(s));
}

export function applyWaterToChallengeTree(
  p: ChallengeParticipant
): { next: ChallengeParticipant; leveledUp: boolean; oldLevel: number; newLevel: number } {
  if (p.challengeWater <= 0) {
    return { next: p, leveledUp: false, oldLevel: p.challengeTreeLevel, newLevel: p.challengeTreeLevel };
  }
  const oldLevel = p.challengeTreeLevel;
  let exp = p.challengeTreeExp + CHALLENGE_EXP_PER_WATER;
  let level = p.challengeTreeLevel;
  let leveledUp = false;
  while (exp >= CHALLENGE_EXP_PER_LEVEL) {
    exp -= CHALLENGE_EXP_PER_LEVEL;
    level += 1;
    leveledUp = true;
  }
  const next: ChallengeParticipant = {
    ...p,
    challengeWater: p.challengeWater - 1,
    challengeTreeExp: exp,
    challengeTreeLevel: level,
    updatedAt: new Date().toISOString(),
  };
  return { next, leveledUp, oldLevel, newLevel: level };
}

export function assignRanks(participants: ChallengeParticipant[]): ChallengeParticipant[] {
  const sorted = [...participants].sort((a, b) => {
    const fa = finalChallengeScore(a);
    const fb = finalChallengeScore(b);
    if (fb !== fa) return fb - fa;
    if (b.challengeTreeLevel !== a.challengeTreeLevel) return b.challengeTreeLevel - a.challengeTreeLevel;
    return b.challengeTreeExp - a.challengeTreeExp;
  });
  return sorted.map((p, i) => ({
    ...p,
    currentRank: i + 1,
    finalChallengeScore: finalChallengeScore(p),
  }));
}
