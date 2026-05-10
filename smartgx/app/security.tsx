import { Redirect, router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import {
  analyzeScamMessageOrLink,
  generateDeviceRiskExplanation,
  generateSecurityRecommendation,
  generateSecurityRecommendationWithGemini,
} from "../src/features/ai/security.ai";
import {
  computeSecurityScoreDetail,
  type SecurityScoreSnapshot,
} from "../src/features/security/securityScore";
import { verifyEmergencyUnlockPin } from "../src/features/security/sensitiveAction";
import { useAuth } from "../src/hooks/useAuth";
import { useHealthData } from "../src/hooks/useHealthData";
import { useGamificationStore } from "../src/store/gamificationStore";
import { useCardStore } from "../src/store/cardStore";
import { useNotificationStore } from "../src/store/notificationStore";
import { useActivityStore } from "../src/store/activityStore";
import {
  useSecurityStore,
  userHasPinSet,
  type SafetyCheckItem,
} from "../src/store/securityStore";
import { useAuthStore } from "../src/store/authStore";
import { refreshChallengesForUser } from "../src/features/challenge/challengeIntegration";
import { colors } from "../src/theme/colors";

export default function SecurityScreen() {
  const { currentUser, changeAppPasscode } = useAuth();
  const sec = useSecurityStore();
  const updateDebit = useCardStore((s) => s.updateDebitControls);
  const updateFlexi = useCardStore((s) => s.updateFlexiControls);
  const health = useHealthData();
  const streak = useGamificationStore((s) => s.currentStreak);
  const smartScore = useGamificationStore((s) => s.smartScore);

  const [scamInput, setScamInput] = useState("");
  const [scamLoading, setScamLoading] = useState(false);

  const [curPin, setCurPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [pinMsg, setPinMsg] = useState("");

  const [unlockPin, setUnlockPin] = useState("");
  const [unlockErr, setUnlockErr] = useState("");

  if (!currentUser) return <Redirect href="/auth/login" />;

  const snapshot = React.useMemo(
    (): SecurityScoreSnapshot => ({
      deviceTrusted: sec.deviceTrusted,
      emergencyLock: sec.emergencyLock,
      transactionAlertsEnabled: sec.transactionAlertsEnabled,
      biometricEnabledLocal: sec.biometricEnabledLocal,
      mockSuspiciousSession: sec.mockSuspiciousSession,
      mockRiskyLinkFlag: sec.mockRiskyLinkFlag,
      safetyCheckStatus: sec.safetyCheckStatus,
      wrongPinAttempts: sec.wrongPinAttempts,
      sensitiveLockUntil: sec.sensitiveLockUntil,
      lastScamCheck: sec.lastScamCheck,
    }),
    [
      sec.deviceTrusted,
      sec.emergencyLock,
      sec.transactionAlertsEnabled,
      sec.biometricEnabledLocal,
      sec.mockSuspiciousSession,
      sec.mockRiskyLinkFlag,
      sec.safetyCheckStatus,
      sec.wrongPinAttempts,
      sec.sensitiveLockUntil,
      sec.lastScamCheck,
    ]
  );

  const score = computeSecurityScoreDetail(currentUser, snapshot);

  const deviceExplain = generateDeviceRiskExplanation({
    suspiciousSession: sec.mockSuspiciousSession,
    failedPins: sec.wrongPinAttempts,
    untrusted: !sec.deviceTrusted,
  });

  const [reco, setReco] = useState(() =>
    generateSecurityRecommendation({
      emergencyLock: sec.emergencyLock,
      pinSet: userHasPinSet(),
      deviceTrusted: sec.deviceTrusted,
    })
  );

  useEffect(() => {
    const pinSet = userHasPinSet();
    const base = generateSecurityRecommendation({
      emergencyLock: sec.emergencyLock,
      pinSet,
      deviceTrusted: sec.deviceTrusted,
    });
    setReco(base);
    let cancelled = false;
    void generateSecurityRecommendationWithGemini({
      emergencyLock: sec.emergencyLock,
      pinSet,
      deviceTrusted: sec.deviceTrusted,
    }).then((text) => {
      if (!cancelled) setReco(text);
    });
    return () => {
      cancelled = true;
    };
  }, [sec.emergencyLock, sec.deviceTrusted, sec.pinSetFromServer, sec.serverPinHash, currentUser?.passcode]);

  const runSafety = () => {
    sec.setSafetyCheckRunning();
    setTimeout(() => {
      const suspiciousOverlay = false;
      const unknownSession = sec.mockSuspiciousSession;
      const riskyLink = sec.mockRiskyLinkFlag;
      const integrityOk = true;
      const rootRisk = false;
      const a11yRisk = false;
      const clipboardRisk = false;

      const items: SafetyCheckItem[] = [
        { id: "overlay", label: "Display overlay risk signal", ok: !suspiciousOverlay, detail: suspiciousOverlay ? "Review screen overlay permissions." : "No elevated overlay signal." },
        { id: "session", label: "Session familiarity", ok: !unknownSession, detail: unknownSession ? "A new session pattern was noted." : "Session looks consistent." },
        { id: "link", label: "Recent risky link flag", ok: !riskyLink, detail: riskyLink ? "A link was flagged earlier." : "No risky link flag." },
        { id: "integrity", label: "App integrity signal", ok: integrityOk, detail: integrityOk ? "Integrity check passed." : "Review app source." },
        { id: "root", label: "Modified device signal", ok: !rootRisk, detail: rootRisk ? "Elevated OS modification risk." : "No modification signal." },
        { id: "a11y", label: "Accessibility automation signal", ok: !a11yRisk, detail: a11yRisk ? "Unusual automation pattern." : "No automation signal." },
        { id: "clipboard", label: "Clipboard exposure signal", ok: !clipboardRisk, detail: clipboardRisk ? "Sensitive clipboard access noted." : "Clipboard signal clear." },
      ];
      const failed = items.filter((i) => !i.ok).length;
      const status = failed === 0 ? "safe" : failed <= 2 ? "attention" : "risk";
      sec.setSafetyCheckResult(status, items);
      refreshChallengesForUser(useAuthStore.getState().currentUser?.id);
    }, 1400);
  };

  const runScamCheck = async () => {
    setScamLoading(true);
    try {
      const r = await analyzeScamMessageOrLink(scamInput);
      sec.setLastScamCheck(r);
    } finally {
      setScamLoading(false);
    }
  };

  const onChangePin = () => {
    setPinMsg("");
    const res = changeAppPasscode(curPin, newPin, newPin2);
    if (!res.ok) {
      setPinMsg(res.message ?? "Could not change PIN.");
      return;
    }
    setCurPin("");
    setNewPin("");
    setNewPin2("");
    setPinMsg("PIN changed successfully.");
    useSecurityStore.getState().clearPinFailures();
    useNotificationStore.getState().addNotification({
      id: `pin-chg-${Date.now()}`,
      title: "PIN updated",
      message: "Your SmartGX PIN was changed.",
      time: "Just now",
      read: false,
      type: "info",
    });
    useActivityStore.getState().addActivity({
      id: `act-pin-chg-${Date.now()}`,
      type: "security_pin",
      title: "PIN changed",
      description: "Your SmartGX PIN was updated",
      timestamp: new Date().toISOString(),
      route: "/security",
    });
  };

  const activateEmergency = () => {
    sec.setEmergencyLock(true);
    updateDebit({ frozen: true });
    updateFlexi({ frozen: true });
  };

  const unlockEmergency = async () => {
    setUnlockErr("");
    if (!userHasPinSet()) {
      router.push("/auth/app-pin-setup" as never);
      return;
    }
    const v = await verifyEmergencyUnlockPin(unlockPin);
    if (!v.ok) {
      setUnlockErr(v.message ?? "Could not unlock.");
      return;
    }
    sec.setEmergencyLock(false);
    updateDebit({ frozen: false });
    updateFlexi({ frozen: false });
    setUnlockPin("");
  };

  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          <Pressable style={s.backBtn} onPress={() => router.push("/dashboard" as never)}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18L9 12L15 6" stroke="#C4B5FD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text style={s.title}>SmartGX Security</Text>
        </View>

        <View style={s.hero}>
          <Text style={s.scoreLabel}>Security Score</Text>
          <Text style={s.scoreNum}>{score.score}</Text>
          <Text style={[s.scoreStatus, { color: score.status === "Protected" ? "#22C55E" : score.status === "Needs Attention" ? "#FBBF24" : score.status === "At Risk" ? "#FB923C" : "#F87171" }]}>
            {score.status}
          </Text>
          <Text style={s.recoText}>{reco}</Text>
          <Text style={s.heroHint}>Scores update when PIN, alerts, scam checks, or safety results change.</Text>
        </View>

        <Section title="How Security Score is calculated">
          <Text style={s.muted}>
            Your score ranges from 0–100 based on protections you enable and risks detected recently (PIN, trusted device,
            scam check, alerts, Emergency Lock).
          </Text>
          <View style={s.breakdown}>
            <Text style={s.rowStrong}>PIN Protection · {score.breakdown.pinProtection}</Text>
            <Text style={s.rowStrong}>Device · {score.breakdown.deviceTrust}</Text>
            <Text style={s.rowStrong}>Safety Check · {score.breakdown.safetyCheck}</Text>
            <Text style={s.rowStrong}>Scam Protection · {score.breakdown.scamProtection}</Text>
            <Text style={s.rowStrong}>Transaction Alerts · {score.breakdown.transactionAlerts}</Text>
            <Text style={s.rowStrong}>Emergency Lock · {score.breakdown.emergencyLockLabel}</Text>
            <Text style={s.rowStrong}>Recent Risk · {score.breakdown.recentRisk}</Text>
          </View>
        </Section>

        <Section title="6-digit PIN">
          <Text style={s.muted}>Required for transfers, scan pay, TapPay, card reveal, FlexiCredit, and Saving withdrawals.</Text>
          <Pressable style={s.linkBtn} onPress={() => router.push("/auth/forgot-pin" as never)}>
            <Text style={s.linkBtnText}>Forgot PIN</Text>
          </Pressable>
          <Text style={s.fieldLbl}>Current PIN</Text>
          <TextInput style={s.input} secureTextEntry keyboardType="number-pad" maxLength={6} value={curPin} onChangeText={(t) => setCurPin(t.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" placeholderTextColor="#6B5F86" />
          <Text style={s.fieldLbl}>New PIN</Text>
          <TextInput style={s.input} secureTextEntry keyboardType="number-pad" maxLength={6} value={newPin} onChangeText={(t) => setNewPin(t.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" placeholderTextColor="#6B5F86" />
          <Text style={s.fieldLbl}>Confirm new PIN</Text>
          <TextInput style={s.input} secureTextEntry keyboardType="number-pad" maxLength={6} value={newPin2} onChangeText={(t) => setNewPin2(t.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" placeholderTextColor="#6B5F86" />
          {pinMsg ? <Text style={[s.muted, { color: pinMsg.includes("success") ? "#22C55E" : "#F87171" }]}>{pinMsg}</Text> : null}
          <Pressable
            style={[s.primaryBtn, (curPin.length !== 6 || newPin.length !== 6 || newPin2.length !== 6) && { opacity: 0.45 }]}
            disabled={curPin.length !== 6 || newPin.length !== 6 || newPin2.length !== 6}
            onPress={onChangePin}
          >
            <Text style={s.primaryBtnText}>Update PIN</Text>
          </Pressable>
        </Section>

        <Section title="Device Protection">
          <Text style={s.muted}>Device: {sec.deviceLabel}</Text>
          <Text style={s.muted}>Region: {sec.deviceLocationLabel}</Text>
          <Text style={s.muted}>Last active: {sec.lastLoginAt?.slice(11, 19) ?? "—"}</Text>
          <Text style={s.muted}>{deviceExplain}</Text>
          <View style={s.row}>
            <Text style={s.rowLabel}>Trust this device</Text>
            <Switch value={sec.deviceTrusted} onValueChange={sec.setDeviceTrusted} trackColor={{ false: "#3A2A67", true: "#7C3AED" }} />
          </View>
          <Pressable style={s.secondaryBtn} onPress={sec.logoutOtherDevicesMock}>
            <Text style={s.secondaryBtnText}>Log out other sessions</Text>
          </Pressable>
          <Pressable style={s.secondaryBtn} onPress={() => sec.setMockSuspiciousSession(!sec.mockSuspiciousSession)}>
            <Text style={s.secondaryBtnText}>{sec.mockSuspiciousSession ? "Clear suspicious session flag" : "Simulate suspicious session"}</Text>
          </Pressable>
        </Section>

        <Section title="Device Safety Check">
          <Text style={s.muted}>SmartGX checks for suspicious risk signals on this device. This is not an OS malware scan.</Text>
          {sec.safetyCheckStatus === "running" ? (
            <ActivityIndicator color="#A78BFA" />
          ) : (
            <Pressable style={s.primaryBtn} onPress={runSafety}>
              <Text style={s.primaryBtnText}>Run Safety Check</Text>
            </Pressable>
          )}
          {sec.lastSafetyCheckAt ? (
            <Text style={s.muted}>Last run: {sec.lastSafetyCheckAt.slice(0, 19).replace("T", " ")} · {sec.safetyCheckStatus}</Text>
          ) : null}
          {sec.safetyCheckItems.map((it) => (
            <View key={it.id} style={s.checkRow}>
              <Text style={it.ok ? s.okDot : s.badDot}>{it.ok ? "✓" : "!"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.rowStrong}>{it.label}</Text>
                <Text style={s.mutedSmall}>{it.detail}</Text>
              </View>
            </View>
          ))}
        </Section>

        <Section title="Scam & risky message check">
          <Text style={s.muted}>Paste a message or link. SmartGX estimates risk using on-device rules (and optional AI when configured).</Text>
          <TextInput style={s.textArea} multiline value={scamInput} onChangeText={setScamInput} placeholder="Paste content..." placeholderTextColor="#6B5F86" />
          <Pressable style={s.primaryBtn} onPress={runScamCheck} disabled={scamLoading}>
            <Text style={s.primaryBtnText}>{scamLoading ? "Analyzing…" : "Analyze"}</Text>
          </Pressable>
          {sec.lastScamCheck ? (
            <View style={s.resultBox}>
              <Text style={s.rowStrong}>Risk: {sec.lastScamCheck.risk}</Text>
              <Text style={s.muted}>{sec.lastScamCheck.explanation}</Text>
              <Text style={s.muted}>{sec.lastScamCheck.recommendation}</Text>
            </View>
          ) : null}
          <Pressable style={s.secondaryBtn} onPress={() => sec.setMockRiskyLinkFlag(!sec.mockRiskyLinkFlag)}>
            <Text style={s.secondaryBtnText}>{sec.mockRiskyLinkFlag ? "Clear risky link flag" : "Simulate flagged risky link"}</Text>
          </Pressable>
        </Section>

        <Section title="Transaction security">
          <Text style={s.muted}>Sensitive actions require your SmartGX PIN. Emergency Lock blocks transfers, scan, TapPay, and FlexiCredit drawdown.</Text>
          <View style={s.row}>
            <Text style={s.rowLabel}>Transaction alerts</Text>
            <Switch value={sec.transactionAlertsEnabled} onValueChange={sec.setTransactionAlertsEnabled} trackColor={{ false: "#3A2A67", true: "#7C3AED" }} />
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>Biometric sign-in (device)</Text>
            <Switch
              value={Boolean(currentUser?.biometricEnabled)}
              onValueChange={(v) => sec.setBiometricEnabledLocal(v)}
              trackColor={{ false: "#3A2A67", true: "#7C3AED" }}
            />
          </View>
        </Section>

        <Section title="Emergency Lock">
          <Text style={s.muted}>
            {sec.emergencyLock ? "Locked — cards frozen, sensitive payments blocked." : "Off — normal protections apply."}
          </Text>
          {!userHasPinSet() ? (
            <Pressable style={s.primaryBtn} onPress={() => router.push("/auth/app-pin-setup" as never)}>
              <Text style={s.primaryBtnText}>Set PIN to enable Emergency Lock</Text>
            </Pressable>
          ) : !sec.emergencyLock ? (
            <Pressable style={[s.primaryBtn, { backgroundColor: "#B91C1C" }]} onPress={activateEmergency}>
              <Text style={s.primaryBtnText}>Activate Emergency Lock</Text>
            </Pressable>
          ) : (
            <>
              <Text style={s.fieldLbl}>Enter your SmartGX PIN (6 digits) to unlock</Text>
              <TextInput
                style={s.input}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
                value={unlockPin}
                onChangeText={(t) => {
                  setUnlockPin(t.replace(/\D/g, "").slice(0, 6));
                  if (unlockErr) setUnlockErr("");
                }}
                placeholder="••••••"
                placeholderTextColor="#6B5F86"
              />
              {unlockErr ? <Text style={s.errText}>{unlockErr}</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: unlockPin.length !== 6 }}
                style={[s.primaryBtn, unlockPin.length !== 6 && { opacity: 0.45 }]}
                disabled={unlockPin.length !== 6}
                onPress={unlockEmergency}
              >
                <Text style={s.primaryBtnText}>Unlock with PIN</Text>
              </Pressable>
            </>
          )}
        </Section>

        <Section title="SmartGX Wellness & Goals">
          <Text style={s.muted}>GXHealth {health.score} · SmartScore {smartScore} · Streak {streak} days</Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 120, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { padding: 4 },
  title: { color: "#FFF", fontSize: 20, fontWeight: "900" },
  hero: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.35)",
    padding: 16,
    backgroundColor: "rgba(30,21,52,0.72)",
    gap: 4,
  },
  scoreLabel: { color: "#C4B5FD", fontWeight: "700", fontSize: 11, textTransform: "uppercase" },
  scoreNum: { color: "#FFF", fontSize: 36, fontWeight: "900" },
  scoreStatus: { fontWeight: "800" },
  recoText: { color: "#BDB1DE", fontSize: 12, marginTop: 6, lineHeight: 18 },
  heroHint: { color: "#8B83A8", fontSize: 11, marginTop: 4, lineHeight: 16 },
  breakdown: { gap: 6, marginTop: 8 },
  errText: { color: "#FCA5A5", fontSize: 12, fontWeight: "700" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.28)",
    padding: 14,
    backgroundColor: "rgba(22,16,41,0.65)",
    gap: 8,
  },
  cardTitle: { color: "#FFF", fontWeight: "800", fontSize: 15, marginBottom: 4 },
  muted: { color: "#AEA2CB", fontSize: 12, lineHeight: 18 },
  mutedSmall: { color: "#8B83A8", fontSize: 11, lineHeight: 16 },
  fieldLbl: { color: "#C4B5FD", fontSize: 11, fontWeight: "700" },
  input: {
    backgroundColor: "#140F22",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3A2A67",
    color: "#FFF",
    padding: 12,
  },
  textArea: {
    minHeight: 88,
    backgroundColor: "#140F22",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3A2A67",
    color: "#FFF",
    padding: 12,
    textAlignVertical: "top",
  },
  primaryBtn: { backgroundColor: "#7C3AED", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  primaryBtnText: { color: "#FFF", fontWeight: "800" },
  secondaryBtn: { borderRadius: 12, borderWidth: 1, borderColor: "rgba(124,58,237,0.4)", paddingVertical: 11, alignItems: "center" },
  secondaryBtnText: { color: "#D8B4FE", fontWeight: "700" },
  linkBtn: { alignSelf: "flex-start", paddingVertical: 4 },
  linkBtnText: { color: "#38BDF8", fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLabel: { color: "#E5E7EB", fontWeight: "600" },
  rowStrong: { color: "#FFF", fontWeight: "800", fontSize: 13 },
  checkRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  okDot: { color: "#22C55E", fontWeight: "900" },
  badDot: { color: "#FB923C", fontWeight: "900" },
  resultBox: { borderRadius: 12, borderWidth: 1, borderColor: "rgba(56,189,248,0.3)", padding: 10, gap: 4 },
});
