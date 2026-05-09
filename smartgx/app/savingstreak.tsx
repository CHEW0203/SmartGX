import React, { useMemo, useState } from "react";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useGamificationStore } from "../src/store/gamificationStore";
import { useSavingsStore } from "../src/store/savingsStore";
import { useNotificationStore } from "../src/store/notificationStore";
import { useActivityStore } from "../src/store/activityStore";
import { formatRM } from "../src/lib/currency";
import { colors } from "../src/theme/colors";

const MILESTONES = [
  { id: "streak-3", label: "3-day streak", reward: 1 },
  { id: "streak-7", label: "7-day streak", reward: 3 },
  { id: "streak-14", label: "14-day streak", reward: 8 },
  { id: "streak-30", label: "30-day streak", reward: 20 },
  { id: "save-100", label: "Save RM100 this month", reward: 2 },
  { id: "save-300", label: "Save RM300 this month", reward: 5 },
  { id: "save-500", label: "Save RM500 this month", reward: 10 },
];

function getMonthDays(ref: Date) {
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const days = [];
  for (let i = 1; i <= end.getDate(); i += 1) {
    const d = new Date(year, month, i);
    days.push({
      day: i,
      dateKey: d.toISOString().slice(0, 10),
      isToday: d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10),
      weekday: d.getDay(),
    });
  }
  return { days, startsOn: start.getDay() };
}

const CARD_MARGIN_H = 16;
const CARD_PADDING_H = 12;
const CAL_GAP = 6;

