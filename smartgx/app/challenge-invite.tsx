import React, { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../src/hooks/useAuth";
import { useGamificationStore } from "../src/store/gamificationStore";
import { useChallengeStore } from "../src/store/challengeStore";
import { MOCK_SMARTGX_USERS } from "../src/data/mockSmartGXUsers";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";
import { radius } from "../src/theme/radius";
import type { ChallengeDurationDays } from "../src/types/challenge";
import { rewardConfigForDuration } from "../src/features/challenge/challenge.engine";
import { formatRM } from "../src/lib/currency";

type PickFriend = { userId: string; displayName: string };

export default function ChallengeInviteScreen() {
  const params = useLocalSearchParams<{ days?: string | string[] }>();
  const daysStr =
    params.days != null ? (Array.isArray(params.days) ? params.days[0] : params.days) : "";
  const daysParsed = Number.parseInt(String(daysStr), 10);
  const days = daysParsed as ChallengeDurationDays;
  const { currentUser } = useAuth();
  const friends = useGamificationStore((s) => s.friends);
  const createAndStart = useChallengeStore((s) => s.createAndStartChallenge);

  const pool = useMemo<PickFriend[]>(() => {
    const self = currentUser?.id;
    let list: PickFriend[] =
      friends.length > 0
        ? friends.map((f) => ({ userId: f.id, displayName: f.name }))
        : MOCK_SMARTGX_USERS.map((u) => ({ userId: u.id, displayName: u.name }));
    if (self) list = list.filter((p) => p.userId !== self);
    if (list.length === 0) {
      list = MOCK_SMARTGX_USERS.map((u) => ({ userId: u.id, displayName: u.name })).filter((p) => p.userId !== self);
    }
    return list;
  }, [friends, currentUser?.id]);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [startError, setStartError] = useState<string | null>(null);

  const durationOk =
    (days === 7 || days === 14 || days === 30) && !Number.isNaN(daysParsed);
  const selectedList = useMemo(() => pool.filter((p) => selected[p.userId]), [pool, selected]);
  const canStart = durationOk && currentUser?.id && selectedList.length >= 1;
  const cfg = durationOk ? rewardConfigForDuration(days) : null;

  const toggle = (id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };

  const start = () => {
    if (!currentUser?.id || !durationOk) return;
    setStartError(null);
    const res = createAndStart({
      creatorId: currentUser.id,
      creatorName: currentUser.fullName ?? "You",
      durationDays: days,
      invited: selectedList.map((p) => ({ userId: p.userId, displayName: p.displayName })),
    });
    if (!res.ok) {
      setStartError(res.reason ?? "Could not start challenge.");
      return;
    }
    if (res.challengeId) {
      router.replace(`/challenge-garden?id=${encodeURIComponent(res.challengeId)}` as never);
    }
  };

  if (!durationOk) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={s.err}>Invalid challenge duration.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={s.link}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18L9 12L15 6" stroke="#C4B5FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text style={s.title}>Invite friends</Text>
        </View>
        <Text style={s.sub}>
          {days}-Day Challenge · Rewards: 1st {formatRM(cfg!.tiers[0].amountRm)} · 2nd {formatRM(cfg!.tiers[1].amountRm)} ·
          3rd {formatRM(cfg!.tiers[2].amountRm)}
        </Text>
        <Text style={s.count}>Selected: {selectedList.length} (you + friends)</Text>
        <Text style={s.hintMuted}>
          Invited friends are treated as accepted for this prototype. Minimum 2 total participants including you.
        </Text>

        {pool.map((p) => (
          <Pressable
            key={p.userId}
            style={[s.row, selected[p.userId] && s.rowOn]}
            onPress={() => toggle(p.userId)}
          >
            <View style={[s.dot, selected[p.userId] && s.dotOn]} />
            <Text style={s.name}>{p.displayName}</Text>
          </Pressable>
        ))}

        {!canStart ? (
          <Text style={s.warn}>Invite at least one friend to start a challenge.</Text>
        ) : null}
        {startError ? <Text style={s.warn}>{startError}</Text> : null}

        <Pressable style={[s.cta, !canStart && s.ctaDisabled]} onPress={start} disabled={!canStart}>
          <Text style={s.ctaText}>Start Challenge</Text>
        </Pressable>
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
  sub: { color: "#BDB1DE", marginTop: 10, lineHeight: 18 },
  count: { color: "#FDE68A", fontWeight: "800", marginTop: 14 },
  hintMuted: { color: "#7C6F9E", fontSize: 11, marginTop: 6, lineHeight: 15 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.25)",
    marginTop: 8,
    backgroundColor: "rgba(28,21,47,0.6)",
  },
  rowOn: { borderColor: "rgba(250,204,21,0.5)", backgroundColor: "rgba(120,80,20,0.15)" },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#64748B",
  },
  dotOn: { backgroundColor: "#FBBF24", borderColor: "#FBBF24" },
  name: { color: "#F8FAFC", fontWeight: "700", fontSize: typography.body },
  warn: { color: "#FCA5A5", marginTop: 16, fontWeight: "600" },
  cta: {
    marginTop: 22,
    backgroundColor: "#7C3AED",
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: "#FFF", fontWeight: "900", fontSize: 16 },
  err: { color: "#FFF", padding: spacing.lg },
  link: { color: "#C4B5FD", paddingHorizontal: spacing.lg },
});
