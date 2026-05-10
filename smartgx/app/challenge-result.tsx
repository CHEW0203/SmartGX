import React, { useEffect, useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../src/hooks/useAuth";
import { useChallengeStore } from "../src/store/challengeStore";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { radius } from "../src/theme/radius";
import { formatRM } from "../src/lib/currency";
import { rewardConfigForDuration } from "../src/features/challenge/challenge.engine";
import type { ChallengeParticipant, ChallengeRecord } from "../src/types/challenge";
import {
  countClaimedChallengeMissionsForUser,
  evaluateChallengeQualification,
  qualificationThresholdsForDuration,
} from "../src/features/challenge/challenge.qualification";

function resolveParticipantQual(challenge: ChallengeRecord, p: ChallengeParticipant) {
  if (p.rewardQualification) return p.rewardQualification;
  const mc = countClaimedChallengeMissionsForUser(challenge, p.userId);
  const ev = evaluateChallengeQualification(challenge, p, mc);
  return { ...ev, evaluatedAt: challenge.updatedAt };
}

const DEMO_7DAY_SUMMARY = {
  title: "7-Day Friend Challenge",
  statusLabel: "Completed",
  yourRank: 1,
  treeLevel: 4,
  smartScore: 235,
  missionsCompleted: 29,
  missionsTotal: 35,
  qualified: true,
  rewardRm: 5,
  rewardCredited: true,
  /** Sample calendar copy for pitch. */
  dateRangeLabel: "Mon 3 Feb → Sun 9 Feb (7 days)",
  podium: [
    { name: "You", rank: 1, score: 412, level: 4 },
    { name: "Aina Rahman", rank: 2, score: 398, level: 4 },
    { name: "Daniel Wong", rank: 3, score: 371, level: 3 },
  ] as const,
};

const DEMO_AFTER_DAY7_STEPS = [
  "End date passes — final Challenge Tree + SmartScore scores are frozen.",
  "Each player is checked against reward qualification (missions, tree level, SmartScore).",
  "Only qualified players are ranked for cash; 7-day prizes are RM5 / RM3 / RM1 for top 3 qualified (4+ players).",
  "Bonus RM is credited automatically to each winner’s Bonus pocket (same as live app).",
] as const;

const DEMO_BONUS_DISPATCH = (() => {
  const tiers = rewardConfigForDuration(7).tiers;
  return [
    { rewardRank: 1 as const, who: "You", score: 412, amountRm: tiers[0].amountRm, status: "Credited ✓" as const },
    { rewardRank: 2 as const, who: "Aina Rahman", score: 398, amountRm: tiers[1].amountRm, status: "Credited ✓" as const },
    { rewardRank: 3 as const, who: "Daniel Wong", score: 371, amountRm: tiers[2].amountRm, status: "Credited ✓" as const },
  ];
})();

export default function ChallengeResultScreen() {
  const { id, demo } = useLocalSearchParams<{ id?: string; demo?: string }>();
  const { currentUser } = useAuth();
  const uid = currentUser?.id ?? "";
  const challenge = useChallengeStore((s) => (id ? s.challenges.find((c) => c.id === id) : undefined));

  const isDemo7 = demo === "7day";

  useEffect(() => {
    if (!id || isDemo7) return;
    const st = useChallengeStore.getState();
    st.creditMyPendingChallengeRewards(id);
    st.notifyChallengeEndForViewerIfNeeded(id);
  }, [id, isDemo7]);

  const me = useMemo(
    () => (challenge ? challenge.participants.find((p) => p.userId === uid) : undefined),
    [challenge, uid]
  );

  const meQual = useMemo(() => {
    if (!challenge || !me) return null;
    return resolveParticipantQual(challenge, me);
  }, [challenge, me]);

  const missionTotals = useMemo(() => {
    if (!challenge) return null;
    return qualificationThresholdsForDuration(challenge.durationDays);
  }, [challenge]);

  const podium = useMemo(() => {
    if (isDemo7) {
      return DEMO_7DAY_SUMMARY.podium.map((p) => ({ ...p, userId: p.name }));
    }
    if (!challenge) return [];
    return [...challenge.participants]
      .map((p) => ({ p, q: resolveParticipantQual(challenge, p) }))
      .filter(({ q }) => q.isQualified)
      .sort((a, b) => (a.p.currentRank ?? 99) - (b.p.currentRank ?? 99))
      .slice(0, 3)
      .map(({ p }) => ({
        userId: p.userId,
        name: p.displayName,
        rank: p.currentRank ?? 0,
        score: p.finalChallengeScore,
        level: p.challengeTreeLevel,
      }));
  }, [challenge, isDemo7]);

  if (!isDemo7 && !challenge) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={s.miss}>Challenge not found.</Text>
        <Pressable onPress={() => router.replace("/challenge-hub" as never)}>
          <Text style={s.link}>Challenge Hub</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.replace("/challenge-hub" as never)}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18L9 12L15 6" stroke="#C4B5FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text style={s.title}>Challenge results</Text>
        </View>

        <LinearGradient
          colors={["rgba(91,33,182,0.55)", "rgba(30,27,55,0.95)", "rgba(15,5,41,0.98)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          {isDemo7 ? (
            <View style={s.demoPill}>
              <Text style={s.demoPillText}>Demo preview</Text>
            </View>
          ) : null}
          <Text style={s.heroTitle}>{isDemo7 ? DEMO_7DAY_SUMMARY.title : challenge!.title}</Text>
          <Text style={s.heroStatus}>
            Status: <Text style={s.heroStatusEm}>{isDemo7 ? DEMO_7DAY_SUMMARY.statusLabel : "Completed"}</Text>
          </Text>
          {isDemo7 ? (
            <Text style={s.heroDemoDates}>Simulated timeline · {DEMO_7DAY_SUMMARY.dateRangeLabel}</Text>
          ) : null}
        </LinearGradient>

        <View style={s.podium}>
          {podium.length === 0 && !isDemo7 && challenge ? (
            <Text style={s.noPodium}>
              No qualified finishers in the reward positions — Bonus Rewards were only available to participants who met
              the minimum requirements.
            </Text>
          ) : (
            podium.map((p, i) => (
              <View key={p.userId} style={[s.pSlot, i === 0 && s.pGold, i === 1 && s.pSilver, i === 2 && s.pBronze]}>
                <Text style={s.pEmoji}>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</Text>
                <Text style={s.pName}>{p.name}</Text>
                <Text style={s.pScore}>{p.score}</Text>
              </View>
            ))
          )}
        </View>

        {isDemo7 ? (
          <>
            <View style={s.meCard}>
              <Text style={s.meTitle}>Your result (demo)</Text>
              <View style={s.table}>
                <View style={s.tableHeadRow}>
                  <Text style={[s.th, s.thLeft]}>Item</Text>
                  <Text style={[s.th, s.thRight]}>Value</Text>
                </View>
                <View style={s.tableRow}>
                  <Text style={s.tdLabel}>Place</Text>
                  <Text style={s.tdValue}>1st</Text>
                </View>
                <View style={s.tableRow}>
                  <Text style={s.tdLabel}>Challenge Tree Level</Text>
                  <Text style={s.tdValue}>{DEMO_7DAY_SUMMARY.treeLevel}</Text>
                </View>
                <View style={s.tableRow}>
                  <Text style={s.tdLabel}>Challenge SmartScore</Text>
                  <Text style={s.tdValue}>{DEMO_7DAY_SUMMARY.smartScore}</Text>
                </View>
                <View style={s.tableRow}>
                  <Text style={s.tdLabel}>Missions completed</Text>
                  <Text style={s.tdValue}>
                    {DEMO_7DAY_SUMMARY.missionsCompleted} / {DEMO_7DAY_SUMMARY.missionsTotal}
                  </Text>
                </View>
                <View style={s.tableRow}>
                  <Text style={s.tdLabel}>Qualified for rewards</Text>
                  <Text style={s.tdValue}>{DEMO_7DAY_SUMMARY.qualified ? "Yes" : "No"}</Text>
                </View>
                <View style={s.tableRow}>
                  <Text style={s.tdLabel}>Reward</Text>
                  <Text style={s.tdValue}>{formatRM(DEMO_7DAY_SUMMARY.rewardRm)} Bonus</Text>
                </View>
                <View style={[s.tableRow, s.tableRowLast]}>
                  <Text style={s.tdLabel}>Bonus pocket</Text>
                  <Text style={s.tdValueCredited}>
                    Credited{DEMO_7DAY_SUMMARY.rewardCredited ? " ✓" : ""}
                  </Text>
                </View>
              </View>
            </View>

            <View style={s.demoSection}>
              <Text style={s.demoSectionTitle}>After day 7 — what players see (simulated)</Text>
              {DEMO_AFTER_DAY7_STEPS.map((line, i) => (
                <Text key={i} style={s.demoSectionLine}>
                  {i + 1}. {line}
                </Text>
              ))}
            </View>

            <View style={s.demoBonusCard}>
              <Text style={s.demoBonusTitle}>Bonus payout (demo)</Text>
              <Text style={s.demoBonusSub}>
                Qualified winners only · auto-credit to <Text style={s.demoBonusEm}>Bonus pocket</Text> (no extra tap)
              </Text>
              <View style={s.bonusTable}>
                <View style={s.bonusHeadRow}>
                  <Text style={[s.bonusTh, s.bonusColRank]}>Paid</Text>
                  <Text style={[s.bonusTh, s.bonusColName]}>Name · Score</Text>
                  <Text style={[s.bonusTh, s.bonusColAmt]}>Bonus</Text>
                  <Text style={[s.bonusTh, s.bonusColStat]}>Status</Text>
                </View>
                {DEMO_BONUS_DISPATCH.map((row, idx) => (
                  <View
                    key={row.rewardRank}
                    style={[s.bonusDataRow, idx === DEMO_BONUS_DISPATCH.length - 1 ? s.bonusDataRowLast : null]}
                  >
                    <Text style={[s.bonusTd, s.bonusColRank]}>#{row.rewardRank}</Text>
                    <Text style={[s.bonusTd, s.bonusColName]} numberOfLines={2}>
                      {row.who} · {row.score}
                    </Text>
                    <Text style={[s.bonusTd, s.bonusColAmt]}>{formatRM(row.amountRm)}</Text>
                    <Text style={[s.bonusTd, s.bonusColStat]} numberOfLines={2}>
                      {row.status}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={s.demoBonusFoot}>
                In the real app, this matches your challenge duration’s prize tiers after qualification checks.
              </Text>
            </View>

            <Text style={s.demoFoot}>
              Demo only — sample data for pitching. Live challenges use your real ranks, qualification, and Bonus
              credits.
            </Text>
          </>
        ) : me && meQual ? (
          <View style={s.meCard}>
            <Text style={s.meTitle}>Your result</Text>
            <View style={s.table}>
              <View style={s.tableHeadRow}>
                <Text style={[s.th, s.thLeft]}>Item</Text>
                <Text style={[s.th, s.thRight]}>Value</Text>
              </View>
              <View style={s.tableRow}>
                <Text style={s.tdLabel}>Final score</Text>
                <Text style={s.tdValue}>{me.finalChallengeScore}</Text>
              </View>
              <View style={s.tableRow}>
                <Text style={s.tdLabel}>Challenge Tree Level</Text>
                <Text style={s.tdValue}>{me.challengeTreeLevel}</Text>
              </View>
              <View style={s.tableRow}>
                <Text style={s.tdLabel}>Challenge SmartScore</Text>
                <Text style={s.tdValue}>{me.challengeSmartScore}</Text>
              </View>
              <View style={s.tableRow}>
                <Text style={s.tdLabel}>Missions completed (claimed)</Text>
                <Text style={s.tdValue}>
                  {meQual.completedMissions} / {missionTotals!.totalMissions}
                </Text>
              </View>
              <View style={s.tableRow}>
                <Text style={s.tdLabel}>Minimum missions to qualify</Text>
                <Text style={s.tdValue}>
                  {meQual.requiredMissions} claimed (of {missionTotals!.totalMissions} possible)
                </Text>
              </View>
              <View style={[s.tableRow, s.tableRowLast]}>
                <Text style={s.tdLabel}>Reward qualification</Text>
                <Text style={s.tdValue}>{meQual.isQualified ? "Qualified" : "Not qualified"}</Text>
              </View>
            </View>
            {!meQual.isQualified ? (
              <View style={s.missBox}>
                <Text style={s.missTitle}>Qualification detail</Text>
                {meQual.missingRequirements.slice(0, 3).map((line, idx) => (
                  <Text key={`${idx}-${line.slice(0, 32)}`} style={s.missLine}>
                    • {line}
                  </Text>
                ))}
              </View>
            ) : null}
            {challenge!.rewards.find((r) => r.userId === uid && r.credited) ? (
              <Text style={s.credited}>Reward credited to Bonus pocket ✓</Text>
            ) : challenge!.rewards.some((r) => r.userId === uid) ? (
              <Text style={s.credited}>Reward pending sync — open again to credit Bonus pocket</Text>
            ) : meQual.isQualified ? (
              <Text style={s.creditedSoft}>You qualified but did not place in a paid reward position.</Text>
            ) : (
              <Text style={s.creditedSoft}>No Bonus Reward — qualification threshold not met.</Text>
            )}
          </View>
        ) : null}

        {!isDemo7 && challenge ? (
          <>
            {challenge.rewards.length === 0 ? (
              <View style={s.noRewardBanner}>
                <Text style={s.noRewardTitle}>
                  No participant reached the minimum qualification threshold. No Bonus Rewards were issued for this
                  challenge.
                </Text>
                <Text style={s.noRewardSub}>
                  Complete missions consistently, grow your challenge tree, and reach the required SmartScore to qualify
                  next time.
                </Text>
              </View>
            ) : null}

            {challenge.rewards.length > 0 ? (
              <View style={s.rewardBox}>
                <Text style={s.rewardHead}>Bonus payout</Text>
                <View style={s.bonusTable}>
                  <View style={s.bonusHeadRow}>
                    <Text style={[s.bonusTh, s.bonusColRank]}>Paid</Text>
                    <Text style={[s.bonusTh, s.bonusColName]}>Name · Score</Text>
                    <Text style={[s.bonusTh, s.bonusColAmt]}>Bonus</Text>
                    <Text style={[s.bonusTh, s.bonusColStat]}>Status</Text>
                  </View>
                  {challenge.rewards.map((r, rIdx) => {
                    const rp = challenge.participants.find((p) => p.userId === r.userId);
                    const sc = rp?.finalChallengeScore ?? "—";
                    return (
                      <View
                        key={r.id}
                        style={[
                          s.bonusDataRow,
                          rIdx === challenge.rewards.length - 1 ? s.bonusDataRowLast : null,
                        ]}
                      >
                        <Text style={[s.bonusTd, s.bonusColRank]}>#{r.rank}</Text>
                        <Text style={[s.bonusTd, s.bonusColName]} numberOfLines={2}>
                          {rp?.displayName ?? r.userId} · {sc}
                        </Text>
                        <Text style={[s.bonusTd, s.bonusColAmt]}>{formatRM(r.rewardAmount)}</Text>
                        <Text style={[s.bonusTd, s.bonusColStat]}>{r.credited ? "Credited" : "Pending"}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  backBtn: { padding: 4 },
  title: { color: "#FFF", fontSize: 22, fontWeight: "900" },
  hero: {
    marginTop: 12,
    padding: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.35)",
  },
  demoPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: "rgba(250,204,21,0.2)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.45)",
    marginBottom: 10,
  },
  demoPillText: { color: "#FDE68A", fontWeight: "800", fontSize: 11, letterSpacing: 0.4 },
  heroTitle: { color: "#FFF", fontSize: 22, fontWeight: "900", letterSpacing: -0.3 },
  heroStatus: { color: "#C4B5FD", marginTop: 8, fontSize: 14 },
  heroStatusEm: { color: "#4ADE80", fontWeight: "800" },
  heroDemoDates: { color: "#A5B4FC", marginTop: 10, fontSize: 12, lineHeight: 17 },
  demoSection: {
    marginTop: 18,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: "rgba(30,27,55,0.75)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.3)",
  },
  demoSectionTitle: { color: "#E9D5FF", fontWeight: "900", fontSize: 14, marginBottom: 10 },
  demoSectionLine: { color: "#94A3B8", fontSize: 12, lineHeight: 19, marginTop: 6 },
  demoBonusCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: "rgba(15,23,42,0.65)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
  },
  demoBonusTitle: { color: "#FDE68A", fontWeight: "900", fontSize: 15 },
  demoBonusSub: { color: "#94A3B8", fontSize: 11, marginTop: 6, lineHeight: 16 },
  demoBonusEm: { color: "#FBBF24", fontWeight: "800" },
  bonusTable: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    borderRadius: radius.md,
    overflow: "hidden",
  },
  bonusHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.85)",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.2)",
  },
  bonusDataRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(51,65,85,0.45)",
    backgroundColor: "rgba(15,23,42,0.35)",
  },
  bonusDataRowLast: { borderBottomWidth: 0 },
  bonusTh: { color: "#FDE68A", fontWeight: "800", fontSize: 10 },
  bonusTd: { color: "#E2E8F0", fontSize: 11, lineHeight: 15 },
  bonusColRank: { width: 36, flexShrink: 0 },
  bonusColName: { flex: 1, minWidth: 0, paddingHorizontal: 6 },
  bonusColAmt: { width: 56, flexShrink: 0, textAlign: "right", fontWeight: "800" },
  bonusColStat: { width: 58, flexShrink: 0, textAlign: "right", fontSize: 10 },
  demoBonusFoot: { color: "#7C6F9E", fontSize: 10, marginTop: 12, lineHeight: 15 },
  podium: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 20, flexWrap: "wrap" },
  noPodium: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  pSlot: {
    width: 100,
    padding: 10,
    borderRadius: radius.lg,
    alignItems: "center",
    backgroundColor: "rgba(30,27,55,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
  },
  pGold: { borderColor: "rgba(250,204,21,0.6)" },
  pSilver: { borderColor: "rgba(226,232,240,0.5)" },
  pBronze: { borderColor: "rgba(180,83,9,0.5)" },
  pEmoji: { fontSize: 28 },
  pName: { color: "#FFF", fontWeight: "800", fontSize: 12, textAlign: "center", marginTop: 4 },
  pScore: { color: "#FBBF24", fontSize: 13, fontWeight: "900", marginTop: 4, textAlign: "center" },
  table: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.35)",
    borderRadius: radius.md,
    overflow: "hidden",
  },
  tableHeadRow: {
    flexDirection: "row",
    backgroundColor: "rgba(76,29,149,0.35)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167,139,250,0.25)",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(51,65,85,0.4)",
  },
  tableRowLast: { borderBottomWidth: 0 },
  th: { color: "#E9D5FF", fontWeight: "900", fontSize: 11 },
  thLeft: { flex: 1 },
  thRight: { flex: 1, textAlign: "right" },
  tdLabel: { flex: 1, color: "#94A3B8", fontSize: 12 },
  tdValue: { flex: 1, color: "#F1F5F9", fontSize: 12, fontWeight: "700", textAlign: "right" },
  tdValueCredited: { flex: 1, color: "#4ADE80", fontSize: 12, fontWeight: "800", textAlign: "right" },
  meCard: {
    marginTop: 22,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: "rgba(76,29,149,0.2)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.35)",
  },
  meTitle: { color: "#E9D5FF", fontWeight: "900" },
  meLine: { color: "#E2E8F0", marginTop: 6, lineHeight: 20 },
  credited: { color: "#4ADE80", fontWeight: "700", marginTop: 8 },
  creditedSoft: { color: "#94A3B8", fontWeight: "600", marginTop: 8, lineHeight: 20 },
  missBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: "rgba(15,23,42,0.55)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
  },
  missTitle: { color: "#A5B4FC", fontWeight: "700", fontSize: 12, marginBottom: 4 },
  missLine: { color: "#CBD5E1", fontSize: 11, lineHeight: 16, marginTop: 2 },
  noRewardBanner: {
    marginTop: 16,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: "rgba(30,27,55,0.9)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
  },
  noRewardTitle: { color: "#FDE68A", fontWeight: "800", lineHeight: 22 },
  noRewardSub: { color: "#94A3B8", fontSize: 12, marginTop: 8, lineHeight: 18 },
  demoFoot: { color: "#7C6F9E", fontSize: 11, marginTop: 12, lineHeight: 16 },
  rewardBox: { marginTop: 20, padding: 12, borderRadius: radius.md, backgroundColor: "rgba(15,23,42,0.6)" },
  rewardHead: { color: "#FDE68A", fontWeight: "800", marginBottom: 8 },
  miss: { color: "#FFF", padding: spacing.lg },
  link: { color: "#C4B5FD", paddingHorizontal: spacing.lg },
});
