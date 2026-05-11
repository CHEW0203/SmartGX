# 💎🥇SmartGX🥇💎

SmartGX is an AI-powered financial resilience banking prototype built on top of the GXBank digital banking experience. It is designed for Malaysian youth and helps users save consistently, spend consciously, borrow responsibly, and stay protected through automation, AI nudges, gamification, debt prevention, and security features.

SmartGX extends GXBank’s digital banking foundation by adding a proactive financial behaviour layer that guides users before they overspend, overborrow, or face financial risk.



## 🚀 One-Line Pitch

**SmartGX builds on the GXBank digital banking experience with AI-powered financial resilience features that help young Malaysians save before spending, think before borrowing, build lasting financial habits, and stay protected before risk happens.**

---
## 🎬 Prototype Demo Video

🎥[Watch Our 5 minutes demo video HERE](https://youtu.be/HW9YpOfzaoI)

---

## 📊 Project Pitch Deck

📑[View Our Project Pitch Deck HERE](https://drive.google.com/drive/folders/1GpYSdzXqdRjBM9Gvm09-OfSVC3LoYS63?usp=drive_link)

---
## 📌 Project Context

This project is developed for the **Youth Resilience Challenge** case study.

The challenge focuses on the issue that many Malaysian students and fresh graduates fall into debt traps early in their careers or struggle to manage money for future planning such as saving and investing.

Current banking tools usually provide transaction history and balance information, but they often lack proactive, actionable intervention.

SmartGX addresses this gap by turning banking from a passive storage and transaction-viewing tool into an active, automated habit-building system.

---

## 💡 Core Idea

```text
SmartGX makes financial resilience the default behaviour for Malaysian youth.
```

Instead of only showing users what happened after they spent money, SmartGX actively helps users:

- allocate income automatically
- build saving habits
- detect risky spending patterns
- receive contextual AI nudges
- avoid using future money
- reduce debt risk
- participate in financial resilience campaigns
- compete with friends through Challenge Garden
- improve safe banking behaviour

---

## 🎯 Product Positioning

SmartGX is:

- an AI financial resilience layer
- a mobile banking feature concept
- a GXBank ecosystem enhancement
- a behavioural finance prototype
- a hackathon MVP

SmartGX is not:

- a new bank
- a real banking system
- a GXBank replacement
- a normal expense tracker
- a real payment or lending platform

---

## 👥 Target Users

SmartGX is designed for:

- Malaysian tertiary students
- fresh graduates
- early-career workers
- young people receiving salary, allowance, part-time income, or cash income
- users who know saving is important but struggle with consistent action
- users at risk of overspending, BNPL dependency, or credit overuse

---

## ❗ Problem Statement

Many students and young adults understand the importance of saving and budgeting, but struggle to build consistent financial habits.

Common issues include:

- weak saving discipline after receiving income
- impulsive spending
- poor cashflow awareness
- overuse of credit or future money
- lack of real-time guidance before risky transactions
- low motivation to maintain good financial habits
- security risks such as scams, weak PINs, and suspicious activity

SmartGX addresses these problems by guiding users before, during, and after important financial decisions.

---

## 💡 Solution Overview

SmartGX is designed as an AI-powered financial resilience layer built on top of GXBank’s digital banking experience.

While GXBank provides the core digital banking foundation such as account management, transfers, card usage, savings, and FlexiCredit, SmartGX enhances the experience with AI-driven financial behaviour support.

Instead of only showing balances and transactions, SmartGX helps users answer:

- Can I afford this transaction?
- Is this financial action risky?
- Should I save instead?
- Am I borrowing responsibly?
- How can I improve my financial health?

SmartGX focuses on helping young users make better financial decisions before risk happens.

---

---
## ✨ Key Features

- **Dashboard** with account overview, quick actions, latest activity, GXHealth, campaigns, and Money Tree
- **Saving & Automation** with Bonus, Emergency, Goals, auto allocation, round-up saving, daily interest estimate, and saving withdrawal
- **GXHealth** financial health score with AI-ready analysis and recommendations
- **Transaction Intelligence** with income and expense tracking, charts, forecasts, and SmartGX insights
- **AI Nudge & Soft Friction** for risky payments, transfers, credit usage, and borrowing
- **FlexiCredit Debt Prevention** with eligibility check, document flow, AI Debt Readiness, drawdown, repayment, and interest calculation
- **Gamification** with Saving Streak, SmartScore leaderboard, missions, water system, and Money Tree
- **Challenge Garden** where friends compete in time-limited financial habit challenges, complete daily missions, grow separate challenge trees, and earn Bonus Rewards based on tree growth and Challenge SmartScore
- **Campaigns** such as saving challenges, round-up challenges, and debt-free campaigns
- **Security Center** with 6-digit PIN setup, Device Safety Check, Scam Protection, and Emergency Lock
- **SmartGX Assistant** with quick questions and AI-powered prompt support

---

## 🛠️ Technology & System Architecture

SmartGX is built as a **GXBank ecosystem enhancement**. It keeps the core structure of a digital banking system while adding an **AI-powered financial resilience layer** for saving behaviour, spending control, responsible borrowing, motivation, and security protection.

### Frontend

The frontend is built with:

- **React Native** — cross-platform mobile app development
- **Expo** — app development and device testing
- **TypeScript** — safer and more maintainable code
- **Expo Router** — screen navigation and routing
- **Expo SecureStore** — secure local session storage

The mobile app provides the user-facing banking experience, including account management, transfers, card flows, savings, GXHealth, FlexiCredit, gamification, campaigns, security, and SmartGX Assistant.

### Backend & Data Layer

The backend and data layer are supported by:

- **Supabase Auth** — registration, login, and session persistence
- **Supabase PostgreSQL** — storage for user profiles, balances, savings, transactions, notifications, GXHealth, FlexiCredit, gamification progress, and security settings

This allows SmartGX to behave like a connected banking system instead of a static prototype.

### AI Server

The AI layer is handled by:

- **Node.js**
- **Express**
- **Gemini API**
- **Local AI proxy server**
- **Rule-based fallback logic**

The AI server is separated from the mobile app so that API keys are not exposed in the frontend.

### How SmartGX Builds on GXBank

SmartGX follows the existing GXBank digital banking structure, then extends it with behavioural finance features:

| GXBank Foundation | SmartGX Enhancement |
|---|---|
| Main Account | Real-time GXHealth-linked account behaviour |
| Savings / Savings Pockets | Bonus, Emergency, Goals, auto allocation, streak rewards |
| Debit Card | Debit card usage linked with AI spending risk |
| FlexiCredit | AI Debt Readiness, Safe Drawdown, soft friction before borrowing |
| Digital banking security | Security Score, Scam Protection, Device Safety Check, Emergency Lock |
| Campaigns and rewards | Behaviour-based campaigns, SmartScore, Money Tree, and Challenge Garden |

In short:

> **GXBank provides the digital banking foundation. SmartGX adds the AI-driven financial resilience layer on top of it.**
---

## 📁 Project Structure

```text
SMARTGX/
├── smartgx/                     # Expo mobile app
│   ├── app/                     # App routes and screens
│   ├── assets/                  # Images and static assets
│   ├── src/                     # Components, services, stores, and utilities
│   ├── supabase/                # Supabase schema / database setup
│   ├── .env                     # Local Expo environment variables
│   ├── .env.example             # Expo environment variable template
│   ├── .gitignore
│   ├── app.json
│   ├── App.tsx
│   ├── index.ts
│   ├── package.json
│   ├── package-lock.json
│   ├── README.md
│   └── tsconfig.json
│
├── smartgx-ai-server/           # Local AI backend server
│   ├── src/                     # AI provider / AI service logic
│   ├── .env                     # Local AI server environment variables
│   ├── .env.example             # AI server environment variable template
│   ├── .gitignore
│   ├── package.json
│   ├── package-lock.json
│   ├── README.md
│   ├── server.ts
│   └── tsconfig.json
│
├── LICENSE
├── package-lock.json
└── README.md
```

The Expo app root is:

```text
SMARTGX/smartgx
```

The AI server root is:

```text
SMARTGX/smartgx-ai-server
```

---

## ⚙️ Environment Setup

SmartGX has two parts:

1. **Expo mobile app** — the main SmartGX application
2. **AI server** — local backend used to connect SmartGX with Gemini AI safely

The Gemini API key is placed inside the AI server, not inside the Expo mobile app.

```text
SmartGX Expo App
→ smartgx-ai-server
→ Gemini API
```

---

## 1. Clone the Repository

```bash
git clone https://github.com/CHEW0203/SmartGX.git
cd SmartGX
```

---

## 2. Install Expo App Dependencies

Go to the Expo app folder:

```bash
cd smartgx
```

Install dependencies:

```bash
npm install
```

Create the Expo app `.env` file:

```bash
cp .env.example .env
```

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The Expo app environment file is located at:

```text
SMARTGX/smartgx/.env
```

---

## 3.🔐 Supabase Setup

SmartGX uses Supabase for authentication, persistent user session, account balance, transactions, savings, notifications, GXHealth, FlexiCredit data, gamification progress, and security settings.

SmartGX supports two Supabase setup options.

### Option 1: Use the Default Hosted Supabase Project

For quick hackathon testing, reviewers may use the default hosted Supabase configuration provided in `.env.example`.

This allows the app to run without setting up a new Supabase project.

Inside:

```text
SMARTGX/smartgx/.env
```

use:

```env
EXPO_PUBLIC_SUPABASE_URL=https://ouqhyjildwfktughxrfj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_gYlSoU1N8Fwnyp3lQQ0cbw_VdvY5lbd
```

### Option 2: Use Your Own Supabase Project

If you prefer to use your own database:

1. Create a Supabase project.
2. Run the SQL schema inside:

```text
SMARTGX/smartgx/supabase/
```

3. Replace the Supabase values in `.env` with your own project URL and anon key.

Example:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> Only use the Supabase anon / publishable key in the Expo app.  
> Do not expose any Supabase service role key.

---

## 4. Install AI Server Dependencies

Open a **new terminal** from the root folder:

```bash
cd SmartGX
cd smartgx-ai-server
```

Install dependencies:

```bash
npm install
```

Create the AI server `.env` file:

```bash
cp .env.example .env
```

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The AI server environment file is located at:

```text
SMARTGX/smartgx-ai-server/.env
```

Fill in:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL_DEFAULT=gemini-2.5-flash
GEMINI_MODEL_DEEP=gemini-2.5-pro
PORT=3001
```

> Do not put `GEMINI_API_KEY` inside the Expo app `.env`.

Wrong:

```env
EXPO_PUBLIC_GEMINI_API_KEY=your_key
```

Correct:

```env
GEMINI_API_KEY=your_key
```

inside:

```text
SMARTGX/smartgx-ai-server/.env
```

---

## 5. Choose the Correct AI Endpoint

The Expo app must know where the AI server is running.

This value is placed inside:

```text
SMARTGX/smartgx/.env
```

as:

```env
EXPO_PUBLIC_SMARTGX_AI_ENDPOINT=your_ai_server_endpoint
```

### If Running on Web or Local Computer

Use:

```env
EXPO_PUBLIC_SMARTGX_AI_ENDPOINT=http://localhost:3001/api/ai
```

### If Running on Android Emulator

Use:

```env
EXPO_PUBLIC_SMARTGX_AI_ENDPOINT=http://10.0.2.2:3001/api/ai
```

### If Running on a Physical Phone

`localhost` will not work on a real phone because the phone cannot access your computer’s localhost.

You must use your computer’s Wi-Fi IP address.

On Windows PowerShell, run:

```powershell
ipconfig
```

Find:

```text
Wireless LAN adapter Wi-Fi
IPv4 Address . . . . . . . . . . : 192.168.x.x
```

Example:

```text
IPv4 Address: 192.168.1.25
```

Then update:

```text
SMARTGX/smartgx/.env
```

with:

```env
EXPO_PUBLIC_SMARTGX_AI_ENDPOINT=http://192.168.1.25:3001/api/ai
```

Use your own computer IP address.

> Your phone and computer must be connected to the same Wi-Fi network.

---

## 6. Final Expo `.env` Example

For local web testing:

```env
EXPO_PUBLIC_SUPABASE_URL=https://ouqhyjildwfktughxrfj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_gYlSoU1N8Fwnyp3lQQ0cbw_VdvY5lbd
EXPO_PUBLIC_SMARTGX_AI_ENDPOINT=http://localhost:3001/api/ai
```

For physical phone testing:

```env
EXPO_PUBLIC_SUPABASE_URL=https://ouqhyjildwfktughxrfj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_gYlSoU1N8Fwnyp3lQQ0cbw_VdvY5lbd
EXPO_PUBLIC_SMARTGX_AI_ENDPOINT=http://192.168.1.25:3001/api/ai
```

Replace `192.168.1.25` with your own computer IP address.

---

## ▶️ Running the Project

You need **two terminals**.

---

### Terminal 1: Start the AI Server

From the root folder:

```bash
cd smartgx-ai-server
npm run dev
```

The AI server should run on:

```text
http://localhost:3001
```

To check if the AI server is running, open:

```text
http://localhost:3001/health
```

Expected response:

```json
{
  "ok": true,
  "service": "SmartGX AI",
  "geminiKeyConfigured": true
}
```

If `geminiKeyConfigured` is `false`, check that:

- `smartgx-ai-server/.env` exists
- `GEMINI_API_KEY` is added
- the AI server was restarted after editing `.env`

---

### Terminal 2: Start the Expo App

Open another terminal from the root folder:

```bash
cd smartgx
npx expo start --clear
```

Run on Android emulator:

```bash
press a
```

Or scan the Expo QR code using a physical phone.

> If you changed `.env`, restart Expo using `npx expo start --clear`.

---

## 🧪 Testing AI Connection


### 1. Test Inside the App

Open **SmartGX Assistant** and ask:

```text
What is GXHealth?
```

If AI is connected, the response should come from Gemini.

If AI is not connected, SmartGX will use fallback logic.



---

## 🧠 AI Features

SmartGX uses AI for:

- SmartGX Assistant
- GXHealth analysis
- Transaction insight and month-end forecast
- AI Nudge explanation
- Critical risk reason analysis
- Income classification
- FlexiCredit Debt Readiness Review
- Scam Protection
- Security Recommendation
- Money Tree health explanation
- Mission Recommendation
- SmartScore explanation

If Gemini is unavailable, SmartGX falls back to local rule-based logic.

---

## 🚀 Future Enhancements

1. **Real Banking API Integration**  
   Integrate SmartGX with real GXBank banking APIs so balances, transfers, card activity, savings, and FlexiCredit data can be synchronized with actual banking records in real time.

2. **Advanced AI Personalization**  
   Expand the AI engine with long-term behavioural learning, personalized spending forecasts, adaptive saving plans, and more accurate debt-risk prediction based on each user’s historical financial behaviour.

3. **Open Finance and Wider Ecosystem Integration**  
   Connect SmartGX with external financial sources such as e-wallets, BNPL platforms, investment accounts, and credit records to provide a more complete view of the user’s financial health and detect hidden debt risks earlier.
---
## 📌 Case Study Impact

SmartGX helps young users:

- save automatically
- build emergency savings
- understand spending behaviour
- avoid impulsive transactions
- reduce risky credit usage
- borrow more responsibly
- stay motivated through rewards and friend-based challenges
- build financial discipline through repeated daily missions
- protect their account from scams and security risks

---

## 🏆 Why SmartGX Stands Out

| Normal Banking App | SmartGX |
|---|---|
| Shows balance | Explains financial health |
| Shows transactions | Analyzes financial behaviour |
| Allows transfer | Checks risk before transfer |
| Offers credit | Evaluates debt readiness |
| Basic rewards | Saving Streak, Money Tree, SmartScore, and Challenge Garden |
| Basic security | Security Center and Scam Protection |

---

## 👥 Team

**SmartGX Team**

---

## 📄 License

This project is developed for hackathon, academic, and prototype demonstration purposes.
