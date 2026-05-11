# SmartGX AI server (Gemini proxy)

Runs a small Express API so the **Expo app never sees your Gemini API key**.

## Endpoints

- `GET /health` — `{ ok, provider, hasGeminiKey, port }`
- `POST /api/ai` — body: `{ feature, prompt, context }` (see app `SmartGxAiFeature` types)

Features include: `assistant`, `gxhealth_analysis`, `gxhealth_recommended_action`, `transaction_insight`, `smart_ai_nudge`, `critical_risk_nudge`, `income_classification`, `flexicredit_debt_readiness`, `scam_message_check`, `security_risk_check`, `saving_allocation_explanation`, `tree_health`, `mission`, `smartscore`.

Each successful request logs a single line: `feature`, `provider`, `model`, and `success` (never the API key or full prompt).

## Setup

```bash
cd smartgx-ai-server
npm install
```

Copy env (do not commit `.env`):

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set at least:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL_DEFAULT=gemini-2.5-flash
GEMINI_MODEL_DEEP=gemini-2.5-pro
PORT=3001
```

## Run

```bash
npm run dev
```

Hot reload while editing:

```bash
npm run dev:watch
```

Default: `http://localhost:3001` — the process binds to **`0.0.0.0`** so devices on your LAN can use `http://<PC-LAN-IP>:3001`.

Logs show whether `GEMINI_API_KEY` is set; the key itself is never printed.

## Expo app

In `smartgx/.env`:

```env
EXPO_PUBLIC_SMARTGX_AI_ENDPOINT=http://localhost:3001/api/ai
```

Physical device on same Wi‑Fi: use your computer’s IPv4, e.g. `http://192.168.1.10:3001/api/ai`.

Restart Expo after changing env (`npx expo start --clear`).
