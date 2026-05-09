import { callSmartGxAi } from "../../services/ai/ai.client";
import { getAiConfig } from "./ai.config";
import type { ScamAnalysisResult, ScamRiskLevel } from "../../store/securityStore";

const HIGH_PATTERNS: { re: RegExp; signal: string }[] = [
  { re: /guaranteed\s+return/i, signal: "guaranteed return" },
  { re: /pin|otp|password/i, signal: "requests PIN or OTP" },
  { re: /(urgent|immediate)\s+(transfer|payment)/i, signal: "urgent transfer language" },
  { re: /claim\s+(your\s+)?prize/i, signal: "prize claim" },
  { re: /crypto|bitcoin|usdt/i, signal: "crypto urgency" },
  { re: /processing\s+fee\s+(before|to)\s+(release|get)/i, signal: "upfront processing fee" },
];

const MEDIUM_PATTERNS: { re: RegExp; signal: string }[] = [
  { re: /unknown\s+seller/i, signal: "unknown seller" },
  { re: /(maybank|cimb|rhb|bank)\s*[^\s]*\.(xyz|tk|click)/i, signal: "suspicious link pattern" },
  { re: /bit\.ly|tinyurl/i, signal: "shortened link" },
];

function ruleBasedScam(text: string): ScamAnalysisResult {
  const signals: string[] = [];
  for (const { re, signal } of HIGH_PATTERNS) {
    if (re.test(text)) signals.push(signal);
  }
  for (const { re, signal } of MEDIUM_PATTERNS) {
    if (re.test(text)) signals.push(signal);
  }

  let risk: ScamRiskLevel = "low";
  if (signals.length >= 2 || HIGH_PATTERNS.some(({ re }) => re.test(text))) risk = "high";
  else if (signals.length === 1) risk = "medium";

  const explanation =
    risk === "high"
      ? "Several high-risk patterns were detected. Treat this as suspicious."
      : risk === "medium"
        ? "Some warning signs were found. Verify before you act."
        : "No strong scam signals detected. Stay cautious with unknown senders.";

  const recommendation =
    risk === "high"
      ? "Do not proceed. Verify through official SmartGX channels and consider freezing your card if you already shared details."
      : risk === "medium"
        ? "Verify the recipient independently. Do not share your PIN or OTP."
        : "If unsure, pause and confirm with someone you trust.";

  return { risk, explanation, recommendation, signals };
}

/** Rules determine risk; Gemini may refine wording only (never weakens rule-based risk). */
export async function analyzeScamMessageOrLink(input: string): Promise<ScamAnalysisResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      risk: "low",
      explanation: "Enter a message or link to analyze.",
      recommendation: "Paste content you are unsure about.",
      signals: [],
    };
  }

  const rules = ruleBasedScam(trimmed);
  const cfg = getAiConfig();
  if (!cfg.enabled) return rules;

  try {
    const res = await callSmartGxAi(
      "scam_check",
      [
        "SmartGX Scam Protection: rule engine found risk level and signals.",
        "Write clearer explanation and recommendation for a banking user (2–3 sentences total).",
        "Do not contradict the rule risk level.",
        "Reply JSON only: {\"explanation\":\"...\",\"recommendation\":\"...\"}",
      ].join(" "),
      {
        riskLevel: rules.risk,
        signals: rules.signals,
        textSample: trimmed.slice(0, 4000),
      },
      cfg
    );

    if (!res?.success || !res.content.trim()) return rules;

    const fromStruct =
      typeof res.structured.explanation === "string"
        ? {
            explanation: String(res.structured.explanation),
            recommendation:
              typeof res.structured.recommendation === "string"
                ? String(res.structured.recommendation)
                : rules.recommendation,
          }
        : null;

    if (fromStruct?.explanation) {
      return { ...rules, explanation: fromStruct.explanation, recommendation: fromStruct.recommendation };
    }

    const m = res.content.match(/\{[\s\S]*\}/);
    if (m) {
      const j = JSON.parse(m[0]) as { explanation?: string; recommendation?: string };
      if (typeof j.explanation === "string" && j.explanation.trim()) {
        return {
          ...rules,
          explanation: j.explanation.trim(),
          recommendation: typeof j.recommendation === "string" && j.recommendation.trim() ? j.recommendation.trim() : rules.recommendation,
        };
      }
    }
  } catch {
    /* keep rules */
  }

  return rules;
}

export function generateSecurityRecommendation(context: { emergencyLock: boolean; pinSet: boolean; deviceTrusted: boolean }): string {
  if (context.emergencyLock) return "Emergency Lock is active. Unlock only after you confirm your device is safe.";
  if (!context.pinSet) return "Finish PIN setup to protect payments and transfers.";
  if (!context.deviceTrusted) return "Review device trust settings and sign out unfamiliar sessions.";
  return "Your protection settings look in good shape. Run a device safety check regularly.";
}

/** Optional Gemini copy — falls back to `generateSecurityRecommendation`. */
export async function generateSecurityRecommendationWithGemini(context: {
  emergencyLock: boolean;
  pinSet: boolean;
  deviceTrusted: boolean;
}): Promise<string> {
  const base = generateSecurityRecommendation(context);
  const cfg = getAiConfig();
  if (!cfg.enabled) return base;
  try {
    const res = await callSmartGxAi(
      "security",
      "Give one short SmartGX Security Center tip (max 2 sentences) based on the flags. Plain text only.",
      { ...context, baseRecommendation: base },
      cfg
    );
    if (res?.success && res.content.trim()) return res.content.trim().slice(0, 500);
  } catch {
    /* ignore */
  }
  return base;
}

export function generateDeviceRiskExplanation(flags: { suspiciousSession: boolean; failedPins: number; untrusted: boolean }): string {
  const parts: string[] = [];
  if (flags.suspiciousSession) parts.push("An unfamiliar session pattern was flagged.");
  if (flags.failedPins >= 2) parts.push("Recent incorrect PIN attempts increased risk.");
  if (flags.untrusted) parts.push("This device is not marked as trusted.");
  return parts.length ? parts.join(" ") : "No extra risk signals on file for this device.";
}
