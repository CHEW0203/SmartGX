/**
 * SmartGX AI client — calls your local/proxy backend only.
 * Never send Gemini or other provider API keys from the app.
 */

import type { AiConfig } from "./ai.config";
import { getAiConfig } from "./ai.config";

const REQUEST_TIMEOUT_MS = 14_000;

export type SmartGxAiFeature =
  | "assistant"
  /** GXHealth SmartGX analysis + recommended actions (single structured response). */
  | "gxhealth_analysis"
  /** Reserved for a focused “next best action” call; same server routing as analysis when used. */
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

export type SmartGxAiProviderId = "gemini" | "fallback" | (string & {});

export interface SmartGxAiResponse {
  success: boolean;
  /** From server: "gemini" when the model returned content, "fallback" when the server used a fallback path. */
  provider: SmartGxAiProviderId;
  feature: string;
  model: string;
  content: string;
  structured: Record<string, unknown>;
  error: string | null;
  fallbackReason: string | null;
  /** Dev-only short hint about what went wrong. Never contains API keys. */
  debugError?: string;
}

export interface AssistantChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Verbose internal traces — off by default; set EXPO_PUBLIC_SMARTGX_AI_VERBOSE=1 to enable. */
const AI_VERBOSE =
  typeof process !== "undefined" && process.env.EXPO_PUBLIC_SMARTGX_AI_VERBOSE === "1";

function devTrace(...args: unknown[]) {
  if (typeof __DEV__ === "undefined" || !__DEV__ || !AI_VERBOSE) return;
  // eslint-disable-next-line no-console
  console.log("[SmartGX AI]", ...args);
}

/** Always-on in dev — ensures network failures and key events are never silent. */
function devLog(...args: unknown[]) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  // eslint-disable-next-line no-console
  console.log("[SmartGX AI]", ...args);
}

/** Normalized POST /api/ai */
export async function callSmartGxAi(
  feature: SmartGxAiFeature,
  prompt: string,
  context: Record<string, unknown> = {},
  config: AiConfig = getAiConfig()
): Promise<SmartGxAiResponse | null> {
  if (!config.enabled || !config.endpoint.startsWith("http")) {
    devLog("[AI Request Skip]", { feature, reason: "endpoint_not_configured", endpoint: config.endpoint || "(empty)" });
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  devLog("[AI Request Start]", { feature, endpoint: config.endpoint, hasContext: Object.keys(context).length > 0 });

  try {
    const res = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ feature, prompt, context }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const raw: unknown = await res.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      devLog("[AI Response Error]", { feature, reason: "invalid_json_body", httpStatus: res.status });
      return null;
    }

    const o = raw as Record<string, unknown>;
    const success = o.success === true;
    const content = typeof o.content === "string" ? o.content : "";
    const structured =
      typeof o.structured === "object" && o.structured !== null && !Array.isArray(o.structured)
        ? (o.structured as Record<string, unknown>)
        : {};
    const error = o.error == null ? null : String(o.error);
    const serverProvider = typeof o.provider === "string" ? o.provider : "fallback";
    const provider = (serverProvider === "gemini" ? "gemini" : "fallback") as SmartGxAiProviderId;
    const model = typeof o.model === "string" ? o.model : "";
    const featureEcho = typeof o.feature === "string" ? o.feature : feature;
    const fallbackReason = o.fallbackReason == null ? null : String(o.fallbackReason);

    const debugError = typeof o.debugError === "string" ? o.debugError : undefined;

    if (!success) {
      devLog("[AI Response]", { feature: featureEcho, provider, success: false, fallbackReason: fallbackReason || error || "unknown", debugError: debugError || null });
      return {
        success: false,
        provider,
        feature: featureEcho,
        model,
        content: "",
        structured,
        error: error || "AI error",
        fallbackReason: fallbackReason || error,
      };
    }

    devLog("[AI Response]", { feature: featureEcho, provider, model, success: true });
    devTrace("response detail", { debugError: debugError || null, contentLength: content.length });
    return { success: true, provider, feature: featureEcho, model, content, structured, error: null, fallbackReason: null, debugError };
  } catch (err: unknown) {
    clearTimeout(timer);
    const errMsg = err instanceof Error ? err.message : String(err);
    const isAbort = err instanceof Error && err.name === "AbortError";
    devLog("[AI Request Failed]", {
      feature,
      reason: isAbort ? "timeout" : "network_error",
      error: errMsg.slice(0, 200),
      endpoint: config.endpoint,
    });
    return null;
  }
}

