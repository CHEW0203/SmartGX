# SmartGX

SmartGX is an AI-powered behavioural financial resilience mobile app prototype built as a proposed enhancement layer on top of GXBank Malaysia.

It is designed for Malaysian tertiary students, fresh graduates, and early-career workers who understand the importance of saving but struggle to turn financial awareness into consistent financial action.

SmartGX does not replace GXBank. Instead, it demonstrates how GXBank’s existing digital banking ecosystem can be enhanced with AI, behavioural economics, automation, gamification, and security awareness to help young users save automatically, control spending, avoid debt, and build long-term financial resilience.

---

## Project Context

This project is developed for the **Youth Resilience Challenge** case study.

The challenge focuses on the issue that many Malaysian students and fresh graduates fall into debt traps early in their careers or struggle to manage money for future planning such as saving and investing.

Current banking tools usually provide transaction history and balance information, but they often lack proactive, actionable intervention.

SmartGX addresses this gap by turning banking from a passive storage and transaction-viewing tool into an active, automated habit-building system.

---

## Core Idea

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
- improve safe banking behaviour

---

## Product Positioning

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

## Target Users

SmartGX is designed for:

- Malaysian tertiary students
- fresh graduates
- early-career workers
- young people receiving salary, allowance, part-time income, or cash income
- users who know saving is important but struggle with consistent action
- users at risk of overspending, BNPL dependency, or credit overuse

---

## Key Features

### 1. AI Financial Health Score

SmartGX calculates a financial health score based on:

- savings rate
- spending control
- debt risk
- emergency fund progress
- security behaviour

The score gives users a quick view of their financial condition and provides AI-style recommendations.

---

### 2. Salary Auto Allocation

When salary or income is received, SmartGX automatically allocates it into different financial buckets.

Example:

```text
RM3000 Salary
60% Spending Wallet = RM1800
20% Bonus Pocket = RM600
10% Emergency Fund = RM300
10% Goal Savings = RM300
```

This reduces reliance on user discipline and makes saving the default behaviour.

---

### 3. Manual Income Allocation

SmartGX also supports users who receive cash income, part-time salary, allowance, or family support.

Users can manually add income, and SmartGX can apply the same automatic allocation rule.

---

### 4. Round-up Savings

SmartGX can round up spending and save the difference automatically.

Example:

```text
User spends RM12.40
SmartGX rounds it up to RM13.00
RM0.60 goes to savings
```

---

### 5. AI Behavioural Nudges

SmartGX provides contextual and actionable nudges based on user behaviour.

Example:

```text
Your food spending is 38% higher than your weekly average.
If you limit food delivery to RM25 for the next 3 days, your cashflow will stay safe until payday.
```

The goal is to move beyond generic financial advice and provide guidance that is relevant to the user’s current situation.

---

### 6. Soft Friction

SmartGX does not hard block spending by default.

Instead, it uses behavioural nudges and soft friction, such as:

- spending warnings
- confirmation prompts
- delay purchase options
- impact preview on month-end balance
- option to move money into savings instead

This preserves user freedom while encouraging better financial decisions.

---

### 7. Debt Risk Detection

SmartGX includes a debt prevention layer that detects:

- high credit usage
- BNPL-like spending
- repeated borrowing behaviour
- low remaining balance
- risky FlexiCredit-style usage

The system warns users before they become dependent on future money.

---

### 8. Future Money Blocker

Future Money Blocker is a key SmartGX feature that warns users when they are about to rely on money they do not currently have.

Example:

```text
You are about to use future money.
SmartGX recommends using available balance or delaying this purchase to avoid debt risk.
```

---

### 9. Gamification and Rewards

SmartGX uses gamification to encourage long-term habit formation.

Features include:

- saving streaks
- badges
- weekly missions
- milestone rewards
- leaderboard
- friend challenges

Example badges:

- First Auto Save
- 7-Day Saving Streak
- No Overspend Week
- Emergency Fund Builder
- Debt Defender
- Scam Aware Banker

---

### 10. Campaigns

SmartGX proposes financial resilience campaigns that encourage healthy behaviour instead of only promoting spending.

Example campaigns:

- RM5 Daily Save Challenge
- No Overspend Week
- Emergency Fund Sprint
- Round-up Booster
- Debt-Free Month
- Safe Banking Challenge

---

### 11. Security and Anti-Malware Awareness

SmartGX also includes a supporting security module because financial resilience includes protecting money from scams and unsafe banking behaviour.

Features include:

- Security Score
- scam-risk warning
- suspicious transaction alert
- safe banking checklist
- anti-malware tips
- Cyber Fraud Protect awareness

---

## GXBank Product Foundation

