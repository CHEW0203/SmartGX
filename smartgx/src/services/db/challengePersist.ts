import { getSupabase } from "../../lib/supabase";
import type { ChallengeRecord } from "../../types/challenge";

export interface ChallengeBundlePersisted {
  challenges: ChallengeRecord[];
  peerLevelSnapshot: Record<string, Record<string, number>>;
}

/** Best-effort cloud mirror. Falls back silently when Supabase or tables are unavailable. */
export async function persistChallengeBundle(userId: string, bundle: ChallengeBundlePersisted): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.from("challenge_user_state").upsert(
      {
        user_id: userId,
        bundle: bundle as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function loadChallengeBundleFromSupabase(userId: string): Promise<ChallengeBundlePersisted | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from("challenge_user_state").select("bundle").eq("user_id", userId).maybeSingle();
    if (error || !data?.bundle) return null;
    const b = data.bundle as ChallengeBundlePersisted;
    if (!b.challenges || !Array.isArray(b.challenges)) return null;
    return b;
  } catch {
    return null;
  }
}
