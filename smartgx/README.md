# SmartGX (Expo)

SmartGX behavioural finance experience — React Native Expo + Expo Router.

## AI (Gemini via local proxy)

- **Never** put `GEMINI_API_KEY` or `EXPO_PUBLIC_GEMINI_API_KEY` in this app.
- Run **`smartgx-ai-server`** locally and point the app at it with **`EXPO_PUBLIC_SMARTGX_AI_ENDPOINT`** (see `smartgx/.env.example`).
- If the server is offline or misconfigured, SmartGX falls back to rule-based / FAQ text and does not crash.

Canonical client: `src/services/ai/ai.config.ts`, `src/services/ai/ai.client.ts`, assistant FAQ + fallback: `src/services/ai/assistant.service.ts`.

### Quick endpoint examples

- Web / same PC: `http://localhost:3001/api/ai`
- Android emulator: `http://10.0.2.2:3001/api/ai`
- Physical phone: `http://<your-computer-Wi-Fi-IPv4>:3001/api/ai` (not `localhost` on the phone)

## Supabase (optional)

Copy `.env.example` to `.env`. Use anon / publishable keys only; enable RLS in the database for production patterns.

## Run

```bash
npm install
npx expo start
```

After changing `.env`, prefer:

```bash
npx expo start --clear
```
