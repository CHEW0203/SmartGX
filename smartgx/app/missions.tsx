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

export default function MissionsScreen() {
  const missions = useGamificationStore((s) => s.missions);
  const claimMission = useGamificationStore((s) => s.claimMission);
  const gamifyWater = useGamificationStore((s) => s.water);
  const manualSave = useSavingsStore((s) => s.manualSave);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const addActivity = useActivityStore((s) => s.addActivity);
  const [missionAiTip, setMissionAiTip] = useState<string | null>(null);

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
    if (result.bonusReward > 0) manualSave("bonus", result.bonusReward);
    addNotification({
      id: `notif-mission-${id}-${Date.now()}`,
      title: "Mission reward claimed",
      message: `+${result.water} water, +${result.points} SmartScore${result.bonusReward > 0 ? `, ${formatRM(result.bonusReward)} Bonus` : ""}.`,
      time: "Just now",
      read: false,
      type: "reward",
      linkedScreen: "/missions",
    });
    addActivity({
      id: `act-mission-${id}-${Date.now()}`,
      type: "mission_completed",
      title: "Mission Completed",
      description: `Reward credited (+${result.water} water)`,
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
            <Text style={s.title}>Earn Water</Text>
            {missions.some((m) => m.status === "ready_to_claim") ? <View style={s.headerDot} /> : null}
          </View>
        </View>
        <Text style={s.sub}>Complete missions to earn water, then water your Money Tree to grow it.</Text>
        {missionAiTip ? <Text style={s.aiTip}>{missionAiTip}</Text> : null}
        <Text style={s.water}>Water Balance 💧 {gamifyWater}</Text>

        {missions.map((m) => {
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
              <Text style={s.cardSub}>Status: {statusChip(m.status)} · Progress {m.progress}/{m.target} · +{m.rewardWater} water</Text>
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
  water: { color: "#22D3EE", marginHorizontal: 16, marginTop: 10, fontWeight: "800" },
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
});
