import { useChallengeStore } from "../../store/challengeStore";

export { buildChallengeEvalContextForUser } from "./challengeEvalContext";

export function refreshChallengesForUser(userId: string | null | undefined): void {
  if (!userId) return;
  useChallengeStore.getState().refreshProgressForUser(userId);
}

export function markChallengeInsightReviewed(userId: string | null | undefined, day: string): void {
  if (!userId) return;
  useChallengeStore.getState().markInsightReviewed(userId, day);
}

export function onChallengeGardenFocused(challengeId: string, viewerId: string | null | undefined): void {
  if (!viewerId) return;
  useChallengeStore.getState().onGardenFocused(challengeId, viewerId);
}
