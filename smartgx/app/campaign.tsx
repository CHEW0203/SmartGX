import React, { useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import type { CampaignItem } from "../src/store/gamificationStore";
import { useGamificationStore } from "../src/store/gamificationStore";
import { colors } from "../src/theme/colors";
import { formatRM } from "../src/lib/currency";

const CAMPAIGN_STATUS_LABEL: Record<CampaignItem["status"], string> = {
  not_started: "Not started",
  active: "Active",
  completed_reward_pending: "Completing reward",
  reward_credited: "Completed · reward credited",
  expired: "Expired",
};

export default function CampaignScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const campaigns = useGamificationStore((s) => s.campaigns);
  const campaign = useMemo(() => campaigns.find((c) => c.id === id) ?? campaigns[0], [campaigns, id]);

  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.push("/dashboard" as never)}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18L9 12L15 6" stroke="#C4B5FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text style={s.title}>Campaign</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>{campaign.title}</Text>
          <Text style={s.cardSub}>{campaign.description}</Text>
          <Text style={s.line}>Progress: {campaign.progress} / {campaign.target}</Text>
          <Text style={s.line}>Reward: {formatRM(campaign.rewardBonus)} + {campaign.rewardWater} water + {campaign.rewardPoints} SmartScore</Text>
          <Text style={s.line}>Status: {CAMPAIGN_STATUS_LABEL[campaign.status]}</Text>
          <Text style={s.line}>Time remaining: This month</Text>
          {campaign.status === "completed_reward_pending" ? (
            <View style={s.pendingBox}>
              <Text style={s.rowStrong}>Crediting your reward…</Text>
              <Text style={s.mutedSmall}>SmartGX will add water, points, and any Bonus amount automatically.</Text>
            </View>
          ) : null}
          {campaign.status === "reward_credited" ? (
            <View style={s.doneBox}>
              <Text style={s.rowStrong}>Reward credited</Text>
              <Text style={s.mutedSmall}>Check your Bonus pocket, water balance, and SmartScore on the dashboard.</Text>
            </View>
          ) : null}
        </View>

        <View style={s.actions}>
          <Pressable style={s.btn} onPress={() => router.push("/savings" as never)}><Text style={s.btnText}>Go to Saving</Text></Pressable>
          <Pressable style={s.btn} onPress={() => router.push("/missions" as never)}><Text style={s.btnText}>Go to Missions</Text></Pressable>
          <Pressable style={s.btn} onPress={() => router.push("/transactions" as never)}><Text style={s.btnText}>Transaction History</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 120 },
  header: { marginHorizontal: 16, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  backBtn: { padding: 2 },
  title: { color: "#FFF", fontSize: 22, fontWeight: "900" },
  card: { marginTop: 12, marginHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: "rgba(124,58,237,0.35)", backgroundColor: "rgba(28,21,47,0.7)", padding: 12, gap: 7 },
  cardTitle: { color: "#FFF", fontWeight: "900", fontSize: 17 },
  cardSub: { color: "#C7BDE4", fontSize: 13, lineHeight: 18 },
  line: { color: "#E2DBF3", fontSize: 12 },
  actions: { marginTop: 12, marginHorizontal: 16, gap: 10 },
  btn: { borderRadius: 10, minHeight: 42, alignItems: "center", justifyContent: "center", backgroundColor: "#7C3AED" },
  btnText: { color: "#FFF", fontWeight: "800" },
  pendingBox: { marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: "rgba(251,191,36,0.45)", padding: 10, gap: 4 },
  doneBox: { marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: "rgba(34,197,94,0.45)", padding: 10, gap: 4 },
  rowStrong: { color: "#FFF", fontWeight: "800", fontSize: 13 },
  mutedSmall: { color: "#AEA2CB", fontSize: 11, lineHeight: 16 },
});
