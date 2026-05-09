import React, { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { MOCK_SMARTGX_USERS } from "../src/data/mockSmartGXUsers";
import { useAuthStore } from "../src/store/authStore";
import { useGamificationStore } from "../src/store/gamificationStore";
import { useNotificationStore } from "../src/store/notificationStore";
import { useActivityStore } from "../src/store/activityStore";
import { useHealthData } from "../src/hooks/useHealthData";
import { colors } from "../src/theme/colors";
import { normalizeScore, normalizeSmartScore, safeNumber } from "../src/lib/number";
import { explainLeaderboardMove, explainSmartScoreBlurb } from "../src/features/ai/gamification.ai";

type RankRow = {
  id: string;
  name: string;
  smartScore: number;
  streak: number;
  gxHealth: number;
  movement: number;
  badge: string;
  rank: number;
};

export default function LeaderboardScreen() {
  const gamify = useGamificationStore();
  const notifications = useNotificationStore();
  const activity = useActivityStore();
  const health = useHealthData();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [smartScoreAiBlurb, setSmartScoreAiBlurb] = useState<string | null>(null);
  const [rankMomentumLine, setRankMomentumLine] = useState<string | null>(null);

  const displayName = currentUser?.fullName?.trim().split(/\s+/)[0] ?? "You";
  const myHealthScore = normalizeScore(health.score, 70);
  const mySmartScore = normalizeSmartScore(gamify.smartScore, 420);

  const rows = useMemo((): RankRow[] => {
    const byId = new Map<string, Omit<RankRow, "rank">>();

    const push = (r: Omit<RankRow, "rank">) => {
      if (byId.has(r.id)) return;
      byId.set(r.id, r);
    };

    push({
      id: "me",
      name: displayName,
      smartScore: mySmartScore,
      streak: Math.max(0, safeNumber(gamify.currentStreak, 0)),
      gxHealth: myHealthScore,
      movement: safeNumber(gamify.rankMovement, 0),
      badge: gamify.currentStreak >= 7 ? "Streak Pro" : "Starter",
    });

    for (const u of MOCK_SMARTGX_USERS) {
      push({
        id: u.id,
        name: u.name,
        smartScore: normalizeSmartScore(u.smartScore, 420),
        gxHealth: normalizeScore(u.gxHealth, 70),
        streak: Math.max(0, safeNumber(u.streak, 0)),
        movement: 0,
        badge: u.streak >= 7 ? "Disciplined" : "Rising",
      });
    }

    for (const f of gamify.friends) {
      push({
        id: f.id,
        name: f.name,
        smartScore: normalizeSmartScore(f.smartScore, 420),
        gxHealth: normalizeScore(f.gxHealth, 70),
        streak: Math.max(0, safeNumber(f.streak, 0)),
        movement: 0,
        badge: f.streak >= 7 ? "Disciplined" : "Rising",
      });
    }

    const sorted = [...byId.values()].sort((a, b) => b.smartScore - a.smartScore);
    return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [mySmartScore, gamify.currentStreak, gamify.rankMovement, gamify.friends, myHealthScore, displayName]);

  const myRank = rows.find((r) => r.id === "me")?.rank ?? 1;

  const missionProgressDigest = useMemo(() => {
    const m = gamify.missions;
    return `${m.length}:${m.filter((x) => x.completed).length}:${m.map((x) => x.status).join(",")}`;
  }, [gamify.missions]);

  useEffect(() => {
    let cancelled = false;
    const missionsDone = gamify.missions.filter((m) => m.completed).length;
    const missionsTotal = gamify.missions.length;
    (async () => {
      const blurb = await explainSmartScoreBlurb({
        smartScore: mySmartScore,
        streak: Math.max(0, safeNumber(gamify.currentStreak, 0)),
        gxHealth: myHealthScore,
        missionsDone,
        missionsTotal,
        rankMovement: safeNumber(gamify.rankMovement, 0),
      });
      if (!cancelled) setSmartScoreAiBlurb(blurb);
    })();
    return () => {
      cancelled = true;
    };
  }, [mySmartScore, gamify.currentStreak, myHealthScore, gamify.rankMovement, missionProgressDigest]);

  useEffect(() => {
    let cancelled = false;
    const completedMissions = gamify.missions.filter((m) => m.completed).length;
    (async () => {
      const line = await explainLeaderboardMove({
        movement: safeNumber(gamify.rankMovement, 0),
        completedMissions,
        streak: Math.max(0, safeNumber(gamify.currentStreak, 0)),
      });
      if (!cancelled) setRankMomentumLine(line);
    })();
    return () => {
      cancelled = true;
    };
  }, [gamify.rankMovement, gamify.currentStreak, missionProgressDigest]);

  const addFriend = () => {
    const res = gamify.addFriendByContact(contact.trim());
    if (!res.ok || !res.friend) {
      setMessage(res.reason ?? "Unable to add friend.");
      return;
    }
    setMessage(`${res.friend.name} added to leaderboard.`);
    setContact("");
    notifications.addNotification({
      id: `friend-${Date.now()}`,
      title: "Friend Added",
      message: `${res.friend.name} is now in your SmartGX leaderboard.`,
      time: "Just now",
      read: false,
      type: "info",
    });
    activity.addActivity({
      id: `act-friend-${Date.now()}`,
      type: "friend_added",
      title: "Friend Added",
      description: `${res.friend.name} joined your leaderboard`,
      timestamp: new Date().toISOString(),
      route: "/leaderboard",
    });
  };

  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator>
        <LinearGradient colors={["rgba(124,58,237,0.4)", "rgba(76,29,149,0.18)", "rgba(20,15,35,0.5)"]} style={s.hero}>
          <View style={s.rowTop}>
            <Pressable style={s.backBtn} onPress={() => router.push("/dashboard" as never)}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M15 18L9 12L15 6" stroke="#C4B5FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
            <Text style={s.title}>SmartScore</Text>
          </View>
          <View style={s.myRankCard}>
            <Text style={s.myRankTitle}>My Rank</Text>
            <Text style={s.myRankNum}>#{myRank}</Text>
            <Text style={s.myRankMeta}>SmartScore {mySmartScore} · Streak {Math.max(0, safeNumber(gamify.currentStreak, 0))} · GXHealth {myHealthScore}</Text>
            <Text style={s.sub}>
              {rankMomentumLine ??
                (gamify.rankMovement > 0 ? "Moving up" : gamify.rankMovement < 0 ? "Slight dip" : "Stable this cycle")}
            </Text>
          </View>
        </LinearGradient>

        <View style={s.card}>
          <Text style={s.cardTitle}>Top 3</Text>
          <View style={s.podiumRow}>
            {rows.slice(0, 3).map((r, idx) => (
              <View key={r.id} style={[s.podiumCard, idx === 0 ? s.podiumFirst : idx === 1 ? s.podiumSecond : s.podiumThird]}>
                <Text style={s.podiumRank}>#{r.rank}</Text>
                <Text style={s.podiumName} numberOfLines={1}>{r.name}</Text>
                <Text style={s.podiumPts}>{r.smartScore}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Add Friend by Contact</Text>
          <TextInput
            value={contact}
            onChangeText={setContact}
            placeholder="e.g. 0123456789"
            placeholderTextColor="#8B83A8"
            style={s.input}
            keyboardType="phone-pad"
          />
          <Pressable style={s.addBtn} onPress={addFriend}><Text style={s.addBtnText}>Add Friend</Text></Pressable>
          {message ? <Text style={s.msg}>{message}</Text> : null}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Full rankings</Text>
          <Text style={s.listHint}>Scroll to see everyone — you are always listed below.</Text>
          {rows.map((r) => (
            <View key={r.id} style={[s.rankRow, r.id === "me" && s.rankRowMe]}>
              <Text style={s.rank}>#{r.rank}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{r.name}{r.id === "me" ? " · You" : ""}</Text>
                <Text style={s.meta}>Streak {r.streak} · GXHealth {r.gxHealth} · {r.badge}</Text>
              </View>
              <Text style={s.points}>{r.smartScore}</Text>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>How SmartScore works</Text>
          <Text style={s.msg}>
            {smartScoreAiBlurb ??
              "SmartScore rewards consistent saving, mission completion, better GXHealth, responsible credit behaviour, and on-time repayment. It does not rank users by income or wealth."}
          </Text>
          <View style={{ marginTop: 8, gap: 4 }}>
            <Text style={s.meta}>GXHealth: {myHealthScore} (30%)</Text>
            <Text style={s.meta}>Saving streak: {Math.max(0, safeNumber(gamify.currentStreak, 0))} days (20%)</Text>
            <Text style={s.meta}>Missions completed: {gamify.missions.filter((m) => m.completed).length} / {gamify.missions.length} (20%)</Text>
            <Text style={s.meta}>Savings growth: Weighted (15%)</Text>
            <Text style={s.meta}>Debt behaviour: Weighted (10%)</Text>
            <Text style={s.meta}>Repayment behaviour: Weighted (5%)</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 110 },
  hero: { margin: 16, borderWidth: 1, borderColor: "rgba(196,181,253,0.35)", borderRadius: 18, padding: 14, backgroundColor: "rgba(22,16,41,0.45)" },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { padding: 2 },
  title: { color: "#FFF", fontWeight: "800", fontSize: 18 },
  myRankCard: { marginTop: 12, borderWidth: 1, borderColor: "rgba(196,181,253,0.35)", borderRadius: 14, padding: 10, backgroundColor: "rgba(18,14,30,0.55)" },
  myRankTitle: { color: "#C4B5FD", fontWeight: "700", fontSize: 11, textTransform: "uppercase" },
  myRankNum: { color: "#FFF", fontSize: 26, fontWeight: "900", marginTop: 3 },
  myRankMeta: { color: "#D8D0EE", fontSize: 12, marginTop: 2 },
  sub: { color: "#A78BFA", marginTop: 4, fontWeight: "700" },
  podiumRow: { flexDirection: "row", gap: 8 },
  podiumCard: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center", backgroundColor: "rgba(22,16,41,0.6)" },
  podiumFirst: { borderColor: "rgba(250,204,21,0.5)" },
  podiumSecond: { borderColor: "rgba(203,213,225,0.5)" },
  podiumThird: { borderColor: "rgba(251,146,60,0.5)" },
  podiumRank: { color: "#EDE9FE", fontWeight: "900" },
  podiumName: { color: "#FFF", fontWeight: "800", fontSize: 12, marginTop: 2 },
  podiumPts: { color: "#22D3EE", fontWeight: "900", marginTop: 2 },
  card: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: "rgba(124,58,237,0.3)", backgroundColor: "rgba(30,21,52,0.62)", padding: 12 },
  cardTitle: { color: "#FFF", fontWeight: "800", marginBottom: 8 },
  listHint: { color: "#8B83A8", fontSize: 11, marginBottom: 6 },
  input: { borderRadius: 12, borderWidth: 1, borderColor: "#3A2A67", backgroundColor: "#140F22", color: "#FFF", paddingHorizontal: 12, paddingVertical: 10 },
  addBtn: { marginTop: 10, backgroundColor: "#7C3AED", borderRadius: 12, paddingVertical: 11, alignItems: "center" },
  addBtnText: { color: "#FFF", fontWeight: "800" },
  msg: { color: "#C4B5FD", marginTop: 8, fontSize: 12 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.22)" },
  rankRowMe: { backgroundColor: "rgba(124,58,237,0.12)", marginHorizontal: -4, paddingHorizontal: 4, borderRadius: 8 },
  rank: { color: "#A78BFA", width: 34, fontWeight: "900" },
  name: { color: "#FFF", fontWeight: "800" },
  meta: { color: "#AEA2CB", fontSize: 12, marginTop: 2 },
  points: { color: "#22D3EE", fontWeight: "900" },
});
