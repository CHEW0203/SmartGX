import { callSmartGxAi } from "../../services/ai/ai.client";
import { getAiConfig } from "../../services/ai/ai.config";
import { polishAiOutput } from "../../lib/aiText";
import { SMARTGX_AI_WRITING_RULES } from "../../services/ai/aiPromptStyle";
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

function detectMessageSignals(text: string): {
  asksOtpPinOrPassword: boolean;
  asksUrgentTransfer: boolean;
  mentionsPrizeOrReward: boolean;
  mentionsInvestmentReturn: boolean;
} {
  const t = text.toLowerCase();
  return {
    asksOtpPinOrPassword: /\botp\b|\bpin\b|\bpassword\b|\bpasscode\b|\btac\b/i.test(text),
    asksUrgentTransfer: /(urgent|immediately|within\s+\d+\s*(hour|minute)|act\s+now)/i.test(t),
    mentionsPrizeOrReward: /(prize|reward|won|winner|lucky\s+draw)/i.test(t),
    mentionsInvestmentReturn: /(guaranteed|fixed\s+return|profit\s+|\b10%\b|\b20%\b|double\s+your)/i.test(t),
  };
}

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

  const sig = detectMessageSignals(text);
  const explanation =
    risk === "high"
      ? `SmartGX matched ${signals.slice(0, 3).join(", ") || "several high-risk patterns"} in this text. Treat it as suspicious and do not share banking details.`
      : risk === "medium"
        ? `SmartGX found ${signals[0] ?? "some warning signs"} in this text. Pause and verify through an official app or branch before you pay or tap any link.`
        : "No strong scam keyword pattern was found in this short sample. Still treat unknown senders with caution.";

  const recommendation =
    risk === "high"
      ? "Do not pay, do not share OTP or PIN, and do not install apps from the message. Open SmartGX or your bank only from your home screen."
      : risk === "medium"
        ? "Verify the sender through a second channel you trust. Do not use links or phone numbers from the message alone."
        : "If you are unsure, wait and ask someone you trust before you act.";

  return { risk, explanation, recommendation, signals, provider: "fallback" as const };
}

