import React, { useState } from "react";
import { Redirect, router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { computeSecurityScore } from "../src/features/security/securityScore";
import { useAuth } from "../src/hooks/useAuth";
import { useHealthData } from "../src/hooks/useHealthData";
import { useGamificationStore } from "../src/store/gamificationStore";
import { useSecurityStore } from "../src/store/securityStore";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";

export default function ProfileScreen() {
  const { currentUser, logout } = useAuth();
  const health = useHealthData();
  const streak = useGamificationStore((s) => s.currentStreak);
  const smartScore = useGamificationStore((s) => s.smartScore);
  const deviceTrusted = useSecurityStore((s) => s.deviceTrusted);
  const emergencyLock = useSecurityStore((s) => s.emergencyLock);
  const [prefsNotif, setPrefsNotif] = useState(true);

  if (!currentUser) return <Redirect href="/auth/login" />;

  const secScore = computeSecurityScore(currentUser, useSecurityStore.getState());
  const initial = (currentUser.fullName ?? "U").trim().charAt(0).toUpperCase();
  const pinOk = Boolean(currentUser.passcode && currentUser.passcode.length === 6);

  const onLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Pressable style={s.backBtn} onPress={() => router.push("/dashboard" as never)}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18L9 12L15 6" stroke="#A78BFA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={s.backBtnText}>Home</Text>
        </Pressable>

        <View style={s.headerCard}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{initial}</Text></View>
          <Text style={s.name}>{currentUser.fullName}</Text>
          <Text style={s.meta}>SmartGX ID · {currentUser.id}</Text>
          <View style={s.previewRow}>
            <View style={s.previewPill}><Text style={s.previewPillTxt}>GXHealth {health.score}</Text></View>
            <View style={s.previewPill}><Text style={s.previewPillTxt}>SmartScore {smartScore}</Text></View>
            <View style={s.previewPill}><Text style={s.previewPillTxt}>Streak {streak}d</Text></View>
            <View style={s.previewPill}><Text style={s.previewPillTxt}>Security {secScore.score}</Text></View>
          </View>
        </View>

        <Section title="Personal information">
          <Row label="Mobile" value={currentUser.mobileNumber} />
          <Row label="Email" value={currentUser.email} />
          <Row label="Nationality" value={currentUser.nationality} />
          <Row label="MyKad status" value={formatVer(currentUser.identityVerificationStatus)} />
          <Row label="Selfie" value={formatVer(currentUser.selfieVerificationStatus)} />
        </Section>

        <Section title="Account information">
          <Row label="Account number" value="1234 5678 9012" />
          <Row label="Account status" value={formatVer(currentUser.accountActivationStatus)} />
          <Row label="DuitNow ID" value={currentUser.mobileNumber} />
          <Row label="Member since" value="2026" />
        </Section>

        <Section title="Security">
          <Row label="Security score" value={`${secScore.score} · ${secScore.status}`} />
          <Row label="PIN" value={pinOk ? "Active" : "Not set"} />
          <Row label="Device trust" value={deviceTrusted ? "Trusted" : "Review"} />
          <Row label="Emergency Lock" value={emergencyLock ? "On" : "Off"} />
          <Pressable style={s.cta} onPress={() => router.push("/security" as never)}>
            <Text style={s.ctaText}>Open Security Center</Text>
          </Pressable>
        </Section>

        <Section title="Preferences">
          <View style={s.prefRow}>
            <Text style={s.prefLabel}>Push insights & alerts</Text>
            <Switch value={prefsNotif} onValueChange={setPrefsNotif} trackColor={{ false: "#3A2A67", true: "#7C3AED" }} />
          </View>
          <Text style={s.hint}>Dark theme follows your device settings.</Text>
        </Section>

        <Section title="Help">
          <Pressable style={s.linkRow} onPress={() => router.push("/chatnow" as never)}>
            <Text style={s.linkText}>ChatNow & FAQ</Text>
          </Pressable>
          <Pressable style={s.linkRow} onPress={() => router.push("/notifications" as never)}>
            <Text style={s.linkText}>Notifications</Text>
          </Pressable>
        </Section>

        <Pressable style={s.logout} onPress={onLogout}>
          <Text style={s.logoutTxt}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowVal}>{value}</Text>
    </View>
  );
}

function formatVer(v: string) {
  return v.replace(/_/g, " ");
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 100, gap: spacing.md },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 4 },
  backBtnText: { color: "#A78BFA", fontSize: 14, fontWeight: "600" },
  headerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(124,58,237,0.35)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.4)",
  },
  avatarTxt: { color: "#FFF", fontSize: 28, fontWeight: "900" },
  name: { color: colors.textPrimary, fontSize: typography.subheading, fontWeight: "800" },
  meta: { color: colors.textMuted, fontSize: typography.caption },
  previewRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 8 },
  previewPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: "rgba(34,211,238,0.12)", borderWidth: 1, borderColor: "rgba(34,211,238,0.35)" },
  previewPillTxt: { color: "#22D3EE", fontSize: 10, fontWeight: "800" },
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: 4 },
  sectionTitle: { color: colors.textPrimary, fontWeight: "800", fontSize: typography.subheading, marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { color: colors.textSecondary, flex: 1 },
  rowVal: { color: colors.textPrimary, fontWeight: "600", flex: 1, textAlign: "right" },
  cta: { marginTop: 8, backgroundColor: "#7C3AED", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  ctaText: { color: "#FFF", fontWeight: "800" },
  prefRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  prefLabel: { color: colors.textPrimary, fontWeight: "600" },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  linkRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  linkText: { color: "#38BDF8", fontWeight: "700" },
  logout: { borderRadius: 12, borderWidth: 1, borderColor: "rgba(248,113,113,0.5)", paddingVertical: 14, alignItems: "center", marginTop: 8 },
  logoutTxt: { color: "#F87171", fontWeight: "800" },
});
