import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  analyzeCriticalReasonWithContext,
  localAnalyzeCriticalReason,
} from "../../features/nudge/aiNudge.service";
import type {
  NudgeDecision,
  NudgeEvaluation,
  NudgeRiskContext,
  ReasonAnalysisResult,
} from "../../features/nudge/nudge.types";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/radius";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

const MIN_REASON_LEN = 8;
const REASON_VALIDATION_ERROR = "Please enter a clear reason before analysis.";

interface Props {
  visible: boolean;
  title?: string;
  message: string;
  amountLabel: string;
  summaryLabel: string;
  evaluation: NudgeEvaluation;
  /** Required for critical reason analysis (context-aware fallback) */
  riskContext: NudgeRiskContext;
  showUseDebitInstead?: boolean;
  onDecision: (decision: NudgeDecision) => void;
}

function dimLabel(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export function AiNudgeModal({
  visible,
  title = "SmartGX AI Nudge",
  message,
  amountLabel,
  summaryLabel,
  evaluation,
  riskContext,
  showUseDebitInstead,
  onDecision,
}: Props) {
  const [countdown, setCountdown] = useState(10);
  const [criticalReason, setCriticalReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [analysisResult, setAnalysisResult] = useState<ReasonAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const prevVisibleRef = useRef(false);

  const needsCountdown = evaluation.requiresCountdown;
  const needsReasonInput = evaluation.requiresReasonInput;

  useEffect(() => {
    if (!visible || !needsCountdown) return;
    setCountdown(10);
  }, [visible, needsCountdown]);

  useEffect(() => {
    const opened = visible && !prevVisibleRef.current;
    prevVisibleRef.current = visible;
    if (!opened) return;
    setCriticalReason("");
    setReasonError("");
    setAnalysisResult(null);
    setAnalyzing(false);
  }, [visible]);

  useEffect(() => {
    if (!visible || !needsCountdown || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [visible, needsCountdown, countdown]);

  const riskColor =
    evaluation.riskLevel === "critical"
      ? "#EF4444"
      : evaluation.riskLevel === "high"
        ? "#F59E0B"
        : evaluation.riskLevel === "medium"
          ? "#A78BFA"
          : "#22C55E";

  const countdownOk = !needsCountdown || countdown <= 0;

  const analysisAllowsContinue =
    needsReasonInput && analysisResult !== null && analysisResult.canContinue;

  const canContinue = countdownOk && (!needsReasonInput || analysisAllowsContinue);

  const showTrySmaller =
    needsReasonInput &&
    analysisResult &&
    (analysisResult.recommendation === "block" || analysisResult.recommendation === "delay");

  const onReasonChange = (text: string) => {
    setCriticalReason(text);
    setReasonError("");
    if (analysisResult !== null) setAnalysisResult(null);
  };

  const handleAnalyzeReason = async () => {
    if (!needsReasonInput) return;

    const trimmed = criticalReason.trim();
    if (trimmed.length < MIN_REASON_LEN) {
      setReasonError(REASON_VALIDATION_ERROR);
      setAnalysisResult(null);
      return;
    }
    setReasonError("");
    setAnalyzing(true);
    try {
      const result = await analyzeCriticalReasonWithContext(trimmed, riskContext, evaluation);
      setAnalysisResult(result);
    } catch (e) {
      console.warn("SmartGX reason analysis failed", e);
      setAnalysisResult(localAnalyzeCriticalReason(trimmed, riskContext, evaluation));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      hardwareAccelerated
    >
      <Pressable style={styles.backdrop} onPress={() => onDecision("cancel")}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{title}</Text>
            <Text style={[styles.riskPill, { color: riskColor, borderColor: `${riskColor}66` }]}>
              {evaluation.riskLevel.toUpperCase()} RISK
            </Text>

            <View style={styles.summary}>
              <Text style={styles.summaryKey}>Action</Text>
              <Text style={styles.summaryVal}>{summaryLabel}</Text>
              <Text style={styles.summaryKey}>Amount</Text>
              <Text style={styles.summaryVal}>{amountLabel}</Text>
            </View>

            <Text style={styles.message}>{message}</Text>
            <Text style={styles.suggested}>{evaluation.suggestedAction}</Text>

            {needsCountdown ? (
              <Text style={styles.countdown}>
                Continue available in <Text style={styles.countdownNum}>{countdown}s</Text>
              </Text>
            ) : null}

            {needsReasonInput ? (
              <View style={styles.reasonWrap}>
                <Text style={styles.reasonLabel}>Why do you need to continue this payment?</Text>
                <TextInput
                  value={criticalReason}
                  onChangeText={onReasonChange}
                  placeholder="Enter reason (required for critical risk)"
                  placeholderTextColor="#64748B"
                  style={styles.reasonInput}
                  multiline
                  editable={!analyzing}
                />
                {reasonError ? <Text style={styles.reasonErrorText}>{reasonError}</Text> : null}

                <Pressable
                  style={[styles.reasonBtn, analyzing && styles.reasonBtnDisabled]}
                  onPress={() => {
                    void handleAnalyzeReason();
                  }}
                  disabled={analyzing}
                  hitSlop={8}
                >
                  <Text style={styles.reasonBtnText}>
                    {analyzing ? "Analyzing..." : analysisResult ? "Analyze Again" : "Analyze reason"}
                  </Text>
                </Pressable>

                {analysisResult && !analyzing ? (
                  <Text style={styles.analyzedHint}>Reason analyzed</Text>
                ) : null}

                {needsReasonInput && !analysisResult && !analyzing ? (
                  <Text style={styles.helperMuted}>Analyze your reason before continuing.</Text>
                ) : null}

                {analysisResult ? (
                  <View style={styles.resultPanel}>
                    <Text style={styles.resultTitle}>AI Review Result</Text>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultKey}>Necessity</Text>
                      <Text style={styles.resultVal}>{dimLabel(analysisResult.necessity)}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultKey}>Urgency</Text>
                      <Text style={styles.resultVal}>{dimLabel(analysisResult.urgency)}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultKey}>Impulse risk</Text>
                      <Text style={styles.resultVal}>{dimLabel(analysisResult.impulseRisk)}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultKey}>Fraud risk</Text>
                      <Text style={styles.resultVal}>{dimLabel(analysisResult.fraudRisk)}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultKey}>Cashflow concern</Text>
                      <Text style={styles.resultVal}>{dimLabel(analysisResult.cashflowConcern)}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultKey}>Recommendation</Text>
                      <Text style={[styles.resultVal, styles.resultEmphasis]}>
                        {recommendationLabel(analysisResult.recommendation)}
                      </Text>
                    </View>
                    <Text style={styles.resultExplanation}>{analysisResult.explanation}</Text>
                    <Text style={[styles.continueStatus, canContinue ? styles.continueOk : styles.continueBlocked]}>
                      {canContinue
                        ? "Continue enabled: Your reason appears necessary. You may continue after confirmation."
                        : analysisResult.recommendation === "block"
                          ? "Continue blocked: SmartGX cannot continue this transaction because the reason appears unsafe for your current financial condition."
                          : "Continue remains disabled: delay is recommended. Use Save Instead, Try smaller amount, Cancel, or Review GXHealth."}
                    </Text>
                    <Text style={styles.saferAltText}>Safer alternative: {analysisResult.saferAlternative}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Pressable
              style={[styles.primaryBtnFull, !canContinue && styles.primaryDisabled]}
              onPress={() => onDecision("continue")}
              disabled={!canContinue}
            >
              <Text style={styles.primaryText}>Continue</Text>
            </Pressable>

            {(evaluation.recommendSaveInstead || showUseDebitInstead) && (
              <View style={styles.row}>
                {evaluation.recommendSaveInstead ? (
                  <Pressable style={styles.altBtn} onPress={() => onDecision("save_instead")}>
                    <Text style={styles.altText}>Save Instead</Text>
                  </Pressable>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                {showUseDebitInstead ? (
                  <Pressable style={styles.altBtn} onPress={() => onDecision("use_debit_instead")}>
                    <Text style={styles.altText}>Use Debit Instead</Text>
                  </Pressable>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
              </View>
            )}

            {showTrySmaller ? (
              <Pressable style={styles.trySmallerBtn} onPress={() => onDecision("try_smaller_amount")}>
                <Text style={styles.trySmallerText}>Try smaller amount</Text>
              </Pressable>
            ) : null}

            <Pressable style={styles.linkBtn} onPress={() => onDecision("review_gxhealth")}>
              <Text style={styles.linkText}>Review GXHealth</Text>
            </Pressable>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function recommendationLabel(r: ReasonAnalysisResult["recommendation"]): string {
  const map: Record<ReasonAnalysisResult["recommendation"], string> = {
    allow: "Allow",
    delay: "Delay",
    block: "Block",
    use_debit: "Use debit",
    save_instead: "Save instead",
    reduce_amount: "Reduce amount",
  };
  return map[r];
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.78)" },
  kav: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    backgroundColor: "#0C0920",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.25)",
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    zIndex: 40,
    elevation: 40,
  },
  title: { color: "#FFFFFF", fontSize: typography.title, fontWeight: "800", textAlign: "center" },
  riskPill: {
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    fontSize: 11,
    fontWeight: "800",
  },
  summary: {
    marginTop: 4,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 3,
  },
  summaryKey: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryVal: { color: "#FFFFFF", fontSize: typography.body, fontWeight: "700" },
  message: { color: "#E2E8F0", fontSize: typography.body, lineHeight: 22, marginTop: 6 },
  suggested: { color: "#A78BFA", fontSize: typography.caption, lineHeight: 20 },
  countdown: { color: colors.textMuted, textAlign: "center", marginTop: 2 },
  countdownNum: { color: "#F59E0B", fontWeight: "800" },
  row: { flexDirection: "row", gap: 10, marginTop: 2 },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  cancelText: { color: colors.textMuted, fontWeight: "700" },
  primaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  primaryDisabled: { backgroundColor: "rgba(124,58,237,0.35)" },
  primaryBtnFull: {
    width: "100%",
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 2,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "700" },
  altBtn: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.4)",
    backgroundColor: "rgba(34,197,94,0.12)",
    alignItems: "center",
    paddingVertical: 11,
  },
  altText: { color: "#22C55E", fontWeight: "700", fontSize: typography.caption },
  trySmallerBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.45)",
    backgroundColor: "rgba(250,204,21,0.1)",
    alignItems: "center",
    paddingVertical: 11,
    marginTop: 4,
  },
  trySmallerText: { color: "#FACC15", fontWeight: "700", fontSize: typography.caption },
  linkBtn: { alignItems: "center", paddingTop: 6 },
  linkText: { color: "#7DD3FC", fontSize: typography.caption, fontWeight: "700" },
  reasonWrap: { marginTop: 4, gap: 8 },
  reasonLabel: { color: "#FCA5A5", fontSize: typography.caption, fontWeight: "700" },
  reasonInput: {
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
    backgroundColor: "rgba(15,23,42,0.7)",
    borderRadius: radius.md,
    color: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 68,
    textAlignVertical: "top",
  },
  reasonErrorText: { color: "#FCA5A5", fontSize: typography.caption, fontWeight: "600" },
  reasonBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.4)",
    backgroundColor: "rgba(125,211,252,0.12)",
    alignItems: "center",
    paddingVertical: 12,
  },
  reasonBtnDisabled: { opacity: 0.65 },
  reasonBtnText: { color: "#7DD3FC", fontWeight: "700", fontSize: typography.caption },
  analyzedHint: { color: "#22C55E", fontSize: typography.caption, fontWeight: "700", textAlign: "center" },
  helperMuted: { color: colors.textMuted, fontSize: typography.caption, textAlign: "center" },
  resultPanel: {
    marginTop: 6,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.2)",
    gap: 6,
  },
  resultTitle: { color: "#E2E8F0", fontWeight: "800", fontSize: typography.body },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultKey: { color: colors.textMuted, fontSize: typography.caption },
  resultVal: { color: "#F8FAFC", fontSize: typography.caption, fontWeight: "700" },
  resultEmphasis: { color: "#A78BFA", textTransform: "capitalize" },
  resultExplanation: { color: "#CBD5E1", fontSize: typography.caption, lineHeight: 20, marginTop: 4 },
  continueStatus: { fontSize: typography.caption, lineHeight: 18, marginTop: 2, fontWeight: "700" },
  continueOk: { color: "#22C55E" },
  continueBlocked: { color: "#FCA5A5" },
  saferAltText: { color: "#7DD3FC", fontSize: typography.caption, lineHeight: 18, marginTop: 2, fontWeight: "700" },
});
