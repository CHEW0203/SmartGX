# SmartGX Project Brief

## 1. Project Positioning

SmartGX is an AI-powered behavioural financial resilience layer built on top of GXBank Malaysia.

SmartGX is not a new bank, not a GXBank replacement, and not a normal expense tracker.

SmartGX is a proposed mobile feature enhancement for GXBank that helps Malaysian students and fresh graduates save automatically, control spending, avoid debt, and build long-term financial habits.

Core idea:

```text
SmartGX turns GXBank from a passive digital banking app into an active, AI-driven behavioural banking system.
```

---

## 2. Problem

Malaysian tertiary students and fresh graduates often understand that saving is important, but they fail to act consistently.

The real issue is the gap between:

```text
financial awareness
and
consistent financial action
```

Common problems:

- overspending after salary or allowance
- poor budgeting
- lack of emergency fund
- inconsistent saving
- BNPL or credit dependency
- low awareness of future cashflow
- late reaction to debt risk

SmartGX solves this by making healthy financial behaviour automatic and default.

---

## 3. Target Users

Primary users:

- Malaysian tertiary students
- fresh graduates
- early-career workers
- young users receiving salary, allowance, part-time income, or cash income

Demo users:

```text
Student:
Name: Jason Tan
Email: jason@student.my
Password: password123
Monthly allowance: RM1200

Fresh Graduate:
Name: Aina Rahman
Email: aina@freshgrad.my
Password: password123
Monthly salary: RM3000
```

---

## 4. Product Goal

SmartGX helps users:

- automatically allocate income
- save consistently
- receive AI spending guidance
- avoid risky spending
- reduce debt risk
- build financial habits through rewards
- stay safe from scams and risky banking behaviour

Main product statement:

```text
SmartGX makes financial resilience the default behaviour for Malaysian youth.
```

---

## 5. GXBank Product Foundation

SmartGX should be based on GXBank’s existing product ecosystem.

### 5.1 GX Account / Savings Account

Base features:

- account balance
- savings account
- transaction history

SmartGX enhancement:

- Financial Health Score
- AI cashflow forecast
- income allocation
- spending safety zone
- AI nudges

Purpose:

GX Account becomes more than a place to store money. It becomes the base for automated financial behaviour.

---

### 5.2 GX Card / Debit Card

Base features:

- card spending
- merchant transactions
- payment history

SmartGX enhancement:

- category spending analysis
- spending risk labels
- overspending alerts
- soft friction before risky spending

Purpose:

GX Card spending becomes a trigger for behavioural intervention.

---

### 5.3 Bonus Pocket

Base features:

- savings pocket
- goal-based savings

SmartGX enhancement:

- salary-triggered saving
- emergency fund pocket
- goal saving pocket
- round-up saving
- saving streak contribution

Purpose:

Bonus Pocket becomes the main automated saving destination.

---

### 5.4 FlexiCredit / Borrowing Risk

Base features:

- credit or borrowing-related product

SmartGX enhancement:

- Debt Risk Score
- BNPL-like transaction detection
- credit dependency warning
- Future Money Blocker
- repayment suggestion

Purpose:

SmartGX helps users avoid debt accumulation before it becomes serious.

---

### 5.5 Rewards

Base features:

- rewards
- badges
- missions
- progress tracking

SmartGX enhancement:

- saving streaks
- resilience badges
- weekly missions
- leaderboard
- friend accountability

Purpose:

Rewards should not only encourage spending. They should encourage good financial behaviour.

---

### 5.6 Campaign

Base features:

- promotional campaigns
- cashback-style campaigns
- user engagement campaigns

SmartGX enhancement:

- No Overspend Week
- RM5 Daily Save Challenge
- Emergency Fund Sprint
- Debt-Free Month
- Safe Banking Challenge

Purpose:

Campaigns become structured habit-building programmes.

---

### 5.7 Security / Anti-Malware

Base features:

