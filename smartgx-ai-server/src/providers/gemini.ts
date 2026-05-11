import { GoogleGenerativeAI } from "@google/generative-ai";

export type AiFeature =
  | "assistant"
  | "gxhealth_analysis"
  | "gxhealth_recommended_action"
  | "transaction_insight"
  | "smart_ai_nudge"
  | "critical_risk_nudge"
  | "income_classification"
  | "flexicredit_debt_readiness"
  | "scam_message_check"
  | "security_risk_check"
  | "saving_allocation_explanation"
  | "tree_health"
  | "mission"
  | "smartscore";

export interface GeminiCallInput {
  feature: string;
  prompt: string;
  context: Record<string, unknown>;
}

export type AiProviderKind = "gemini" | "fallback";

export interface NormalizedAiResponse {
  success: boolean;
  provider: AiProviderKind;
  feature: string;
  model: string;
  content: string;
  structured: Record<string, unknown>;
  error: string | null;
  fallbackReason: string | null;
  /** Dev-only short human-readable error hint. Never contains secrets. */
  debugError?: string;
}

function defaultModel(): string {
  return (process.env.GEMINI_MODEL_DEFAULT || "gemini-2.5-flash").trim();
}

function deepModel(): string {
  const d = (process.env.GEMINI_MODEL_DEEP || "").trim();
  return d || defaultModel();
}

/** Heavier reasoning features use deep model when GEMINI_MODEL_DEEP is set. */
export function pickModel(feature: string): string {
  const deepFeatures = new Set([
    "smart_ai_nudge",
    "critical_risk_nudge",
    "flexicredit_debt_readiness",
    "scam_message_check",
    "security_risk_check",
  ]);
  if (deepFeatures.has(feature)) return deepModel();
  return defaultModel();
}

/** Log config at startup so the developer can spot misconfig immediately. */
export function logModelConfig(): void {
  console.log(`[SmartGX AI] GEMINI_MODEL_DEFAULT: ${defaultModel()}`);
  console.log(`[SmartGX AI] GEMINI_MODEL_DEEP: ${deepModel()}${!process.env.GEMINI_MODEL_DEEP?.trim() ? " (inheriting default)" : ""}`);
}

const SMARTGX_SYSTEM_INSTRUCTION = [
  "You are SmartGX AI.",
  "Give concise, practical financial guidance for mobile users in Malaysia.",
  "Write money only as Malaysian Ringgit (RM), e.g. RM100 or RM1,200. Do not use $, USD, or dollars unless the user explicitly asks.",
  "Write in natural sentences. Do not use semicolons in the middle of sentences.",
  "Use the provided user context when present. Do not invent amounts, scores, or dates that are not in context.",
  "Explain financial behaviour clearly in plain language.",
  "Do not claim to be a real bank employee or regulator.",
  "Do not guarantee investment returns or financial outcomes.",
  "Do not present yourself as a certified financial adviser.",
  "Do not approve unsafe financial actions blindly. Warn when something looks risky.",
  "For banking and security actions, you explain and recommend only. The app controls blocking, limits, PIN, and locks.",
  "Use SmartGX branding only. Do not name unrelated competitor banks.",
].join(" ");

/* ── Payload sanitization ─────────────────────────────────────────── */

const MAX_ARRAY_ITEMS = 50;
const MAX_CONTEXT_DEPTH = 8;

function sanitizeValue(v: unknown, depth: number): unknown {
  if (depth > MAX_CONTEXT_DEPTH) return "[depth_limit]";
  if (v === undefined) return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    return v;
  }
  if (typeof v === "string" || typeof v === "boolean" || v === null) return v;
  if (Array.isArray(v)) {
    return v.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1));
  }
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = sanitizeValue(val, depth + 1);
    }
    return out;
  }
  return null;
}

function sanitizeContext(raw: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(raw, 0) as Record<string, unknown>;
}

/* ── Error classification ─────────────────────────────────────────── */