function extractUrlInfo(text: string): {
  urls: string[];
  hasHttpOnly: boolean;
  hasShortenedLink: boolean;
  domains: string[];
} {
  const urlRe = /https?:\/\/[^\s<>"']+/gi;
  const urls = text.match(urlRe) ?? [];
  const hasHttpOnly = urls.some((u) => u.startsWith("http://"));
  const hasShortenedLink = /bit\.ly|tinyurl|t\.co|goo\.gl|is\.gd|cutt\.ly|rb\.gy/i.test(text);
  const domains = urls.map((u) => {
    try {
      return new URL(u).hostname;
    } catch {
      return "";
    }
  }).filter(Boolean);
  return { urls, hasHttpOnly, hasShortenedLink, domains };
}

function mergeScamGemini(
  rules: ScamAnalysisResult,
  explanation: string,
  recommendation: string,
  extras?: { redFlags?: string[]; avoidDoing?: string[] }
): ScamAnalysisResult {
  return {
    ...rules,
    explanation: polishAiOutput(explanation.trim()) || rules.explanation,
    recommendation: polishAiOutput(recommendation.trim()) || rules.recommendation,
    redFlags: extras?.redFlags ?? rules.redFlags,
    avoidDoing: extras?.avoidDoing ?? rules.avoidDoing,
  };
}

export interface ScamCheckSecurityContext {
  securityScore?: number;
  scamProtectionEnabled?: boolean;
  deviceSafetyStatus?: string;
  emergencyLockActive?: boolean;
}

/** Rules determine risk; Gemini refines wording (never weakens rule-based risk). */
export async function analyzeScamMessageOrLink(
  input: string,
  securityContext?: ScamCheckSecurityContext
): Promise<ScamAnalysisResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      risk: "low",
      explanation: "Paste a message or link you received so SmartGX can scan for common scam wording.",
      recommendation: "Add the full text if you can. Short samples are harder to judge.",
      signals: [],
      provider: "fallback",
    };
  }

  const rules = ruleBasedScam(trimmed);
  const cfg = getAiConfig();
  if (!cfg.enabled) return rules;

  const flags = detectMessageSignals(trimmed);
  const urlInfo = extractUrlInfo(trimmed);

  try {
    const res = await callSmartGxAi(
      "scam_message_check",
      [
        "SmartGX Scam Protection already computed riskLevel and signals in context.",
        "Write explanation and recommendation for a Malaysian banking user. Stay aligned with riskLevel (do not call it low if riskLevel is high).",
        "",
        "Your analysis must:",
        "1. Name the exact suspicious patterns found (OTP request, urgent transfer, fake prize, shortened link, processing fee demand, crypto scam, etc.).",
        "2. Quote specific words or phrases from the message that triggered concern.",
        "3. Explain what the scammer likely wants (credentials, money transfer, personal data).",
        "4. Give concrete actions: what NOT to do (do not click, do not share, do not install) and what TO do (report, block, verify through official app).",
        "5. If the risk is Critical or High and the user has Emergency Lock available, suggest enabling it.",
        "",
        "Do not be generic. Reference the actual textSample content.",
        SMARTGX_AI_WRITING_RULES,
        "Reply JSON only: {\"explanation\":\"...\",\"recommendation\":\"...\",\"redFlags\":[\"...\"],\"avoidDoing\":[\"...\"],\"shouldUseEmergencyLock\":true|false}",
        "redFlags and avoidDoing are arrays (0 to 4 items each).",
      ].join(" "),
      {
        riskLevel: rules.risk,
        signals: rules.signals,
        textSample: trimmed.slice(0, 4000),
        messageSignals: flags,
        urlInfo: urlInfo.urls.length > 0 ? {
          extractedUrls: urlInfo.urls.slice(0, 5),
          domains: urlInfo.domains.slice(0, 5),
          hasHttpOnly: urlInfo.hasHttpOnly,
          hasShortenedLink: urlInfo.hasShortenedLink,
        } : null,
        securityContext: securityContext ?? null,
      },
      cfg
    );

    if (!res?.success || !res.content.trim()) return rules;

    const geminiResult = { ...rules, provider: "gemini" as const };

    const st = res.structured;
    const fromStruct =
      typeof st.explanation === "string" && st.explanation.trim()
        ? {
            explanation: String(st.explanation),
            recommendation:
              typeof st.recommendation === "string" && st.recommendation.trim()
                ? String(st.recommendation)
                : rules.recommendation,
            redFlags: Array.isArray(st.redFlags) ? st.redFlags.filter((x): x is string => typeof x === "string") : [],
            avoidDoing: Array.isArray(st.avoidDoing) ? st.avoidDoing.filter((x): x is string => typeof x === "string") : [],
          }
        : null;

    if (fromStruct) {
      const merged = mergeScamGemini(geminiResult, fromStruct.explanation, fromStruct.recommendation, {
        redFlags: fromStruct.redFlags,
        avoidDoing: fromStruct.avoidDoing,
      });
      merged.provider = "gemini";
      return merged;
    }

    const m = res.content.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const j = JSON.parse(m[0]) as {
          explanation?: string;
          recommendation?: string;
          redFlags?: string[];
          avoidDoing?: string[];
        };
        if (typeof j.explanation === "string" && j.explanation.trim()) {
          const redFlags = Array.isArray(j.redFlags) ? j.redFlags.filter((x) => typeof x === "string") : [];
          const avoidDoing = Array.isArray(j.avoidDoing) ? j.avoidDoing.filter((x) => typeof x === "string") : [];
          const merged = mergeScamGemini(
            geminiResult,
            j.explanation.trim(),
            typeof j.recommendation === "string" && j.recommendation.trim() ? j.recommendation.trim() : rules.recommendation,
            { redFlags, avoidDoing }
          );
          merged.provider = "gemini";
          return merged;
        }
      } catch {
        /* JSON parse failed but Gemini returned text */
      }
    }

    if (res.content.trim()) {
      return {
        ...geminiResult,
        explanation: polishAiOutput(res.content.trim().slice(0, 1200)),
        provider: "gemini",
      };
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

export type SecurityGeminiContext = {
  emergencyLock: boolean;
  pinSet: boolean;
  deviceTrusted: boolean;
  securityScore?: number;
  securityStatusLabel?: string;
  scamProtectionSummary?: string;
  deviceSafetyStatus?: string;
  transactionAlertsEnabled?: boolean;
  mockSuspiciousSession?: boolean;
  mockRiskyLinkFlag?: boolean;
  wrongPinAttempts?: number;
};

/** Optional Gemini copy — falls back to `generateSecurityRecommendation`. */
export async function generateSecurityRecommendationWithGemini(context: SecurityGeminiContext): Promise<string> {
  const base = generateSecurityRecommendation(context);
  const cfg = getAiConfig();
  if (!cfg.enabled) return base;
  try {
    const res = await callSmartGxAi(
      "security_risk_check",
      [
        "Give one short SmartGX Security Center coaching paragraph (max 3 sentences) using the flags and scores in context.",
        "Be specific about what is on track and what to fix next.",
        "Mention PIN setup if pinSet is false. Mention Device Safety if deviceTrusted is false. Mention Emergency Lock only if it is active.",
        "If securityScore is provided, reference whether it is strong, moderate, or weak.",
        SMARTGX_AI_WRITING_RULES,
        "Plain text only. No JSON.",
      ].join(" "),
      { ...context, baseRecommendation: base },
      cfg
    );
    if (res?.success && res.content.trim()) return polishAiOutput(res.content.trim().slice(0, 500));
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
