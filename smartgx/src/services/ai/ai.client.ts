/**
 * SmartGX AI client — calls your local/proxy backend only.
 * Never send Gemini or other provider API keys from the app.
 */

import type { AiConfig } from "./ai.config";
import { getAiConfig } from "./ai.config";

const REQUEST_TIMEOUT_MS = 14_000;

export type SmartGxAiFeature =
  | "assistant"
  | "gxhealth"
  | "transaction_insight"
  | "nudge"
  | "critical_reason"
  | "income_classification"
  | "debt_readiness"
  | "scam_check"
  | "security"
  | "tree_health"
  | "mission"
  | "smartscore";

export interface SmartGxAiResponse {
  success: boolean;
  provider: string;
  model: string;
  content: string;
  structured: Record<string, unknown>;
  error: string | null;
}

export interface AssistantChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Every request/timeout/success line — off by default; set EXPO_PUBLIC_SMARTGX_AI_VERBOSE=1 to trace. */
const AI_TRACE =
  typeof process !== "undefined" && process.env.EXPO_PUBLIC_SMARTGX_AI_VERBOSE === "1";

function devTrace(...args: unknown[]) {
  if (typeof __DEV__ === "undefined" || !__DEV__ || !AI_TRACE) return;
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
    devTrace("endpoint not configured; skip remote", { feature });
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    devTrace("request", { feature, endpointHost: config.endpoint.replace(/\/api\/ai\/?$/, "") });

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
      devTrace("invalid JSON body", { feature, fallbackUsed: true });
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
    const provider = typeof o.provider === "string" ? o.provider : "gemini";
    const model = typeof o.model === "string" ? o.model : "";

    if (!success) {
      devTrace("server reported failure", { feature, provider, fallbackUsed: true, error: error || "unknown" });
      return { success: false, provider, model, content: "", structured, error: error || "AI error" };
    }

    devTrace("ok", { feature, provider, model, fallbackUsed: false });
    return { success: true, provider, model, content, structured, error: null };
  } catch {
    clearTimeout(timer);
    devTrace("network/timeout", { feature, fallbackUsed: true });
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
  if (res?.success && res.content.trim()) {
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
      headline: "Error",
      detail: res.error || "AI server returned an error.",
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

/** SmartGX Assistant: chat transcript → natural language reply */
export async function invokeAssistantChat(
  messages: AssistantChatMessage[],
  config: AiConfig = getAiConfig()
): Promise<string | null> {
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

  if (!res?.success) return null;
  const text = res.content?.trim() ?? "";
  return text.length > 0 ? text : null;
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
  gxhealth_analysis: "gxhealth",
  transaction_insight: "transaction_insight",
  smart_nudge: "nudge",
  critical_reason: "critical_reason",
  receipt_classify: "income_classification",
  debt_readiness: "debt_readiness",
  scam_message: "scam_check",
  security_recommendation: "security",
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
    model: res.model,
    content: res.content,
    structured: res.structured,
    error: res.error,
  });

  return new Response(body, {
    status: res.success ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
}
