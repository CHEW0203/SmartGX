import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { generateWithGemini } from "./src/providers/gemini.js";

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
  "gxhealth",
  "transaction_insight",
  "nudge",
  "critical_reason",
  "income_classification",
  "debt_readiness",
  "scam_check",
  "security",
  "tree_health",
  "mission",
  "smartscore",
]);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    provider: "gemini",
    hasGeminiKey: geminiKeyConfigured(),
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

    if (!feature || !ALLOWED_FEATURES.has(feature)) {
      return res.status(400).json({
        success: false,
        provider: "gemini",
        model: "",
        content: "",
        structured: {},
        error: `Invalid or missing feature. Allowed: ${[...ALLOWED_FEATURES].join(", ")}`,
      });
    }

    if (!prompt.trim()) {
      return res.status(400).json({
        success: false,
        provider: "gemini",
        model: "",
        content: "",
        structured: {},
        error: "Missing prompt",
      });
    }

    const out = await generateWithGemini({ feature, prompt, context });
    return res.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return res.json({
      success: false,
      provider: "gemini",
      model: (process.env.GEMINI_MODEL_DEFAULT || "").trim(),
      content: "",
      structured: {},
      error: msg,
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  const ok = geminiKeyConfigured();
  console.log(`[SmartGX AI] listening on 0.0.0.0:${PORT}  POST /api/ai  GET /health`);
  console.log(`[SmartGX AI] Loaded .env from: ${envPath}`);
  console.log(`[SmartGX AI] GEMINI_API_KEY: ${ok ? "set" : "missing"}`);
});
