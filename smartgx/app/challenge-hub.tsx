import React, { useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../src/hooks/useAuth";
import { useChallengeStore } from "../src/store/challengeStore";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { radius } from "../src/theme/radius";
import type { ChallengeDurationDays } from "../src/types/challenge";
import { rewardConfigForDuration } from "../src/features/challenge/challenge.engine";
import { CHALLENGE_QUALIFICATION_CONFIG } from "../src/features/challenge/challenge.qualification";
import { formatRM } from "../src/lib/currency";
const DURATIONS: { days: ChallengeDurationDays; blurb: string }[] = [
  { days: 7, blurb: "Quick sprint with friends — build habits fast." },
  { days: 14, blurb: "Two weeks of focused financial resilience." },
  { days: 30, blurb: "Full month competition for serious growers." },
];

export default function ChallengeHubScreen() {
  const { currentUser } = useAuth();
  const challenges = useChallengeStore((s) => s.challenges);
  const uid = currentUser?.id ?? "";
  const [selectedDuration, setSelectedDuration] = useState<ChallengeDurationDays | null>(null);

  const active = useMemo(() => {
    const t = new Date().toISOString().slice(0, 10);
    return challenges.find(
      (c) =>
        c.status === "active" &&
        t >= c.startDate &&
        t <= c.endDate &&
        c.participants.some((p) => p.userId === uid && p.inviteStatus === "accepted")
    );
  }, [challenges, uid]);

  const past = useMemo(
    () => challenges.filter((c) => c.status === "completed" && c.participants.some((p) => p.userId === uid)),
    [challenges, uid]
  );

  if (!currentUser) {
    return <Redirect href="/auth/login" />;
  }

  if (active) {
    return <Redirect href={`/challenge-garden?id=${encodeURIComponent(active.id)}`} />;
  }

  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18L9 12L15 6" stroke="#C4B5FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text style={s.title}>Challenge Hub</Text>
        </View>
        <Text style={s.lead}>
          Compete with friends on a separate Challenge Tree and Challenge SmartScore. Your personal Money Tree is unchanged.
        </Text>

        <Text style={s.sectionLabel}>Start a challenge</Text>
        <Text style={s.pickHint}>Choose a duration below, then tap Select to invite friends and start.</Text>
        {DURATIONS.map(({ days, blurb }) => {
          const cfg = rewardConfigForDuration(days);
          const qual = CHALLENGE_QUALIFICATION_CONFIG[days];
          const selected = selectedDuration === days;
          const t1 = cfg.tiers[0];
          const t2 = cfg.tiers[1];
          const t3 = cfg.tiers[2];
          return (
            <View key={days} style={[s.durCard, selected ? s.durCardSelected : null]}>
              <Pressable onPress={() => setSelectedDuration(days)} style={s.durCardTap}>
                <Text style={s.durTitle}>{days}-Day Challenge</Text>
                <Text style={s.durBody}>{blurb}</Text>

                <Text style={s.blockLabel}>Rewards (Bonus pocket)</Text>
                <View style={s.rewardList}>
                  <View style={s.rewardTierRow}>
                    <Text style={s.rewardPlace}>1st place</Text>
                    <Text style={s.rewardAmt}>{formatRM(t1.amountRm)}</Text>
                  </View>
                  <View style={s.rewardTierDivider} />
                  <View style={s.rewardTierRow}>
                    <Text style={s.rewardPlace}>2nd place</Text>
                    <Text style={s.rewardAmt}>{formatRM(t2.amountRm)}</Text>
                  </View>
                  <View style={s.rewardTierDivider} />
                  <View style={s.rewardTierRow}>
                    <Text style={s.rewardPlace}>3rd place</Text>
                    <Text style={s.rewardAmt}>{formatRM(t3.amountRm)}</Text>
                  </View>
                </View>

                <Text style={s.blockLabel}>Missions</Text>
                <Text style={s.blockValue}>5 financial-resilience missions per day</Text>
                <Text style={s.blockSub}>Up to {qual.totalMissions} missions count toward qualification over the full run</Text>

                <Text style={s.blockLabel}>Challenge size</Text>
                <Text style={s.blockValue}>Minimum 2 participants (you + at least 1 friend)</Text>
                <Text style={s.blockSub}>
                  2 players: 1st place paid only · 3 players: top 3 paid · 4+ players: top 3 paid
                </Text>

                <View style={s.qualFrame}>
                  <Text style={s.qualFrameTitle}>Qualification for Bonus rewards</Text>
                  <Text style={s.qualFrameIntro}>
                    Only participants who meet all of the following by challenge end can rank for Bonus payouts:
                  </Text>
                  <Text style={s.qualFrameLine}>
                    • Complete at least {qual.minCompletedMissions} / {qual.totalMissions} challenge missions (claimed)
                  </Text>
                  <Text style={s.qualFrameLine}>• Challenge Tree Level {qual.minTreeLevel} or higher</Text>
                  <Text style={s.qualFrameLine}>• Challenge SmartScore {qual.minSmartScore} or higher</Text>
                  <Text style={s.qualFrameFoot}>
                    Final rank blends tree growth (60%) and Challenge SmartScore (40%). Challenge Tree starts at Level 0.
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={[s.durSelectBtn, selected ? s.durSelectBtnSelected : null]}
                onPress={() => {
                  setSelectedDuration(days);
                  router.push(`/challenge-invite?days=${days}` as never);
                }}
              >
                <Text style={selected ? s.durSelectLabelSelected : s.durSelectLabel}>Select</Text>
              </Pressable>
            </View>
          );
        })}

        {past.length > 0 ? (
          <>
            <Text style={s.sectionLabel}>Past challenges</Text>
            {past.slice(0, 6).map((c) => (
              <Pressable
                key={c.id}
                style={s.pastRow}
                onPress={() => router.push(`/challenge-result?id=${encodeURIComponent(c.id)}` as never)}
              >
                <Text style={s.pastTitle}>{c.title}</Text>
                <Text style={s.pastSub}>
                  {c.startDate} → {c.endDate}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}

        <View style={s.infoBox}>
          <Text style={s.infoTitle}>How it works</Text>
          <Text style={s.infoBody}>
            • Challenge Water, Challenge Tree level, and Challenge SmartScore are separate from your personal Money Tree.{"\n"}•
            Missions reset daily; complete all 5 for bonus water and streak rewards.{"\n"}• Final rank blends tree growth (60%)
            and Challenge SmartScore (40%).{"\n"}• We notify you when a friend’s Challenge Tree levels up — not for every
            mission.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 48, paddingHorizontal: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  backBtn: { padding: 4 },
  title: { color: "#FFF", fontSize: 22, fontWeight: "900" },
  lead: { color: "#BDB1DE", marginTop: 12, lineHeight: 20 },
  sectionLabel: { color: "#C4B5FD", fontWeight: "800", marginTop: 22, marginBottom: 8, fontSize: 13, letterSpacing: 0.6 },
  pickHint: { color: "#94A3B8", fontSize: 13, lineHeight: 18, marginBottom: 10 },
  durCard: {
    padding: 14,
    paddingBottom: 12,
    borderRadius: radius.lg,
    backgroundColor: "rgba(28,21,47,0.85)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.35)",
    marginBottom: 12,
    gap: 0,
  },
  durCardTap: { gap: 0 },
  durCardSelected: {
    backgroundColor: "rgba(76,29,149,0.45)",
    borderWidth: 2,
    borderColor: "rgba(192,132,252,0.85)",
    shadowColor: "#A78BFA",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  blockLabel: { color: "#FDE68A", fontWeight: "800", fontSize: 12, marginTop: 14, marginBottom: 6 },
  blockValue: { color: "#F1F5F9", fontWeight: "700", fontSize: 13, lineHeight: 18 },
  blockSub: { color: "#94A3B8", fontSize: 11, lineHeight: 16, marginTop: 4 },
  rewardList: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.28)",
    backgroundColor: "rgba(15,23,42,0.45)",
    overflow: "hidden",
  },
  rewardTierRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  rewardTierDivider: { height: 1, backgroundColor: "rgba(148,163,184,0.12)" },
  rewardPlace: { color: "#FEF3C7", fontWeight: "800", fontSize: 13, flex: 1 },
  rewardAmt: { color: "#FBBF24", fontWeight: "900", fontSize: 14 },
  qualFrame: {
    marginTop: 14,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.45)",
    backgroundColor: "rgba(76,29,149,0.2)",
  },
  qualFrameTitle: { color: "#E9D5FF", fontWeight: "900", fontSize: 13, marginBottom: 8 },
  qualFrameIntro: { color: "#94A3B8", fontSize: 11, lineHeight: 16, marginBottom: 8 },
  qualFrameLine: { color: "#E2E8F0", fontSize: 11, lineHeight: 17, marginTop: 4 },
  qualFrameFoot: { color: "#7C6F9E", fontSize: 10, lineHeight: 15, marginTop: 10 },
  durSelectBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: "#A855F7",
    borderWidth: 1,
    borderColor: "rgba(216,180,254,0.75)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  durSelectBtnSelected: {
    backgroundColor: "rgba(124,58,237,0.95)",
    borderColor: "rgba(233,213,255,0.85)",
    shadowColor: "#C4B5FD",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  durSelectLabel: { color: "#FAF5FF", fontWeight: "900", fontSize: 15 },
  durSelectLabelSelected: { color: "#FFF", fontWeight: "900", fontSize: 15 },
  durTitle: { color: "#FFF", fontWeight: "900", fontSize: 17 },
  durBody: { color: "#BDB1DE", fontSize: 13, lineHeight: 18, marginTop: 6, marginBottom: 2 },
  pastRow: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: "rgba(15,23,42,0.5)",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
  },
  pastTitle: { color: "#E2E8F0", fontWeight: "700" },
  pastSub: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  infoBox: {
    marginTop: 24,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: "rgba(30,27,55,0.9)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.25)",
  },
  infoTitle: { color: "#A5B4FC", fontWeight: "800", marginBottom: 8 },
  infoBody: { color: "#94A3B8", fontSize: 12, lineHeight: 18 },
});
