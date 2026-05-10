import React, { useCallback, useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../src/hooks/useAuth";
import { useChallengeStore } from "../src/store/challengeStore";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { radius } from "../src/theme/radius";
import { CHALLENGE_EXP_PER_LEVEL } from "../src/features/challenge/challenge.engine";
import {
  countClaimedChallengeMissionsForUser,
  evaluateChallengeQualification,
} from "../src/features/challenge/challenge.qualification";
import { formatRM } from "../src/lib/currency";
import { onChallengeGardenFocused, refreshChallengesForUser } from "../src/features/challenge/challengeIntegration";
import {
  ChallengeMissionCard,
  compareChallengeMissionsDisplay,
  normalizeChallengeMissionStatus,
} from "../src/components/challenge/ChallengeMissionCard";
import {
  CHALLENGE_PITCH_DEMO_ACTIVE_ID,
  CHALLENGE_PITCH_DEMO_COMPLETED_ID,
} from "../src/features/challenge/challengePitchDemo";

export default function ChallengeGardenScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const uid = currentUser?.id ?? "";
  const challenge = useChallengeStore((s) => s.challenges.find((c) => c.id === id));
  const waterTree = useChallengeStore((s) => s.waterChallengeTree);
  const claimChallengeMission = useChallengeStore((s) => s.claimChallengeMission);
  const runPitchDemo7DayCompletion = useChallengeStore((s) => s.runPitchDemo7DayCompletion);
  const simulatePitchFriendTreeLevelUp = useChallengeStore((s) => s.simulatePitchFriendTreeLevelUp);

  const today = new Date().toISOString().slice(0, 10);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      refreshChallengesForUser(uid);
      if (id) {
        onChallengeGardenFocused(id, uid);
      }
    }, [uid, id])
  );

  const me = useMemo(
    () => challenge?.participants.find((p) => p.userId === uid),
    [challenge, uid]
  );

  const todayMissions = useMemo(
    () => challenge?.missions.filter((m) => m.userId === uid && m.missionDate === today) ?? [],
    [challenge, uid, today]
  );
  const todayMissionsSorted = useMemo(
    () => [...todayMissions].sort(compareChallengeMissionsDisplay),
    [todayMissions]
  );

  const claimedToday = todayMissions.filter((m) => normalizeChallengeMissionStatus(m) === "claimed").length;
  const readyToClaim = todayMissions.filter((m) => normalizeChallengeMissionStatus(m) === "completed_unclaimed").length;

  if (!challenge || !me) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={s.miss}>Challenge not found.</Text>
        <Pressable onPress={() => router.replace("/dashboard" as never)}>
          <Text style={s.link}>Back to Home</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const daysLeft = Math.max(0, Math.round((Date.parse(challenge.endDate) - Date.parse(today)) / 86400000));
  const ranked = [...challenge.participants].sort((a, b) => (a.currentRank ?? 99) - (b.currentRank ?? 99));

  const rewardQualificationLive = useMemo(() => {
    if (challenge.status !== "active") return null;
    const completed = countClaimedChallengeMissionsForUser(challenge, uid);
    return evaluateChallengeQualification(challenge, me, completed);
  }, [challenge, me, uid]);

  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Pressable
            style={s.backBtn}
            onPress={() => {
              if (challenge.status === "active") router.replace("/dashboard" as never);
              else router.back();
            }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18L9 12L15 6" stroke="#C4B5FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{challenge.title}</Text>
            <Text style={s.sub}>
              {challenge.startDate} → {challenge.endDate} · {daysLeft} day(s) left · You are #{me.currentRank ?? "—"}
            </Text>
          </View>
        </View>

        <View style={s.hero}>
          <Text style={s.heroLabel}>My Challenge Tree</Text>
          <Text style={s.treeEmoji}>
            {me.challengeTreeLevel >= 5 ? "🌲" : me.challengeTreeLevel >= 3 ? "🌿" : me.challengeTreeLevel >= 1 ? "🪴" : "🌱"}
          </Text>
          <Text style={s.statLine}>
            Level {me.challengeTreeLevel} · EXP {me.challengeTreeExp}/{CHALLENGE_EXP_PER_LEVEL}
          </Text>
          <Text style={s.statLine}>Challenge SmartScore {me.challengeSmartScore}</Text>
          <Text style={s.statLine}>Final score (live) {me.finalChallengeScore}</Text>
          <View style={s.expTrack}>
            <View style={[s.expFill, { width: `${Math.min(100, (me.challengeTreeExp / CHALLENGE_EXP_PER_LEVEL) * 100)}%` }]} />
          </View>
          <View style={s.waterBtnRow}>
            <Pressable
              style={s.waterBtn}
              onPress={() => {
                waterTree(challenge.id, uid);
                refreshChallengesForUser(uid);
              }}
            >
              <Text style={s.waterBtnText}>Use Challenge Water</Text>
            </Pressable>
            <View style={s.waterCountPill}>
              <Text style={s.waterCountPillText}>💧 {me.challengeWater}</Text>
            </View>
          </View>
        </View>

        {rewardQualificationLive ? (
          <View style={s.qualCard}>
            <Text style={s.qualCardTitle}>Reward qualification</Text>
            <Text style={s.qualCardLine}>
              Missions (claimed): {rewardQualificationLive.completedMissions} / {rewardQualificationLive.requiredMissions}
            </Text>
            <Text style={s.qualCardLine}>
              Tree level: {rewardQualificationLive.treeLevel} / {rewardQualificationLive.requiredTreeLevel} required
            </Text>
            <Text style={s.qualCardLine}>
              Challenge SmartScore: {rewardQualificationLive.smartScore} / {rewardQualificationLive.requiredSmartScore}{" "}
              required
            </Text>
            <Text
              style={[s.qualCardStatus, rewardQualificationLive.isQualified ? s.qualCardStatusOk : s.qualCardStatusPending]}
            >
              {rewardQualificationLive.isQualified ? "Qualified for rewards" : "Not yet qualified"}
            </Text>
          </View>
        ) : null}

        <View style={s.block}>
          <Text style={s.blockTitle}>Today’s missions</Text>
          <Text style={s.progressLab}>
            Claimed {claimedToday} / {todayMissions.length || 5}
            {readyToClaim > 0 ? ` · ${readyToClaim} ready to claim` : ""} · +1 Challenge Water per claim · +2 bonus when all 5
            claimed
          </Text>
          {todayMissionsSorted.map((m) => (
            <ChallengeMissionCard
              key={m.id}
              mission={m}
              onClaim={() => {
                claimChallengeMission(challenge.id, uid, m.id);
                refreshChallengesForUser(uid);
              }}
            />
          ))}
          <Pressable style={s.secondaryBtn} onPress={() => router.push("/missions" as never)}>
            <Text style={s.secondaryBtnText}>Open full Missions (synced)</Text>
          </Pressable>
        </View>

        <View style={s.block}>
          <Text style={s.blockTitle}>Ranking</Text>
          <Text style={s.rankHint}>
            Sorted by final challenge score (60% tree growth · 40% Challenge SmartScore).
          </Text>
          {ranked.map((p) => (
            <View key={p.userId} style={s.rankRow}>
              <Text style={s.rankNum}>#{p.currentRank ?? "—"}</Text>
              <View style={s.rankNameBlock}>
                <Text style={s.rankName} numberOfLines={1}>
                  {p.displayName}
                  {p.userId === uid ? " (you)" : ""}
                </Text>
                <Text style={s.rankMeta} numberOfLines={1}>
                  Level {p.challengeTreeLevel}
                </Text>
              </View>
              <Text style={s.rankFinalScore} numberOfLines={1}>
                {p.finalChallengeScore}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.block}>
          <Text style={s.blockTitle}>Reward preview</Text>
          <Text style={s.rewardIntro}>Bonus pocket rewards by final rank when the challenge ends</Text>
          <View style={s.rewardList}>
            {challenge.rewardConfig.tiers.map((tier, idx) => (
              <View
                key={tier.rank}
                style={[s.rewardRow, idx < challenge.rewardConfig.tiers.length - 1 ? s.rewardRowDivider : null]}
              >
                <View style={s.rewardRowLeft}>
                  <Text style={s.rewardPlace}>
                    {tier.rank === 1 ? "1st place" : tier.rank === 2 ? "2nd place" : "3rd place"}
                  </Text>
                </View>
                <Text style={s.rewardAmt}>{formatRM(tier.amountRm)}</Text>
              </View>
            ))}
          </View>
          <Text style={s.rewardFoot}>
            Only participants who meet reward qualification (missions, tree level, Challenge SmartScore) can rank for
            Bonus — then auto-credited after final results.
          </Text>
        </View>

        {__DEV__ ? (
          <View style={s.pitchDevBox}>
            <Text style={s.pitchDevTitle}>Pitch demo (dev only)</Text>
            <Text style={s.pitchDevHint}>Uses sandbox data; does not change real challenge rules.</Text>
            <Pressable
              style={s.pitchDevBtn}
              onPress={() => {
                const name = currentUser?.fullName ?? undefined;
                runPitchDemo7DayCompletion(name);
                router.push(`/challenge-result?id=${encodeURIComponent(CHALLENGE_PITCH_DEMO_COMPLETED_ID)}` as never);
              }}
            >
              <Text style={s.pitchDevBtnText}>Simulate 7-Day Completion</Text>
            </Pressable>
            <Pressable
              style={s.pitchDevBtn}
              onPress={() => {
                const name = currentUser?.fullName ?? undefined;
                simulatePitchFriendTreeLevelUp(name);
                if (id !== CHALLENGE_PITCH_DEMO_ACTIVE_ID) {
                  router.push(`/challenge-garden?id=${encodeURIComponent(CHALLENGE_PITCH_DEMO_ACTIVE_ID)}` as never);
                }
              }}
            >
              <Text style={s.pitchDevBtnText}>Simulate Friend Level Up</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 48, paddingHorizontal: spacing.lg },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8 },
  backBtn: { padding: 4 },
  title: { color: "#FFF", fontSize: 20, fontWeight: "900" },
  sub: { color: "#BDB1DE", fontSize: 12, marginTop: 4, lineHeight: 16 },
  hero: {
    marginTop: 16,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: "rgba(76,29,149,0.25)",
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.35)",
    alignItems: "center",
  },
  heroLabel: { color: "#E9D5FF", fontWeight: "800", alignSelf: "flex-start" },
  treeEmoji: { fontSize: 52, marginVertical: 8 },
  statLine: { color: "#F3E8FF", fontWeight: "700", marginTop: 4 },
  expTrack: {
    height: 6,
    width: "100%",
    borderRadius: 99,
    backgroundColor: "rgba(15,23,42,0.5)",
    overflow: "hidden",
    marginTop: 10,
  },
  expFill: { height: "100%", backgroundColor: "rgba(56,189,248,0.9)" },
  waterBtnRow: {
    marginTop: 14,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  waterBtn: {
    flex: 1,
    backgroundColor: "#0EA5E9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  waterBtnText: { color: "#0F172A", fontWeight: "900" },
  waterCountPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: "rgba(14,165,233,0.2)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.55)",
    flexShrink: 0,
  },
  waterCountPillText: { color: "#E0F2FE", fontWeight: "900", fontSize: 15 },
  qualCard: {
    marginTop: 14,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: "rgba(30,27,55,0.85)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.35)",
  },
  qualCardTitle: { color: "#E9D5FF", fontWeight: "800", marginBottom: 8 },
  qualCardLine: { color: "#94A3B8", fontSize: 12, lineHeight: 18 },
  qualCardStatus: { marginTop: 10, fontWeight: "800", fontSize: 13 },
  qualCardStatusOk: { color: "#4ADE80" },
  qualCardStatusPending: { color: "#FBBF24" },
  block: {
    marginTop: 18,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: "rgba(28,21,47,0.75)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.3)",
  },
  blockTitle: { color: "#FFF", fontWeight: "900", fontSize: 16, marginBottom: 8 },
  progressLab: { color: "#94A3B8", fontSize: 12, marginBottom: 8 },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.5)",
  },
  secondaryBtnText: { color: "#C4B5FD", fontWeight: "800" },
  rankHint: { color: "#7C6F9E", fontSize: 11, marginBottom: 8 },
  rankRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 4,
  },
  rankNum: { color: "#FBBF24", fontWeight: "900", width: 34, flexShrink: 0 },
  rankNameBlock: { flex: 1, minWidth: 0, paddingRight: 4 },
  rankName: { color: "#F8FAFC", fontWeight: "700" },
  rankMeta: { color: "#94A3B8", fontSize: 11, marginTop: 2 },
  rankFinalScore: {
    flexShrink: 0,
    color: "#FBBF24",
    fontWeight: "900",
    fontSize: 15,
    minWidth: 40,
    textAlign: "right",
  },
  rewardIntro: { color: "#94A3B8", fontSize: 12, marginBottom: 10, lineHeight: 17 },
  rewardList: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
    backgroundColor: "rgba(15,23,42,0.45)",
    overflow: "hidden",
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  rewardRowDivider: { borderBottomWidth: 1, borderBottomColor: "rgba(148,163,184,0.15)" },
  rewardRowLeft: { flex: 1, minWidth: 0 },
  rewardPlace: { color: "#FEF3C7", fontWeight: "800", fontSize: 15 },
  rewardAmt: { color: "#FBBF24", fontWeight: "900", fontSize: 16, flexShrink: 0 },
  rewardFoot: { color: "#7C6F9E", fontSize: 11, marginTop: 10, lineHeight: 16 },
  pitchDevBox: {
    marginTop: 20,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.35)",
    backgroundColor: "rgba(14,165,233,0.08)",
  },
  pitchDevTitle: { color: "#E0F2FE", fontWeight: "900", fontSize: 14 },
  pitchDevHint: { color: "#94A3B8", fontSize: 11, marginTop: 6, lineHeight: 15 },
  pitchDevBtn: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: "rgba(14,165,233,0.25)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.5)",
    alignItems: "center",
  },
  pitchDevBtnText: { color: "#E0F2FE", fontWeight: "800", fontSize: 13 },
  miss: { color: "#FFF", padding: spacing.lg },
  link: { color: "#C4B5FD", paddingHorizontal: spacing.lg },
});