export default function SavingStreakScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const calendarInnerWidth = windowWidth - CARD_MARGIN_H * 2 - CARD_PADDING_H * 2;
  const dayCellSize = Math.max(28, Math.floor((calendarInnerWidth - CAL_GAP * 6) / 7));

  const [monthRef, setMonthRef] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const gamify = useGamificationStore();
  const gamifyStreak = useGamificationStore((s) => s.currentStreak);
  const gamifyAutoCreditedKey = useGamificationStore((s) => s.autoCreditedStreakMilestones.join(","));
  const manualSaveBonus = useSavingsStore((s) => s.manualSave);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const addActivity = useActivityStore((s) => s.addActivity);
  const activityList = useActivityStore((s) => s.activities);
  const monthData = useMemo(() => getMonthDays(monthRef), [monthRef]);

  const selectedAmount = selectedDate ? gamify.savedByDate[selectedDate] ?? 0 : 0;

  const saveSources = useMemo(() => {
    if (!selectedDate) return [];
    const acts = activityList.filter((a) => a.timestamp.slice(0, 10) === selectedDate);
    return acts
      .filter((a) => ["manual_save", "auto_allocation", "round_up_saving", "save_instead"].includes(a.type))
      .map((a) => a.title);
  }, [selectedDate, activityList]);

  React.useEffect(() => {
    const auto = useGamificationStore.getState().autoCreditStreakMilestones();
    if (auto.length === 0) return;
    for (const m of auto) {
      manualSaveBonus("bonus", m.bonus);
      addNotification({
        id: `reward-auto-${m.id}-${Date.now()}`,
        title: "Streak Reward Credited",
        message: `${formatRM(m.bonus)} credited to Bonus automatically.`,
        time: "Just now",
        read: false,
        type: "info",
      });
      addActivity({
        id: `act-reward-auto-${m.id}-${Date.now()}`,
        type: "streak_milestone_reward",
        title: "Streak Reward Credited",
        description: `${formatRM(m.bonus)} added to Bonus`,
        amount: m.bonus,
        direction: "credit",
        timestamp: new Date().toISOString(),
        route: "/savings",
      });
    }
  }, [gamifyStreak, gamifyAutoCreditedKey, manualSaveBonus, addNotification, addActivity]);

  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#3C1B88", "#28125E", "#140A32"]} style={s.hero}>
          <View style={s.heroTop}>
            <Pressable onPress={() => router.push("/dashboard" as never)}>
              <View style={s.backBtn}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M15 18L9 12L15 6" stroke="#C4B5FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
            </Pressable>
            <Text style={s.title}>Saving Streak</Text>
          </View>
          <Text style={s.streakNum}>{gamify.currentStreak}</Text>
          <Text style={s.streakLabel}>day streak</Text>
          <View style={s.statsRow}>
            <View style={s.statCard}><Text style={s.statK}>Longest Streak</Text><Text style={s.statV}>{gamify.longestStreak} days</Text></View>
            <View style={s.statCard}><Text style={s.statK}>Saved This Month</Text><Text style={s.statV}>{formatRM(gamify.monthlySavedAmount)}</Text></View>
          </View>
        </LinearGradient>

        <View style={s.card}>
          <View style={s.monthRow}>
            <Pressable onPress={() => setMonthRef(new Date(monthRef.getFullYear(), monthRef.getMonth() - 1, 1))}><Text style={s.monthBtn}>{"<"}</Text></Pressable>
            <Text style={s.monthLabel}>{monthRef.toLocaleString("en-MY", { month: "long", year: "numeric" })}</Text>
            <Pressable onPress={() => setMonthRef(new Date(monthRef.getFullYear(), monthRef.getMonth() + 1, 1))}><Text style={s.monthBtn}>{">"}</Text></Pressable>
          </View>
          <View style={[s.calendarGrid, { gap: CAL_GAP }]}>
            {Array.from({ length: monthData.startsOn }).map((_, i) => (
              <View key={`x-${i}`} style={[s.dayEmpty, { width: dayCellSize, height: dayCellSize }]} />
            ))}
            {monthData.days.map((d) => {
              const saved = (gamify.savedByDate[d.dateKey] ?? 0) >= 1;
              const selected = selectedDate === d.dateKey;
              return (
                <Pressable
                  key={d.dateKey}
                  style={[
                    s.day,
                    { width: dayCellSize, height: dayCellSize },
                    saved && s.daySaved,
                    d.isToday && s.dayToday,
                    selected && s.daySelected,
                  ]}
                  onPress={() => setSelectedDate(d.dateKey)}
                >
                  <Text style={s.dayText} allowFontScaling={false}>
                    {d.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.cta}>{gamify.todayCompleted ? "Completed today" : "Save today to keep your streak alive"}</Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>Day Details</Text>
          {!selectedDate ? <Text style={s.rowSub}>Select a day to view saving details.</Text> : (
            <View style={{ gap: 6 }}>
              <Text style={s.rowTitle}>{selectedDate}</Text>
              <Text style={s.rowSub}>Total saved: {formatRM(selectedAmount)}</Text>
              <Text style={s.rowSub}>Streak day: {selectedAmount >= 1 ? "Completed" : "Not completed"}</Text>
              {saveSources.map((src, idx) => <Text key={`${src}-${idx}`} style={s.source}>- {src}</Text>)}
            </View>
          )}
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>Upcoming Rewards</Text>
          {MILESTONES.map((m) => {
            const claimed = gamify.streakMilestonesClaimed.includes(m.id);
            const target = Number(m.id.split("-")[1]);
            const remain = Number.isFinite(target) ? Math.max(0, target - gamify.currentStreak) : 0;
            return (
              <View key={m.id} style={s.row}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={s.rowTitle}>{m.label}</Text>
                  <Text style={s.rowSub}>
                    {claimed
                      ? `Reward ${formatRM(m.reward)} credited`
                      : `Keep going: ${remain} more day${remain === 1 ? "" : "s"} to unlock ${formatRM(m.reward)} Bonus Reward.`}
                  </Text>
                </View>
                <Text style={claimed ? s.donePill : s.pendingPill}>{claimed ? "Auto Credited" : "In Progress"}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 120 },
  hero: { padding: 16, gap: 10 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backBtn: { padding: 2 },
  title: { color: "#F3F4F6", fontWeight: "800", fontSize: 18 },
  streakNum: { color: "#FFF", fontSize: 46, fontWeight: "900", textAlign: "center", marginTop: 8 },
  streakLabel: { color: "#C4B5FD", textAlign: "center", fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  statCard: { flex: 1, borderWidth: 1, borderColor: "rgba(196,181,253,0.35)", borderRadius: 14, padding: 10, backgroundColor: "rgba(27,17,56,0.5)" },
  statK: { color: "#B8A8EB", fontSize: 12 },
  statV: { color: "#FFF", fontWeight: "800", marginTop: 4 },
  card: { marginTop: 14, marginHorizontal: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12, backgroundColor: colors.surface },
  monthRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  monthBtn: { color: "#C4B5FD", fontWeight: "800", fontSize: 18, paddingHorizontal: 10, paddingVertical: 4 },
  monthLabel: { color: "#FFF", fontWeight: "700" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  dayEmpty: { width: "12%", aspectRatio: 1 },
  day: { width: "12%", aspectRatio: 1, borderRadius: 10, borderWidth: 1, borderColor: "#3A2A67", alignItems: "center", justifyContent: "center", backgroundColor: "#161029" },
  daySaved: { borderColor: "#22D3EE", backgroundColor: "rgba(34,211,238,0.16)" },
  dayToday: { borderColor: "#A78BFA" },
  daySelected: { borderColor: "#F59E0B" },
  dayText: {
    color: "#E5E7EB",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
    width: "100%",
    lineHeight: 13,
    transform: [{ translateX: 1 }],
  },
  cta: { color: "#A78BFA", marginTop: 10, fontWeight: "700", textAlign: "center" },
  sectionTitle: { color: "#FFF", fontWeight: "800", marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTitle: { color: "#FFF", fontWeight: "700" },
  rowSub: { color: "#AFA4CF", fontSize: 12 },
  donePill: { color: "#22C55E", fontSize: 11, fontWeight: "800" },
  pendingPill: { color: "#FBBF24", fontSize: 11, fontWeight: "800" },
  source: { color: "#C4B5FD", fontSize: 12 },
});