/** Quick connectivity check for development / troubleshooting. */
export async function testSmartGxAiConnection(
  config: AiConfig = getAiConfig()
): Promise<{ ok: boolean; headline: string; detail: string; raw: SmartGxAiResponse | null }> {
  if (!config.enabled) {
    return {
      ok: false,
      headline: "Using fallback",
      detail: "EXPO_PUBLIC_SMARTGX_AI_ENDPOINT is not set or invalid.",
      raw: null,
    };
  }

  const res = await callSmartGxAi("assistant", "Reply with: SmartGX AI online.", {}, config);
  if (res?.success && res.content.trim() && res.provider === "gemini") {
    return {
      ok: true,
      headline: "Connected to Gemini",
      detail: res.content.trim().slice(0, 200),
      raw: res,
    };
  }
  if (res && !res.success) {
    return {
      ok: false,
      headline: res.provider === "fallback" ? "Using fallback" : "Error",
      detail: res.fallbackReason || res.error || "AI server returned an error.",
      raw: res,
    };
  }
  return {
    ok: false,
    headline: "Using fallback",
    detail: "Could not reach the AI server or request timed out.",
    raw: res,
  };
}

/** Outcome from assistant remote call — used for accurate Gemini vs fallback labelling. */
export interface AssistantRemoteOutcome {
  text: string;
  provider: "gemini" | "fallback";
  model: string;
  success: boolean;
  fallbackReason: string | null;
}

/** SmartGX Assistant: chat transcript → natural language reply (or null to use local FAQ / generic fallback). */
export async function invokeAssistantChat(
  messages: AssistantChatMessage[],
  config: AiConfig = getAiConfig()
): Promise<AssistantRemoteOutcome | null> {
  if (!config.enabled) return null;

  const transcript = messages
    .map((m) => {
      const who = m.role === "system" ? "System" : m.role === "assistant" ? "Assistant" : "User";
      return `${who}: ${m.content}`;
    })
    .join("\n");

  const prompt =
    "Reply as SmartGX Assistant to the conversation below. Be helpful and concise.\n\n" + transcript;

  const res = await callSmartGxAi(
    "assistant",
    prompt,
    { messages: messages.map((m) => ({ role: m.role, content: m.content })) },
    config
  );

  if (!res) {
    devLog("[Assistant]", { feature: "assistant", provider: "fallback", success: false, fallbackReason: "network_or_timeout" });
    return null;
  }

  devLog("[Assistant]", {
    feature: res.feature || "assistant",
    provider: res.provider,
    success: res.success,
    fallbackReason: res.fallbackReason ?? res.error ?? null,
  });

  const trimmed = res.content.trim();
  if (res.success && trimmed && res.provider === "gemini") {
    return {
      text: trimmed,
      provider: "gemini",
      model: res.model,
      success: true,
      fallbackReason: null,
    };
  }

  return {
    text: "",
    provider: "fallback",
    model: res.model,
    success: false,
    fallbackReason: res.fallbackReason || res.error || "remote_failed",
  };
}

/** @deprecated Use callSmartGxAi with a SmartGxAiFeature */
export interface AiStructuredRequest {
  capability:
    | "assistant_chat"
    | "gxhealth_analysis"
    | "transaction_insight"
    | "smart_nudge"
    | "critical_reason"
    | "receipt_classify"
    | "debt_readiness"
    | "scam_message"
    | "security_recommendation"
    | "tree_health"
    | "mission_recommendation"
    | "smartscore_explanation";
  payload: Record<string, unknown>;
}

const CAPABILITY_FEATURE: Record<AiStructuredRequest["capability"], SmartGxAiFeature> = {
  assistant_chat: "assistant",
  gxhealth_analysis: "gxhealth_analysis",
  transaction_insight: "transaction_insight",
  smart_nudge: "smart_ai_nudge",
  critical_reason: "critical_risk_nudge",
  receipt_classify: "income_classification",
  debt_readiness: "flexicredit_debt_readiness",
  scam_message: "scam_message_check",
  security_recommendation: "security_risk_check",
  tree_health: "tree_health",
  mission_recommendation: "mission",
  smartscore_explanation: "smartscore",
};

export async function invokeSmartGxAiStructured(
  request: AiStructuredRequest,
  config: AiConfig = getAiConfig()
): Promise<Response | null> {
  const feature = CAPABILITY_FEATURE[request.capability];
  const prompt =
    typeof request.payload.prompt === "string"
      ? request.payload.prompt
      : `Execute capability ${request.capability} using the provided payload.`;

  const res = await callSmartGxAi(feature, prompt, request.payload, config);
  if (!res) return null;

  const body = JSON.stringify({
    success: res.success,
    provider: res.provider,
    feature: res.feature,
    model: res.model,
    content: res.content,
    structured: res.structured,
    error: res.error,
    fallbackReason: res.fallbackReason,
  });

  return new Response(body, {
    status: res.success ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
}
