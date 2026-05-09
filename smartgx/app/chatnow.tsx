import { useState, useRef, useEffect, useCallback } from "react";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { ASSISTANT_QUICK_FAQ, getAssistantReplyDetailed } from "../src/services/ai/assistant.service";
import { testSmartGxAiConnection } from "../src/services/ai/ai.client";
import { colors } from "../src/theme/colors";
import { radius } from "../src/theme/radius";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "Hello! I'm the SmartGX Assistant. Type a question below or tap a quick topic.",
  },
];

const TASKBAR_ABOVE_GAP = 48;

function messageFromCaught(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e != null && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Something went wrong. Try again.";
}

export default function ChatNowScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  /** Dev-only: last reply path (Gemini vs offline FAQ vs generic fallback). */
  const [devAiLabel, setDevAiLabel] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const footerPadBottom = TASKBAR_ABOVE_GAP + Math.max(insets.bottom, spacing.sm);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages, loading]);

  const runAssistant = useCallback(async (userText: string, prior: ChatMessage[]) => {
    const history = prior
      .filter((m) => m.id !== "welcome")
      .map((m) => ({
        role: m.role,
        content: m.text,
      }));
    return getAssistantReplyDetailed(userText, history);
  }, []);

  const runTestConnection = useCallback(async () => {
    setTestBusy(true);
    try {
      const r = await testSmartGxAiConnection();
      const title = r.headline;
      const msg =
        r.headline === "Connected to Gemini"
          ? `${r.detail}\n\n(Model: ${r.raw?.model ?? "—"} · provider: ${r.raw?.provider ?? "—"})`
          : r.detail;
      Alert.alert(title, msg);
    } catch (e) {
      Alert.alert("Error", messageFromCaught(e));
    } finally {
      setTestBusy(false);
    }
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || loading) return;
    setInputText("");
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    let snapshot: ChatMessage[] = [];
    setMessages((prev) => {
      snapshot = prev;
      return [...prev, userMsg];
    });
    setLoading(true);
    try {
      const { text, source } = await runAssistant(trimmed, snapshot);
      if (__DEV__) {
        setDevAiLabel(source === "gemini" ? "AI: Gemini" : "AI: Fallback");
      }
      setMessages((prev) => [...prev, { id: `b-${Date.now()}`, role: "assistant", text }]);
    } finally {
      setLoading(false);
    }
  }, [inputText, loading, runAssistant]);

  const handleQuickQuestion = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed || loading) return;
      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: trimmed };
      let snapshot: ChatMessage[] = [];
      setMessages((prev) => {
        snapshot = prev;
        return [...prev, userMsg];
      });
      setLoading(true);
      try {
        const { text, source } = await runAssistant(trimmed, snapshot);
        if (__DEV__) {
          setDevAiLabel(source === "gemini" ? "AI: Gemini" : "AI: Fallback");
        }
        setMessages((prev) => [...prev, { id: `b-${Date.now()}`, role: "assistant", text }]);
      } finally {
        setLoading(false);
      }
    },
    [loading, runAssistant]
  );

  const sendDisabled = loading || !inputText.trim();

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0529" />

      <LinearGradient
        colors={["#3B1578", "#2D0D6B", "#1A0845", "#070B14"]}
        locations={[0, 0.4, 0.75, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.hero}
      >
        <Pressable style={styles.backBtn} onPress={() => router.push("/dashboard" as never)}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18L9 12L15 6" stroke="#C4B5FD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.heroTitleRow}>
          <View style={styles.botDot} />
          <Text style={styles.heroTitle}>SmartGX Assistant</Text>
        </View>
        <Text style={styles.heroSub}>Ask anything about SmartGX</Text>
        {__DEV__ ? (
          <View style={styles.devRow}>
            {devAiLabel ? <Text style={styles.devPill}>{devAiLabel}</Text> : null}
            <Pressable
              style={[styles.testAiBtn, testBusy && { opacity: 0.55 }]}
              onPress={() => void runTestConnection()}
              disabled={testBusy}
            >
              <Text style={styles.testAiBtnText}>{testBusy ? "Testing…" : "Test AI Connection"}</Text>
            </Pressable>
          </View>
        ) : null}
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[styles.bubble, msg.role === "user" ? styles.userBubble : styles.botBubble]}
            >
              <Text style={[styles.bubbleText, msg.role === "user" ? styles.userBubbleText : styles.botBubbleText]}>
                {msg.text}
              </Text>
            </View>
          ))}
          {loading ? (
            <View style={[styles.bubble, styles.botBubble, styles.typingBubble]}>
              <ActivityIndicator color="#A78BFA" size="small" />
              <Text style={styles.typingText}>Thinking…</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: footerPadBottom }]}>
          <Text style={styles.faqLabel}>Quick questions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.faqChips}>
            {ASSISTANT_QUICK_FAQ.map((item, i) => (
              <Pressable
                key={`${item.q}-${i}`}
                style={[styles.faqChip, loading && { opacity: 0.5 }]}
                onPress={() => void handleQuickQuestion(item.q)}
                disabled={loading}
              >
                <Text style={styles.faqChipText} numberOfLines={2}>
                  {item.q}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Ask SmartGX…"
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              editable={!loading}
              multiline
              maxLength={2000}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={() => void handleSend()}
            />
            <Pressable
              style={[styles.sendBtn, sendDisabled && styles.sendBtnDisabled]}
              onPress={() => void handleSend()}
              disabled={sendDisabled}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.sendBtnText}>Send</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },

  hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: spacing.xs },
  backBtn: { padding: spacing.xs, alignSelf: "flex-start", marginBottom: spacing.xs },
  heroTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  botDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E" },
  heroTitle: { color: "#FFFFFF", fontSize: typography.title, fontWeight: "800", letterSpacing: -0.3 },
  heroSub: { color: "#C4B5FD", fontSize: typography.body, opacity: 0.85 },
  devRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6 },
  devPill: {
    color: "#86EFAC",
    fontSize: 11,
    fontWeight: "800",
    backgroundColor: "rgba(22,101,52,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: "hidden",
  },
  testAiBtn: {
    backgroundColor: "rgba(167,139,250,0.25)",
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  testAiBtnText: { color: "#E9D5FF", fontSize: 11, fontWeight: "800" },

  chatContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
    flexGrow: 1,
  },

  bubble: { maxWidth: "85%", borderRadius: 16, padding: 12 },
  botBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: "flex-start",
    borderTopLeftRadius: 4,
  },
  userBubble: { backgroundColor: "#7C3AED", alignSelf: "flex-end", borderTopRightRadius: 4 },
  bubbleText: { fontSize: typography.body, lineHeight: 22 },
  botBubbleText: { color: colors.textSecondary },
  userBubbleText: { color: "#FFFFFF" },

  typingBubble: { flexDirection: "row", alignItems: "center", gap: 10 },
  typingText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: "600" },

  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  faqLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: spacing.lg,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  faqChips: { paddingHorizontal: spacing.lg, gap: 8, paddingBottom: 4 },
  faqChip: {
    maxWidth: 280,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  faqChipText: { color: colors.textSecondary, fontSize: typography.caption, fontWeight: "600" },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: typography.body,
  },
  sendBtn: {
    minWidth: 72,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnText: { color: "#FFF", fontWeight: "800", fontSize: typography.body },
});
