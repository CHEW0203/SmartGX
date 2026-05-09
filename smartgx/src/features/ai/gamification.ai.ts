import { callSmartGxAi } from "../../services/ai/ai.client";
import { getAiConfig } from "./ai.config";

interface GamificationExplainInput {
  gxHealth: number;
  streak: number;
  missionCompleted: number;
  riskyActions: number;
}

function treeFallback(input: GamificationExplainInput): string {
  if (input.gxHealth >= 75 && input.streak >= 5 && input.missionCompleted >= 3) {
    return "Your Money Tree is flourishing because your GXHealth is strong and your saving habits are consistent this week.";
  }
  if (input.riskyActions > 2) {
    return "Your Money Tree health is under pressure due to recent risky actions. Complete missions and save consistently to recover.";
  }
  return "Your Money Tree is stable. A few more saving days and mission completions will improve its health quickly.";
}

export async function explainTreeHealth(input: GamificationExplainInput): Promise<string> {
  const base = treeFallback(input);
  const cfg = getAiConfig();
  if (!cfg.enabled) return base;
  try {
    const res = await callSmartGxAi(
      "tree_health",
      "In 2 short sentences, explain SmartGX Money Tree health from these stats. Plain text only.",
      { ...input },
      cfg
    );
    if (res?.success && res.content.trim()) return res.content.trim().slice(0, 450);
  } catch {
    /* ignore */
  }
  return base;
}

function leaderboardFallback(input: {
  movement: number;
  completedMissions: number;
  streak: number;
}): string {
  if (input.movement > 0) {
    return `You moved up ${input.movement} rank because you completed ${input.completedMissions} mission(s) and maintained a ${input.streak}-day saving streak.`;
  }
  if (input.movement < 0) {
    return "Your rank dipped due to lower mission and streak momentum this period. Save today and complete one mission to recover.";
  }
  return "Your rank is steady. Complete one daily mission and keep your streak active to move up.";
}

export async function explainLeaderboardMove(input: {
  movement: number;
  completedMissions: number;
  streak: number;
}): Promise<string> {
  const base = leaderboardFallback(input);
  const cfg = getAiConfig();
  if (!cfg.enabled) return base;
  try {
    const res = await callSmartGxAi(
      "smartscore",
      "Explain this user's SmartGX SmartScore / leaderboard momentum in 2 sentences. Plain text only.",
      { ...input },
      cfg
    );
    if (res?.success && res.content.trim()) return res.content.trim().slice(0, 450);
  } catch {
    /* ignore */
  }
  return base;
}

const DEFAULT_SCORE_BLURB =
  "SmartScore rewards consistent saving, mission completion, better GXHealth, responsible credit behaviour, and on-time repayment. It does not rank users by income or wealth.";

export async function explainSmartScoreBlurb(input: {
  smartScore: number;
  streak: number;
  gxHealth: number;
  missionsDone: number;
  missionsTotal: number;
  rankMovement: number;
}): Promise<string> {
  const cfg = getAiConfig();
  if (!cfg.enabled) return DEFAULT_SCORE_BLURB;
  try {
    const res = await callSmartGxAi(
      "smartscore",
      [
        "Explain in 2–3 short sentences how this user's SmartGX score story fits their current stats.",
        "Do not contradict the numeric breakdown in context; you are explaining only, not recalculating.",
        "Plain text only.",
      ].join(" "),
      { ...input, staticSummary: DEFAULT_SCORE_BLURB },
      cfg
    );
    if (res?.success && res.content.trim()) return res.content.trim().slice(0, 700);
  } catch {
    /* ignore */
  }
  return DEFAULT_SCORE_BLURB;
}

export async function explainMissionRecommendation(input: {
  inProgressTitles: string[];
  readyToClaim: number;
  water: number;
}): Promise<string> {
  const base =
    input.inProgressTitles.length > 0
      ? `Tip: finish “${input.inProgressTitles[0]}” first, then claim when it shows Ready to claim.`
      : "Complete daily and weekly missions to earn water for your Money Tree.";
  const cfg = getAiConfig();
  if (!cfg.enabled) return base;
  try {
    const res = await callSmartGxAi(
      "mission",
      "Give one practical SmartGX mission tip (max 2 sentences) from this progress. Plain text only.",
      { ...input },
      cfg
    );
    if (res?.success && res.content.trim()) return res.content.trim().slice(0, 400);
  } catch {
    /* ignore */
  }
  return base;
}
