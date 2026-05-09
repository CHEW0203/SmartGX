import { GoogleGenerativeAI } from "@google/generative-ai";

export type AiFeature =
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

export interface GeminiCallInput {
  feature: string;
  prompt: string;
  context: Record<string, unknown>;
}

export interface NormalizedAiResponse {
  success: boolean;
  provider: string;
  model: string;
  content: string;
  structured: Record<string, unknown>;
  error: string | null;
}

function defaultModel(): string {
  return (process.env.GEMINI_MODEL_DEFAULT || "gemini-2.5-flash").trim();
}

function deepModel(): string {
  const d = (process.env.GEMINI_MODEL_DEEP || "").trim();
  return d || defaultModel();
}

/** Heavier reasoning features use pro when GEMINI_MODEL_DEEP is set. */
export function pickModel(feature: string): string {
  const deepFeatures = new Set([
    "nudge",
    "critical_reason",
    "debt_readiness",
    "scam_check",
    "security",
  ]);
  if (deepFeatures.has(feature)) return deepModel();
  return defaultModel();
}

const SMARTGX_SYSTEM_INSTRUCTION = [
  "You are SmartGX AI.",
  "Give concise, practical financial guidance for mobile users.",
  "For Malaysian users, write money only as Malaysian Ringgit (RM), e.g. RM100 or RM1,200. Do not use $, USD, or dollars unless the user explicitly asks.",
  "Use the provided user context when present.",
  "Explain financial behaviour clearly in plain language.",
  "Do not claim to be a real bank employee or regulator.",
  "Do not guarantee investment returns or financial outcomes.",
  "Do not approve unsafe financial actions blindly; warn when something looks risky.",
  "For banking and security actions, you explain and recommend only—hard rules and the app control blocking, limits, PIN, and locks.",
  "Use SmartGX branding only; do not name unrelated competitor banks.",
].join(" ");

export async function generateWithGemini(input: GeminiCallInput): Promise<NormalizedAiResponse> {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  const provider = "gemini";

  if (!apiKey) {
    return {
      success: false,
      provider,
      model: defaultModel(),
      content: "",
      structured: {},
      error: "GEMINI_API_KEY is not set in smartgx-ai-server/.env",
    };
  }

  const modelName = pickModel(input.feature);
  let content = "";
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const longFormFeatures = new Set(["gxhealth", "transaction_insight"]);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: `${SMARTGX_SYSTEM_INSTRUCTION}\n\nCurrent feature: ${input.feature}.`,
      generationConfig: {
        maxOutputTokens: longFormFeatures.has(input.feature) ? 2048 : 1024,
        temperature: 0.35,
      },
    });

    const fullPrompt =
      `Context (JSON, may be partial):\n${JSON.stringify(input.context).slice(0, 12000)}\n\n` +
      `Task:\n${input.prompt}`;

    const result = await model.generateContent(fullPrompt);
    content = (await result.response.text()).trim();

    let structured: Record<string, unknown> = {};
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          structured = parsed as Record<string, unknown>;
        }
      } catch {
        /* keep text-only */
      }
    }

    return {
      success: true,
      provider,
      model: modelName,
      content,
      structured,
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gemini request failed";
    return {
      success: false,
      provider,
      model: modelName,
      content: content || "",
      structured: {},
      error: msg,
    };
  }
}
