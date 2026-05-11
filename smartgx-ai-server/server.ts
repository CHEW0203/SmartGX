import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { generateWithGemini, logModelConfig, pickModel } from "./src/providers/gemini.js";

/** Always load `.env` next to this file — not from `process.cwd()` (fixes wrong folder when starting from repo root). */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");
const envResult = dotenv.config({ path: envPath });
if (envResult.error) {
  console.warn(`[SmartGX AI] No .env loaded from ${envPath} (${envResult.error.message}). Create this file from .env.example`);
}

function geminiKeyConfigured(): boolean {
  const raw = process.env.GEMINI_API_KEY ?? "";
  return raw.replace(/\s+/g, "").length > 0;
}

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
  })
);
app.use(express.json({ limit: "512kb" }));

const ALLOWED_FEATURES = new Set([
  "assistant",
  "gxhealth_analysis",
  "gxhealth_recommended_action",
  "transaction_insight",
  "smart_ai_nudge",
  "critical_risk_nudge",
  "income_classification",
  "flexicredit_debt_readiness",
  "scam_message_check",
  "security_risk_check",
  "saving_allocation_explanation",
  "tree_health",
  "mission",
  "smartscore",
]);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    provider: "gemini",
    hasGeminiKey: geminiKeyConfigured(),
    defaultModel: (process.env.GEMINI_MODEL_DEFAULT || "gemini-2.5-flash").trim(),
    deepModel: pickModel("critical_risk_nudge"),
    port: PORT,
  });
});

app.post("/api/ai", async (req, res) => {
  try {
    const body = req.body as { feature?: string; prompt?: string; context?: unknown };
    const feature = typeof body.feature === "string" ? body.feature.trim() : "";
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    const context =
      body.context && typeof body.context === "object" && body.context !== null
        ? (body.context as Record<string, unknown>)
        : {};

    const modelForFeature = feature && ALLOWED_FEATURES.has(feature) ? pickModel(feature) : "n/a";
    console.log(
      `[SmartGX AI] [Request Received] feature=${feature || "(empty)"} model=${modelForFeature}` +
        ` promptLength=${prompt.length} contextKeys=${Object.keys(context).join(",") || "(none)"}`
    );

    if (!feature || !ALLOWED_FEATURES.has(feature)) {
      console.log(`[SmartGX AI] [Request Rejected] feature=${feature || "(empty)"} reason=invalid_feature`);
      return res.status(400).json({
        success: false,
        provider: "fallback",
        feature: feature || "unknown",
        model: "",
        content: "",
        structured: {},
        error: `Invalid or missing feature. Allowed: ${[...ALLOWED_FEATURES].join(", ")}`,
        fallbackReason: "invalid_feature",
      });
    }

    if (!prompt.trim()) {
      console.log(`[SmartGX AI] [Request Rejected] feature=${feature} reason=missing_prompt`);
      return res.status(400).json({
        success: false,
        provider: "fallback",
        feature,
        model: "",
        content: "",
        structured: {},
        error: "Missing prompt",
        fallbackReason: "missing_prompt",
      });
    }

    const out = await generateWithGemini({ feature, prompt, context });
    return res.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const errName = e instanceof Error ? (e.constructor?.name || e.name || "Error") : "Unknown";
    const feature = typeof (req.body as { feature?: string })?.feature === "string" ? String((req.body as { feature: string }).feature) : "unknown";
    console.error(
      `[SmartGX AI] feature=${feature} provider=fallback success=false fallbackReason=server_exception` +
        ` errorName=${errName} message="${msg.slice(0, 400)}"`
    );
    return res.json({
      success: false,
      provider: "fallback",
      feature,
      model: (process.env.GEMINI_MODEL_DEFAULT || "gemini-2.5-flash").trim(),
      content: "",
      structured: {},
      error: msg,
      fallbackReason: "server_exception",
      debugError: `Server exception: ${errName}`,
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  const ok = geminiKeyConfigured();
  console.log(`[SmartGX AI] listening on 0.0.0.0:${PORT}  POST /api/ai  GET /health`);
  console.log(`[SmartGX AI] Loaded .env from: ${envPath}`);
  console.log(`[SmartGX AI] GEMINI_API_KEY: ${ok ? "configured" : "MISSING — all requests will use fallback"}`);
  logModelConfig();
});