interface ClassifiedError {
  fallbackReason: string;
  debugError: string;
  httpStatus?: number;
  errorName: string;
  safeMessage: string;
}

function classifyGeminiError(e: unknown): ClassifiedError {
  if (!(e instanceof Error)) {
    return {
      fallbackReason: "gemini_unknown_error",
      debugError: "Unknown non-Error thrown",
      errorName: "Unknown",
      safeMessage: String(e).slice(0, 300),
    };
  }

  const msg = e.message || "";
  const name = e.constructor?.name || e.name || "Error";

  // GoogleGenerativeAIFetchError has .status, .statusText, .errorDetails
  const fetchErr = e as { status?: number; statusText?: string; errorDetails?: unknown[] };
  if (typeof fetchErr.status === "number") {
    const status = fetchErr.status;
    const statusText = fetchErr.statusText ?? "";
    const details = Array.isArray(fetchErr.errorDetails) ? fetchErr.errorDetails : [];
    const detailStr = details.length > 0 ? ` details=${JSON.stringify(details).slice(0, 500)}` : "";

    if (status === 400) {
      return {
        fallbackReason: "gemini_invalid_request",
        debugError: `Gemini 400 Bad Request: ${statusText}`,
        httpStatus: status,
        errorName: name,
        safeMessage: `${msg.slice(0, 300)}${detailStr}`,
      };
    }
    if (status === 403) {
      return {
        fallbackReason: "gemini_permission_denied",
        debugError: "Gemini 403 Permission Denied (check API key permissions)",
        httpStatus: status,
        errorName: name,
        safeMessage: `${msg.slice(0, 300)}${detailStr}`,
      };
    }
    if (status === 404) {
      return {
        fallbackReason: "gemini_model_not_found",
        debugError: "Gemini 404 Model Not Found (check GEMINI_MODEL_DEFAULT / GEMINI_MODEL_DEEP)",
        httpStatus: status,
        errorName: name,
        safeMessage: `${msg.slice(0, 300)}${detailStr}`,
      };
    }
    if (status === 429) {
      return {
        fallbackReason: "gemini_quota_exceeded",
        debugError: "Gemini 429 Quota Exceeded (rate limit or billing)",
        httpStatus: status,
        errorName: name,
        safeMessage: `${msg.slice(0, 300)}${detailStr}`,
      };
    }
    if (status >= 500) {
      return {
        fallbackReason: "gemini_server_error",
        debugError: `Gemini ${status} Server Error`,
        httpStatus: status,
        errorName: name,
        safeMessage: `${msg.slice(0, 300)}${detailStr}`,
      };
    }
    return {
      fallbackReason: "gemini_http_error",
      debugError: `Gemini HTTP ${status} ${statusText}`,
      httpStatus: status,
      errorName: name,
      safeMessage: `${msg.slice(0, 300)}${detailStr}`,
    };
  }

  // GoogleGenerativeAIResponseError has .response (safety block, etc.)
  const respErr = e as { response?: unknown };
  if (respErr.response !== undefined) {
    return {
      fallbackReason: "gemini_response_blocked",
      debugError: "Gemini response blocked (safety filter or empty candidates)",
      errorName: name,
      safeMessage: msg.slice(0, 300),
    };
  }

  // GoogleGenerativeAIRequestInputError
  if (name === "GoogleGenerativeAIRequestInputError") {
    return {
      fallbackReason: "gemini_invalid_input",
      debugError: "Gemini request input error (prompt or config rejected by SDK)",
      errorName: name,
      safeMessage: msg.slice(0, 300),
    };
  }

  // GoogleGenerativeAIAbortError
  if (name === "GoogleGenerativeAIAbortError" || msg.includes("aborted")) {
    return {
      fallbackReason: "gemini_timeout",
      debugError: "Gemini request aborted or timed out",
      errorName: name,
      safeMessage: msg.slice(0, 300),
    };
  }

  // Network errors
  if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") || msg.includes("fetch failed")) {
    return {
      fallbackReason: "gemini_network_error",
      debugError: "Gemini network error (DNS or connection refused)",
      errorName: name,
      safeMessage: msg.slice(0, 300),
    };
  }

  return {
    fallbackReason: "gemini_error",
    debugError: `Gemini error: ${name}`,
    errorName: name,
    safeMessage: msg.slice(0, 300),
  };
}

