import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ChallengeDailyMission } from "../../types/challenge";

export type ChallengeMissionUiStatus = "in_progress" | "completed_unclaimed" | "claimed";

export function normalizeChallengeMissionStatus(m: ChallengeDailyMission): ChallengeMissionUiStatus {
  const s = m.status as string;
  if (s === "reward_granted" || s === "claimed") return "claimed";
  if (s === "completed_unclaimed" || s === "completed") return "completed_unclaimed";
  return "in_progress";
}

/** Display order: claimable → in progress → claimed. Stable tie-break on id. */
export function compareChallengeMissionsDisplay(a: ChallengeDailyMission, b: ChallengeDailyMission): number {
  const pri = (m: ChallengeDailyMission) => {
    const st = normalizeChallengeMissionStatus(m);
    if (st === "completed_unclaimed") return 1;
    if (st === "in_progress") return 2;
    return 3;
  };
  const pa = pri(a);
  const pb = pri(b);
  if (pa !== pb) return pa - pb;
  return String(a.id).localeCompare(String(b.id));
}

interface Props {
  mission: ChallengeDailyMission;
  onClaim?: () => void;
}

export function ChallengeMissionCard({ mission, onClaim }: Props) {
  const st = normalizeChallengeMissionStatus(mission);
  const pct =
    mission.targetValue > 0 ? Math.min(100, Math.round((mission.progressValue / mission.targetValue) * 100)) : 0;

  let btnStyle = styles.btnProgress;
  let label = "In Progress";
  let labelColor = "#94A3B8";
  let labelWeight: "700" | "800" | "900" = "700";
  const claimable = st === "completed_unclaimed";

  if (st === "claimed") {
    btnStyle = styles.btnClaimed;
    label = "Claimed";
    labelColor = "rgba(74,222,128,0.85)";
    labelWeight = "700";
  } else if (claimable) {
    btnStyle = styles.btnClaim;
    label = "Claim";
    labelColor = "#0F172A";
    labelWeight = "900";
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{mission.title}</Text>
      <Text style={styles.cardSub}>{mission.description}</Text>
      <Text style={styles.cardSub}>
        Challenge water <Text style={styles.waterAmountBold}>+{mission.rewardWater}</Text>
      </Text>
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${pct}%` }]} />
      </View>
      <Pressable style={btnStyle} onPress={() => (claimable && onClaim ? onClaim() : undefined)} disabled={!claimable}>
        <Text style={{ color: labelColor, fontWeight: labelWeight }}>{label}</Text>
      </Pressable>
      {!claimable && st === "in_progress" ? (
        <Text style={styles.hintMuted}>Complete the task to unlock Claim.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.35)",
    backgroundColor: "rgba(28,21,47,0.7)",
    padding: 12,
    gap: 5,
  },
  cardTitle: { color: "#FFF", fontWeight: "800" },
  cardSub: { color: "#BDB1DE", fontSize: 12 },
  waterAmountBold: { fontWeight: "900", color: "#22D3EE" },
  track: { height: 6, borderRadius: 99, backgroundColor: "rgba(124,58,237,0.2)", overflow: "hidden", marginTop: 4 },
  trackFill: { height: "100%", backgroundColor: "rgba(56,189,248,0.85)" },
  btnClaim: {
    marginTop: 8,
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22C55E",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.5)",
  },
  btnProgress: {
    marginTop: 8,
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(55,48,82,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
  },
  btnClaimed: {
    marginTop: 8,
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
  },
  hintMuted: { color: "#7C6F9E", fontSize: 11, marginTop: 4 },
});
