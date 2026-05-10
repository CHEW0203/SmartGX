import { LinearGradient } from "expo-linear-gradient";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { shouldShowProductGuide } from "../src/features/auth/auth.service";
import { useAuth } from "../src/hooks/useAuth";
import { radius } from "../src/theme/radius";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";

const PAGES = [
  {
    title: "Welcome to SmartGX",
    icon: "✨",
    bullets: [
      "What it is: SmartGX is an AI-powered financial resilience layer built on GXBank.",
      "How to start: Use dashboard quick actions and follow GXHealth guidance to build healthy habits.",
      "Save before spending. Think before borrowing. Stay protected before risk happens.",
    ],
  },
  {
    title: "Saving & Auto Allocation",
    icon: "💜",
    bullets: [
      "What it is: Income can be split automatically into Main Account, Bonus, Emergency, and Goals.",
      "How to use: When income is received, open Saving & Automation to view the allocation breakdown and monitor each pocket.",
    ],
  },
  {
    title: "Round-Up Saving",
    icon: "🔁",
    bullets: [
      "What it is: Small extra amounts from spending are rounded up into savings.",
      "How to use: Make a card or TapPay payment, then check Saving & Automation → Recent Activity to see the round-up added.",
      "Example: spend RM4.20 → round to RM5 → RM0.80 moves to your chosen pocket.",
    ],
  },
  {
    title: "GXHealth",
    icon: "💚",
    bullets: [
      "What it is: A real-time financial health score from Savings, Spending, Emergency, Debt Risk, and Security.",
      "How to use: Open GXHealth, see which factor drags the score, then read SmartGX Analysis and Recommended Action for next steps.",
    ],
  },
  {
    title: "SmartGX AI Nudge",
    icon: "🤖",
    bullets: [
      "What it is: SmartGX warns you before risky spending or borrowing.",
      "How to use: When a risky transaction appears, read the AI explanation, then continue, delay, save instead, or cancel.",
    ],
  },
  {
    title: "FlexiCredit Debt Readiness",
    icon: "📉",
    bullets: [
      "What it is: Helps you think before borrowing future money.",
      "How to use: Open FlexiCredit, complete the application flow, review Debt Readiness, and check repayment pressure before drawing credit.",
    ],
  },
  {
    title: "Security Center",
    icon: "🛡️",
    bullets: [
      "What it is: Protects your account with PIN, Device Safety Check, Scam Protection, and Emergency Lock.",
      "How to use: Open Security Center to review your Security Score, finish pending safety actions, and use Emergency Lock if something feels wrong.",
    ],
  },
  {
    title: "Money Tree & Water",
    icon: "🌳",
    bullets: [
      "What it is: Healthy financial actions earn water to grow your personal Money Tree.",
      "How to use: Go to Missions, complete daily missions, tap Claim to collect water, then use water to grow your tree.",
    ],
  },
  {
    title: "Challenge Garden, Leaderboard & Saving Streak",
    icon: "🏅",
    bullets: [
      "What it is: Social motivation and consistency tracking.",
      "How to use: Tap the yellow Challenge card under Money Tree to invite friends, complete Challenge Missions, and compete via Challenge SmartScore. Tap the fire icon for Saving Streak and the leaderboard icon for rankings.",
    ],
  },
  {
    title: "FAQ · Getting started",
    icon: "❓",
    bullets: [
      "Where do I see savings? → Saving & Automation.",
      "How do I earn water? → Complete missions and claim rewards.",
      "What happens when income is received? → It can be auto-allocated by your rule.",
      "Where do I ask questions? → SmartGX Assistant.",
      "Where do I review account safety? → Security Center.",
      "You are ready to start building financial resilience.",
    ],
  },
];

export default function OnboardingGuideScreen() {
  const { currentUser, markProductGuideCompleted } = useAuth();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const isReplay = replay === "1" || replay === "true";

  const [idx, setIdx] = useState(0);
  const total = PAGES.length;
  const page = PAGES[idx]!;

  const finish = useCallback(() => {
    if (!isReplay) markProductGuideCompleted();
    if (isReplay) router.back();
    else router.replace("/dashboard" as never);
  }, [isReplay, markProductGuideCompleted]);

  const onSkip = useCallback(() => {
    if (isReplay) router.back();
    else finish();
  }, [isReplay, finish]);

  if (!currentUser) return <Redirect href="/auth/login" />;
  if (!isReplay && !shouldShowProductGuide(currentUser)) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0529" />
      <LinearGradient colors={["#1A0845", "#0F0529", "#070B14"]} style={StyleSheet.absoluteFill} />
      <View style={styles.topBar}>
        <Pressable onPress={onSkip} hitSlop={12}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
        <Text style={styles.pageInd}>
          {idx + 1} / {total}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.icon}>{page.icon}</Text>
          <Text style={styles.title}>{page.title}</Text>
          {page.bullets.map((line, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.dot} />
              <Text style={styles.bullet}>{line}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.navBtn, styles.navGhost]}
          onPress={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
        >
          <Text style={[styles.navGhostText, idx === 0 && styles.navDisabled]}>Back</Text>
        </Pressable>
        {idx < total - 1 ? (
          <Pressable style={[styles.navBtn, styles.navPrimary]} onPress={() => setIdx((i) => Math.min(total - 1, i + 1))}>
            <Text style={styles.navPrimaryText}>Next</Text>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M9 18L15 12L9 6" stroke="#FFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        ) : (
          <Pressable style={[styles.navBtn, styles.navPrimary]} onPress={finish}>
            <Text style={styles.navPrimaryText}>Get Started</Text>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="#FFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0F0529" },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skip: { color: "#C4B5FD", fontWeight: "700", fontSize: 15 },
  pageInd: { color: "#A78BFA", fontWeight: "800", fontSize: 13 },
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.35)",
    backgroundColor: "rgba(76,29,149,0.22)",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  icon: { fontSize: 40, textAlign: "center", marginBottom: spacing.xs },
  title: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: "#A78BFA",
    marginTop: 8,
  },
  bullet: { flex: 1, color: "#E9D5FF", fontSize: typography.body, lineHeight: 22 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(15,5,41,0.94)",
    borderTopWidth: 1,
    borderTopColor: "rgba(124,58,237,0.25)",
  },
  navBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  navGhost: {
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.4)",
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  navGhostText: { color: "#E9D5FF", fontWeight: "800", fontSize: 15 },
  navDisabled: { opacity: 0.35 },
  navPrimary: { backgroundColor: "#7C3AED" },
  navPrimaryText: { color: "#FFF", fontWeight: "900", fontSize: 15 },
});