/* ── Main generation ──────────────────────────────────────────────── */

export async function generateWithGemini(input: GeminiCallInput): Promise<NormalizedAiResponse> {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  const modelName = pickModel(input.feature);
  const feature = input.feature;

  if (!apiKey) {
    const out: NormalizedAiResponse = {
      success: false,
      provider: "fallback",
      feature,
      model: defaultModel(),
      content: "",
      structured: {},
      error: "GEMINI_API_KEY is not set in smartgx-ai-server/.env",
      fallbackReason: "missing_api_key",
      debugError: "Gemini API key missing",
    };
    console.log(
      `[SmartGX AI] feature=${feature} provider=fallback model=${out.model} success=false fallbackReason=${out.fallbackReason}`
    );
    return out;
  }

  const sanitizedContext = sanitizeContext(input.context);
  let content = "";
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const longFormFeatures = new Set([
      "gxhealth_analysis",
      "gxhealth_recommended_action",
      "transaction_insight",
      "saving_allocation_explanation",
    ]);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: `${SMARTGX_SYSTEM_INSTRUCTION}\n\nCurrent feature: ${input.feature}.`,
      generationConfig: {
        maxOutputTokens: longFormFeatures.has(input.feature) ? 2048 : 1024,
        temperature: 0.35,
      },
    });

    const contextStr = JSON.stringify(sanitizedContext).slice(0, 12000);
    const fullPrompt =
      `Context (JSON, may be partial):\n${contextStr}\n\n` +
      `Task:\n${input.prompt}`;

    const result = await model.generateContent(fullPrompt);
    content = (await result.response.text()).trim();

    if (!content) {
      const out: NormalizedAiResponse = {
        success: false,
        provider: "fallback",
        feature,
        model: modelName,
        content: "",
        structured: {},
        error: "Empty model response",
        fallbackReason: "empty_model_response",
        debugError: "Gemini returned empty text",
      };
      console.log(
        `[SmartGX AI] feature=${feature} provider=fallback model=${modelName} success=false fallbackReason=${out.fallbackReason}`
      );
      return out;
    }

    let structured: Record<string, unknown> = {};
    let structuredParseWarning: string | undefined;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          structured = parsed as Record<string, unknown>;
        }
      } catch {
        structuredParseWarning = "structuredParseFailed";
      }
    }

    console.log(
      `[SmartGX AI] feature=${feature} provider=gemini model=${modelName} success=true` +
        (structuredParseWarning ? ` warning=${structuredParseWarning}` : "")
    );
    return {
      success: true,
      provider: "gemini",
      feature,
      model: modelName,
      content,
      structured,
      error: null,
      fallbackReason: null,
      debugError: structuredParseWarning,
    };
  } catch (e) {
    const classified = classifyGeminiError(e);
    const out: NormalizedAiResponse = {
      success: false,
      provider: "fallback",
      feature,
      model: modelName,
      content: content || "",
      structured: {},
      error: classified.safeMessage,
      fallbackReason: classified.fallbackReason,
      debugError: classified.debugError,
    };
    console.error(
      `[SmartGX AI] feature=${feature} provider=fallback model=${modelName} success=false` +
        ` fallbackReason=${classified.fallbackReason}` +
        ` errorName=${classified.errorName}` +
        (classified.httpStatus ? ` httpStatus=${classified.httpStatus}` : "") +
        ` debugError="${classified.debugError}"` +
        ` message="${classified.safeMessage.slice(0, 400)}"`
    );
    return out;
  }
}