- cyber fraud awareness
- suspicious transaction protection
- anti-malware awareness
- safe banking education

SmartGX enhancement:

- Security Score
- scam-risk warning
- suspicious merchant nudge
- safe banking checklist
- anti-malware tip card
- security badge

Purpose:

Financial resilience also includes protecting money from scams, malware, and unsafe banking behaviour.

Security is a supporting module, not the main feature.

---

## 6. Tech Stack

Use:

- React Native
- Expo
- TypeScript
- Expo Router
- Zustand
- Mock data first
- Supabase-ready structure
- Mock authentication first
- AsyncStorage if local persistence is needed

Do not use Next.js as the main app framework because SmartGX is a mobile banking prototype.

Do not require real GXBank API, real payment, or real lending integration.

---

## 7. Environment Setup

Create project:

```bash
npx create-expo-app@latest smartgx
cd smartgx
```

Install dependencies:

```bash
npm install zustand
npm install @supabase/supabase-js
npm install @react-native-async-storage/async-storage
npm install expo-router react-native-safe-area-context react-native-screens
npm install react-native-svg
```

Run app:

```bash
npx expo start
```

Create `.env.example`:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The app must run without real Supabase credentials by using mock data.

---

## 8. Folder Structure

```text
smartgx/
│
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── auth/
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── onboarding.tsx
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
│   │   ├── common/
│   │   │   ├── AppHeader.tsx
│   │   │   ├── SmartCard.tsx
│   │   │   ├── PrimaryButton.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── RiskBadge.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── SectionTitle.tsx
│   │   ├── auth/
│   │   │   ├── AuthForm.tsx
│   │   │   ├── LoginCard.tsx
│   │   │   ├── RegisterCard.tsx
│   │   │   └── OnboardingSlide.tsx
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── savings/
│   │   ├── nudges/
│   │   ├── debt/
│   │   ├── rewards/
│   │   ├── campaigns/
│   │   └── security/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── gxAccount/
│   │   ├── gxCard/
│   │   ├── bonusPocket/
│   │   ├── flexiCredit/
│   │   ├── rewards/
│   │   ├── campaigns/
│   │   ├── security/
│   │   ├── financialHealth/
│   │   ├── automation/
│   │   ├── nudges/
│   │   └── gamification/
│   │
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

## 9. Folder Purpose

### app/

Expo Router screen routes.

### app/auth/

Login, register, and onboarding screens.

### src/components/

Reusable UI components.

### src/components/common/

Shared UI components such as cards, buttons, progress bars, risk badges, empty states, and section titles.

### src/features/

Business logic layer. This is where SmartGX intelligence lives.

It should contain:

- financial health calculation
- automation rules
- AI nudges
- debt risk detection
- gamification logic
- campaign logic
- security logic

### src/data/

Mock data for demo.

Real GXBank APIs are not available, so the prototype should use realistic simulated data.

### src/lib/

Utility functions such as:

- currency formatting
- date formatting
- validation
- risk level conversion
- storage helpers
- Supabase setup

### src/hooks/

Hooks that connect UI to stores and feature engines.

### src/store/

Zustand stores for app state.

### src/theme/

Design tokens for consistent UI.

### src/types/

Global TypeScript types.

---

## 10. Core Logic

### 10.1 Financial Health Score

Calculate from:

```text
Savings rate: 30%
Spending control: 25%
Debt risk: 25%
Emergency fund progress: 10%
Security behaviour: 10%
```

Output:

- score from 0 to 100
- status: Excellent / Healthy / Watch / Risk
- AI-style recommendation

---

### 10.2 Salary Auto Allocation

Example for RM3000 salary:

```text
60% Spending Wallet = RM1800
20% Bonus Pocket = RM600
10% Emergency Fund = RM300
10% Goal Savings = RM300
```

This is the main automated financial decision feature.

---

### 10.3 Manual Income Allocation

Allow user to manually add cash income, allowance, or part-time income.

After income is added, ask whether to apply automatic allocation.

---

### 10.4 Round-up Saving

Example:

```text
User spends RM12.40
Round up to RM13.00
RM0.60 goes to savings
```

---

### 10.5 AI Nudges

Nudges must be contextual, specific, and actionable.

Bad example:

```text
You should save more money.
```

Good example:

```text
Your food spending is 38% higher than your weekly average. If you limit food delivery to RM25 for the next 3 days, your cashflow will stay safe until payday.
```

---

### 10.6 Soft Friction

Do not hard block spending by default.

Use:

- warning
- input the reason to do the transaction
- confirmation (10 second waiting to confirm)
- delay purchase option
- show impact on month-end balance
- move money to goal option

---

### 10.7 Debt Risk Score

Detect:

- high credit usage
- BNPL-like spending
- repeated borrowing
- low remaining balance
- risky FlexiCredit simulation

---

### 10.8 Future Money Blocker

Show warning when user is about to rely on future money.

Example:

```text
You are about to use future money. SmartGX recommends using available balance or delaying this purchase to avoid debt risk.
```

---

### 10.9 Gamification

Include:

- saving streak
- badges
- missions
- leaderboard
- friend challenge

Example badges:

- First Auto Save
- 7-Day Saving Streak
- No Overspend Week
- Emergency Fund Builder
- Debt Defender
- Scam Aware Banker

---

### 10.10 Campaigns

Include:

- RM5 Daily Save Challenge
- No Overspend Week
- Emergency Fund Sprint
- Round-up Booster
- Debt-Free Month
- Safe Banking Challenge

---

### 10.11 Security

Include:

- Security Score
- scam-risk alert
- suspicious transaction warning
- safe banking checklist
- anti-malware tips
- Cyber Fraud Protect awareness

---

## 11. MVP Screens

Build these screens:

1. Login
2. Register
3. Onboarding
4. Dashboard
5. Transactions
6. Savings
7. Debt Risk
8. Rewards
9. Campaigns
10. Security
11. Profile

---

## 12. Main Demo Flow

Demo story:

1. User logs in as Aina Rahman.
2. Dashboard shows RM3000 salary received.
3. SmartGX automatically allocates:
   - RM1800 Spending Wallet
   - RM600 Bonus Pocket
   - RM300 Emergency Fund
   - RM300 Goal Savings
4. User views GX Card transactions.
5. SmartGX detects risky spending.
6. AI nudge appears.
7. Soft friction modal appears.
8. User checks Debt Risk screen.
9. Future Money Blocker appears.
10. User checks Rewards.
11. Streak, badges, missions, and leaderboard appear.
12. User checks Campaigns.
13. No Overspend Week is recommended.
14. User checks Security.
15. Scam-risk and anti-malware reminders appear.

---

## 13. UI Requirements

UI should feel:

- clean
- modern
- trustworthy
- youth-friendly
- mobile-first
- banking-grade
- professional

Do not copy GXBank’s exact UI.

Suggested style:

- soft rounded cards
- readable typography
- clear hierarchy
- progress bars
- risk badges
- compact dashboard
- Malaysian Ringgit formatting

Suggested color logic:

- deep navy / black for trust
- green for positive saving
- orange for warning
- red only for high risk
- blue or purple for AI insights

Expo does not make UI ugly. UI quality depends on consistent theme, spacing, typography, shadows, and reusable components.

---

## 14. Development Rules

1. Use TypeScript.
2. Use React Native Expo.
3. Use Expo Router.
4. Use Zustand.
5. Use mock data first.
6. Keep Supabase-ready structure.
7. Do not require real GXBank API.
8. Do not require real payments.
9. Do not build a real lending system.
10. Do not hard block spending by default.
11. Use behavioural nudges and soft friction.
12. Keep business logic separate from UI.
13. Make the app demo-friendly.
14. Follow TODO.md phase by phase.
15. Stop after each phase and summarize files created or modified.