SmartGX is designed as an enhancement to GXBank’s existing product ecosystem.

The prototype simulates improvements to:

- GX Account / Savings Account
- GX Card / Debit Card
- Bonus Pocket
- FlexiCredit / borrowing risk
- Rewards
- Campaigns
- Cyber Fraud Protect / Security / Anti-Malware

---

## Main Demo Flow

The intended demo story is:

1. User logs in as a fresh graduate.
2. Dashboard shows RM3000 salary received.
3. SmartGX automatically allocates:
   - RM1800 to Spending Wallet
   - RM600 to Bonus Pocket
   - RM300 to Emergency Fund
   - RM300 to Goal Savings
4. User views GX Card transactions.
5. SmartGX detects risky spending.
6. AI nudge appears.
7. Soft friction modal appears.
8. User checks Debt Risk screen.
9. Future Money Blocker appears.
10. User checks Rewards.
11. Saving streak, badges, missions, and leaderboard are shown.
12. User checks Campaigns.
13. No Overspend Week is recommended.
14. User checks Security.
15. Scam-risk and anti-malware reminders are shown.

---

## Tech Stack

SmartGX is built using:

- React Native
- Expo
- TypeScript
- Expo Router
- Zustand
- Mock data
- Supabase-ready architecture
- Mock authentication

---

## Why React Native Expo?

SmartGX is a mobile banking prototype, so a mobile-first framework is more suitable than a web-first framework.

Expo is used because it allows fast mobile app development and quick testing through Expo Go.

---

## Why Not Next.js?

Next.js is suitable for web applications and dashboards.

SmartGX is intended to feel like a mobile banking feature inside GXBank, so React Native Expo is more appropriate for this prototype.

---

## Current Development Status

This repository is currently in early development.

The project is being built phase by phase.

Initial focus:

- project setup
- folder structure
- theme files
- mock data
- authentication
- dashboard
- financial health score
- savings automation

---

## Project Structure

```text
smartgx/
│
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── auth/
│   ├── dashboard.tsx
│   ├── transactions.tsx
│   ├── savings.tsx
│   ├── rewards.tsx
│   ├── campaigns.tsx
│   ├── debt-risk.tsx
│   ├── security.tsx
│   └── profile.tsx
│
├── src/
│   ├── components/
│   ├── features/
│   ├── data/
│   ├── lib/
│   ├── hooks/
│   ├── store/
│   ├── theme/
│   └── types/
│
├── assets/
├── PROJECT_BRIEF.md
├── TODO.md
├── .env.example
├── app.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## Installation

Clone the repository:

```bash
git clone <repository-url>
cd smartgx
```

Install dependencies:

```bash
npm install
```

Start the Expo development server:

```bash
npx expo start
```

---

## Running the App

### Using Expo Go

1. Install Expo Go on your iOS or Android device.
2. Run:

```bash
npx expo start
```

3. Scan the QR code using:
   - iPhone Camera app
   - Expo Go scanner on Android

### Using Web Preview

If web dependencies are installed, run:

```bash
npx expo start
```

Then press:

```text
w
```

Note: SmartGX is designed as a mobile app, so mobile preview is recommended.

---

## Environment Variables

Create a `.env.example` file:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The MVP should run with mock data even without real Supabase credentials.

---

## Demo Accounts

```text
Student:
Email: jason@student.my
Password: password123

Fresh Graduate:
Email: aina@freshgrad.my
Password: password123
```

---

## Development Approach

SmartGX should be developed phase by phase.

Main phases:

1. Project setup
2. Folder structure, theme, types, and mock data
3. Authentication and navigation
4. Dashboard MVP
5. Financial Health Score engine
6. Savings and automation
7. Transactions and GX Card spending
8. AI nudges and soft friction
9. Debt prevention and FlexiCredit risk
10. Rewards and gamification
11. Campaigns
12. Security and anti-malware awareness
13. Profile and settings
14. Demo flow integration
15. UI polish and final testing

---

## Important Development Rules

- Use TypeScript.
- Use React Native Expo.
- Use Expo Router.
- Use Zustand for state management.
- Use mock data first.
- Keep the app Supabase-ready.
- Do not require real GXBank API.
- Do not require real payment integration.
- Do not build a real lending system.
- Do not hard block spending by default.
- Use soft friction and behavioural nudges.
- Keep business logic separate from UI.
- Prioritise a working hackathon demo over production completeness.

---

## Disclaimer

SmartGX is a hackathon prototype and conceptual product proposal.

It does not represent an official GXBank product.

It does not process real banking transactions, real payments, real credit applications, or real user financial data.

All financial data used in the prototype should be mock data for demonstration purposes only.

---

## License

This project is currently for hackathon and educational use.