import React, { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useGamificationStore } from "../src/store/gamificationStore";
import { useSavingsStore } from "../src/store/savingsStore";
import { useNotificationStore } from "../src/store/notificationStore";
import { useActivityStore } from "../src/store/activityStore";
import type { MissionLifecycleStatus } from "../src/store/gamificationStore";
import { colors } from "../src/theme/colors";
import { formatRM } from "../src/lib/currency";
import { explainMissionRecommendation } from "../src/features/ai/gamification.ai";
import { useAuth } from "../src/hooks/useAuth";
import { useChallengeStore } from "../src/store/challengeStore";
import { refreshChallengesForUser } from "../src/features/challenge/challengeIntegration";
import {
  ChallengeMissionCard,
  compareChallengeMissionsDisplay,
  normalizeChallengeMissionStatus,
} from "../src/components/challenge/ChallengeMissionCard";

export default function MissionsScreen() {
  const { currentUser } = useAuth();
  const challenges = useChallengeStore((s) => s.challenges);
  const challengeActive = useMemo(() => {
    const uid = currentUser?.id;
    if (!uid) return null;
    const t = new Date().toISOString().slice(0, 10);
    return (
      challenges.find(
        (c) =>
          c.status === "active" &&
          t >= c.startDate &&
          t <= c.endDate &&
          c.participants.some((p) => p.userId === uid && p.inviteStatus === "accepted")
      ) ?? null
    );
  }, [challenges, currentUser?.id]);
  const challengeMissionsToday = React.useMemo(() => {
    if (!challengeActive || !currentUser?.id) return [];
    const t = new Date().toISOString().slice(0, 10);
    return challengeActive.missions.filter((m) => m.userId === currentUser.id && m.missionDate === t);
  }, [challengeActive, currentUser?.id]);
  const challengeMissionsTodaySorted = React.useMemo(
    () => [...challengeMissionsToday].sort(compareChallengeMissionsDisplay),
    [challengeMissionsToday]
  );
  const challengeMissionsLeftToday = React.useMemo(
    () => challengeMissionsToday.filter((m) => normalizeChallengeMissionStatus(m) !== "claimed"),
    [challengeMissionsToday]
  );
  const claimChallengeMission = useChallengeStore((s) => s.claimChallengeMission);

  React.useEffect(() => {
    if (currentUser?.id) refreshChallengesForUser(currentUser.id);
  }, [currentUser?.id]);

  const missions = useGamificationStore((s) => s.missions);
  const claimMission = useGamificationStore((s) => s.claimMission);
  const gamifyWater = useGamificationStore((s) => s.water);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const addActivity = useActivityStore((s) => s.addActivity);
  const [missionAiTip, setMissionAiTip] = useState<string | null>(null);

  const sortedMissions = useMemo(() => {
    const rank = (st: MissionLifecycleStatus) =>
      st === "ready_to_claim" ? 0 : st === "in_progress" ? 1 : 2;
    return [...missions].sort((a, b) => rank(a.status) - rank(b.status));
  }, [missions]);

  const missionDigest = useMemo(() => {
    const inProgress = missions.filter((m) => m.status === "in_progress").map((m) => m.title);
    const ready = missions.filter((m) => m.status === "ready_to_claim").length;
    return { inProgress, ready, key: `${ready}:${inProgress.join("|")}` };
  }, [missions]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tip = await explainMissionRecommendation({
        inProgressTitles: missionDigest.inProgress,
        readyToClaim: missionDigest.ready,
        water: gamifyWater,
      });
      if (!cancelled) setMissionAiTip(tip);
    })();
    return () => {
      cancelled = true;
    };
  }, [missionDigest.key, gamifyWater]);

  const claim = (id: string) => {
    const result = claimMission(id);
    if (!result) return;
    if (result.bonusReward > 0) {
      useSavingsStore.getState().creditBonusPocket(result.bonusReward, {
        idempotencyKey: `sv-mission-bonus-${id}`,
        label: "Mission Bonus reward credited to Bonus",
        type: "bonus_credit",
      });
    }
    addNotification({
      id: `notif-mission-${id}-${Date.now()}`,
      title: "Mission reward claimed",
      message: `+${result.water} 💧 water, +${result.points} SmartScore${result.bonusReward > 0 ? `, ${formatRM(result.bonusReward)} Bonus` : ""}.`,
      time: "Just now",
      read: false,
      type: "reward",
      linkedScreen: "/missions",
    });
    addActivity({
      id: `act-mission-${id}-${Date.now()}`,
      type: "mission_completed",
      title: "Mission Completed",
      description: `Reward credited (+${result.water} 💧 water)`,
      timestamp: new Date().toISOString(),
      route: "/missions",
    });
  };

  const statusChip = (status: MissionLifecycleStatus): string => {
    if (status === "claimed") return "Claimed";
    if (status === "ready_to_claim") return "Ready to claim";
    return "In progress";
  };

  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.push("/dashboard" as never)}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18L9 12L15 6" stroke="#C4B5FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <View style={s.headerTitleWrap}>
            <Text style={s.title}>Earn 💧 Water</Text>
            {missions.some((m) => m.status === "ready_to_claim") ||
            challengeMissionsLeftToday.length > 0 ? (
              <View style={s.headerDot} />
            ) : null}
          </View>
        </View>
        <Text style={s.sub}>
          Complete missions to earn water, then water your Money Tree to grow it.
        </Text>
        {missionAiTip ? (
          <Text style={s.aiTip}>{missionAiTip.replace(/\s*💧\s*/g, " ").replace(/\s{2,}/g, " ").trim()}</Text>
        ) : null}
        <Text style={s.water}>
          💧 Water balance: <Text style={s.waterAmountBold}>{gamifyWater}</Text>
        </Text>

        {challengeActive ? (
          <View style={s.challengeSection}>
            <Text style={s.challengeSectionLabel}>Challenge Missions · {challengeActive.title}</Text>
            <Text style={s.challengeSectionMeta}>
              {challengeMissionsLeftToday.length > 0
                ? `${challengeMissionsLeftToday.length} left to finish today`
                : "All challenge missions done for today"}
            </Text>
            {challengeMissionsTodaySorted.map((m) => (
              <ChallengeMissionCard
                key={m.id}
                mission={m}
                onClaim={() => {
                  if (!currentUser?.id) return;
                  claimChallengeMission(challengeActive.id, currentUser.id, m.id);
                  refreshChallengesForUser(currentUser.id);
                }}
              />
            ))}
            <Pressable
              style={s.challengeGardenBtn}
              onPress={() => router.push(`/challenge-garden?id=${encodeURIComponent(challengeActive.id)}` as never)}
            >
              <Text style={s.challengeGardenBtnText}>Open Challenge Garden</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={s.personalSectionLabel}>Money Tree missions</Text>

        {sortedMissions.map((m) => {
          const claimable = m.status === "ready_to_claim";
          const pct = m.target > 0 ? Math.min(100, Math.round((m.progress / m.target) * 100)) : 0;
          let btnStyle = s.btnProgress;
          let label = "In Progress";
          let labelColor = "#94A3B8";
          let labelWeight: "700" | "800" | "900" = "700";
          if (m.status === "claimed") {
            btnStyle = s.btnClaimed;
            label = "Claimed";
            labelColor = "rgba(74,222,128,0.85)";
            labelWeight = "700";
          } else if (claimable) {
            btnStyle = s.btnClaim;
            label = "Claim Water";
            labelColor = "#0F172A";
            labelWeight = "900";
          }
          return (
            <View key={m.id} style={s.card}>
              <Text style={s.cardTitle}>{m.title}</Text>
              <Text style={s.cardSub}>{m.description}</Text>
              <Text style={s.cardSub}>
                Status: {statusChip(m.status)} · Progress {m.progress}/{m.target} · water{" "}
                <Text style={s.cardWaterAmountBold}>+{m.rewardWater}</Text>
              </Text>
              <View style={s.track}>
                <View style={[s.trackFill, { width: `${pct}%` }]} />
              </View>
              <Pressable
                style={btnStyle}
                onPress={() => (claimable ? claim(m.id) : undefined)}
                disabled={!claimable}
              >
                <Text style={{ color: labelColor, fontWeight: labelWeight }}>{label}</Text>
              </Pressable>
              {!claimable && m.status === "in_progress" ? (
                <Text style={s.hintMuted}>Complete the task above to unlock Claim Water.</Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 120 },
  header: { marginHorizontal: 16, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    borderWidth: 1,
    borderColor: "#1E1533",
  },
  backBtn: { padding: 2 },
  title: { color: "#FFF", fontSize: 22, fontWeight: "900" },
  sub: { color: "#BDB1DE", marginHorizontal: 16, marginTop: 8, lineHeight: 18 },
  aiTip: { color: "#C4B5FD", marginHorizontal: 16, marginTop: 10, lineHeight: 18, fontSize: 13, fontWeight: "600" },
  water: { color: "#22D3EE", marginHorizontal: 16, marginTop: 10, fontWeight: "600" },
  waterAmountBold: { fontWeight: "900", color: "#22D3EE" },
  cardWaterAmountBold: { fontWeight: "900", color: "#22D3EE" },
  card: { marginTop: 12, marginHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: "rgba(124,58,237,0.35)", backgroundColor: "rgba(28,21,47,0.7)", padding: 12, gap: 5 },
  cardTitle: { color: "#FFF", fontWeight: "800" },
  cardSub: { color: "#BDB1DE", fontSize: 12 },
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
  challengeSection: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.45)",
    backgroundColor: "rgba(120, 53, 15, 0.22)",
    gap: 2,
  },
  challengeSectionLabel: { color: "#FDE68A", fontWeight: "900", fontSize: 15 },
  challengeSectionMeta: { color: "#FBBF24", fontSize: 11, lineHeight: 15, opacity: 0.95, marginBottom: 4 },
  challengeGardenBtn: {
    marginTop: 6,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "rgba(245,158,11,0.95)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.6)",
  },
  challengeGardenBtnText: { color: "#1C1917", fontWeight: "900", fontSize: 14 },
  personalSectionLabel: {
    color: "#C4B5FD",
    fontWeight: "800",
    marginHorizontal: 16,
    marginTop: 18,
    fontSize: 13,
    letterSpacing: 0.4,
  },
});
