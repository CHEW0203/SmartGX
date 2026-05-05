# SmartGX TODO

## Build Rule

Do not build the whole app at once.

Always read:

```text
PROJECT_BRIEF.md
TODO.md
```

Implement one phase at a time only.

After each phase, stop and summarize:

- files created
- files modified
- dependencies installed
- assumptions made
- errors found
- next suggested phase

---

# Phase 0: Project Setup

## Goal

Create the Expo React Native TypeScript project and install required dependencies.

## Tasks

- [ ] Create Expo app named `smartgx`
- [ ] Ensure TypeScript is enabled
- [ ] Install Zustand
- [ ] Install Supabase client
- [ ] Install AsyncStorage
- [ ] Install Expo Router dependencies
- [ ] Install React Native SVG
- [ ] Create `.env.example`
- [ ] Confirm app runs with `npx expo start`

## Commands

```bash
npx create-expo-app@latest smartgx
cd smartgx

npm install zustand
npm install @supabase/supabase-js
npm install @react-native-async-storage/async-storage
npm install expo-router react-native-safe-area-context react-native-screens
npm install react-native-svg

npx expo start
```

## Done When

- Expo app starts successfully.
- No critical dependency errors.
- Basic app screen appears.

---

# Phase 1: Project Structure, Theme, Types, Mock Data

## Goal

Create the foundation of SmartGX.

## Tasks

### Folder Structure

- [ ] Create `app/auth/`
- [ ] Create `src/components/common/`
- [ ] Create `src/components/auth/`
- [ ] Create `src/components/dashboard/`
- [ ] Create `src/components/transactions/`
- [ ] Create `src/components/savings/`
- [ ] Create `src/components/nudges/`
- [ ] Create `src/components/debt/`
- [ ] Create `src/components/rewards/`
- [ ] Create `src/components/campaigns/`
- [ ] Create `src/components/security/`
- [ ] Create `src/features/auth/`
- [ ] Create `src/features/gxAccount/`
- [ ] Create `src/features/gxCard/`
- [ ] Create `src/features/bonusPocket/`
- [ ] Create `src/features/flexiCredit/`
- [ ] Create `src/features/rewards/`
- [ ] Create `src/features/campaigns/`
- [ ] Create `src/features/security/`
- [ ] Create `src/features/financialHealth/`
- [ ] Create `src/features/automation/`
- [ ] Create `src/features/nudges/`
- [ ] Create `src/features/gamification/`
- [ ] Create `src/data/`
- [ ] Create `src/lib/`
- [ ] Create `src/hooks/`
- [ ] Create `src/store/`
- [ ] Create `src/theme/`
- [ ] Create `src/types/`

### Theme

- [ ] Create `src/theme/colors.ts`
- [ ] Create `src/theme/spacing.ts`
- [ ] Create `src/theme/typography.ts`
- [ ] Create `src/theme/shadows.ts`
- [ ] Create `src/theme/radius.ts`

### Common Components

- [ ] Create `src/components/common/AppHeader.tsx`
- [ ] Create `src/components/common/SmartCard.tsx`
- [ ] Create `src/components/common/PrimaryButton.tsx`
- [ ] Create `src/components/common/ProgressBar.tsx`
- [ ] Create `src/components/common/RiskBadge.tsx`
- [ ] Create `src/components/common/EmptyState.tsx`
- [ ] Create `src/components/common/SectionTitle.tsx`

### Types

- [ ] Create `src/types/user.ts`
- [ ] Create `src/types/auth.ts`
- [ ] Create `src/types/account.ts`
- [ ] Create `src/types/transaction.ts`
- [ ] Create `src/types/saving.ts`
- [ ] Create `src/types/reward.ts`
- [ ] Create `src/types/campaign.ts`
- [ ] Create `src/types/security.ts`
- [ ] Create `src/types/risk.ts`

### Utility Files

- [ ] Create `src/lib/currency.ts`
- [ ] Create `src/lib/date.ts`
- [ ] Create `src/lib/riskLevel.ts`
- [ ] Create `src/lib/validators.ts`
- [ ] Create `src/lib/constants.ts`
- [ ] Create `src/lib/storage.ts`
- [ ] Create `src/lib/supabase.ts`

### Mock Data

- [ ] Create `src/data/mockUser.ts`
- [ ] Create `src/data/mockAuth.ts`
- [ ] Create `src/data/mockAccounts.ts`
- [ ] Create `src/data/mockTransactions.ts`
- [ ] Create `src/data/mockSavingsGoals.ts`
- [ ] Create `src/data/mockRewards.ts`
- [ ] Create `src/data/mockCampaigns.ts`
- [ ] Create `src/data/mockLeaderboard.ts`
- [ ] Create `src/data/mockSecurityEvents.ts`
- [ ] Create `src/data/mockNudges.ts`

## Done When

- Folder structure exists.
- Theme constants are usable.
- Types are defined.
- Mock data is realistic and Malaysia-based.
- Common components render without errors.

---

# Phase 2: Authentication and Navigation

## Goal

Implement mock authentication and basic navigation.

## Tasks

### Screens

- [ ] Create `app/_layout.tsx`
- [ ] Create `app/index.tsx`
- [ ] Create `app/auth/login.tsx`
- [ ] Create `app/auth/register.tsx`
- [ ] Create `app/auth/onboarding.tsx`

### Auth Components

- [ ] Create `src/components/auth/AuthForm.tsx`
- [ ] Create `src/components/auth/LoginCard.tsx`
- [ ] Create `src/components/auth/RegisterCard.tsx`
- [ ] Create `src/components/auth/OnboardingSlide.tsx`

### Auth Logic

- [ ] Create `src/features/auth/auth.service.ts`
- [ ] Create `src/features/auth/auth.types.ts`
- [ ] Create `src/features/auth/auth.rules.ts`
- [ ] Create `src/store/authStore.ts`
- [ ] Create `src/hooks/useAuth.ts`

### Required Behaviour

- [ ] Mock login works with demo accounts
- [ ] Mock register creates user state
- [ ] Logout clears user state
- [ ] Not logged in users go to login
- [ ] Logged in users go to dashboard
- [ ] Demo account shortcut exists

## Done When

- User can login.
- User can register.
- User can logout.
- Navigation works.
- Dashboard is protected behind login.

---

# Phase 3: Dashboard MVP

## Goal

Build the main SmartGX dashboard.

## Tasks

### Screen

- [ ] Create `app/dashboard.tsx`

### Components

- [ ] Create `src/components/dashboard/BalanceCard.tsx`
- [ ] Create `src/components/dashboard/FinancialHealthScoreCard.tsx`
- [ ] Create `src/components/dashboard/CashflowForecastCard.tsx`
- [ ] Create `src/components/dashboard/AiNudgeCard.tsx`
- [ ] Create `src/components/dashboard/QuickActions.tsx`
- [ ] Create `src/components/dashboard/SmartGXSummaryCard.tsx`

### Stores and Hooks

- [ ] Create `src/store/userStore.ts`
- [ ] Create `src/store/accountStore.ts`
- [ ] Create `src/hooks/useFinancialHealth.ts`

### Dashboard Content

- [ ] Greeting
- [ ] GX Account balance
- [ ] Spending Wallet
- [ ] Bonus Pocket balance
- [ ] Emergency Fund progress
- [ ] Financial Health Score
- [ ] AI Nudge
- [ ] Cashflow Forecast
- [ ] Debt Risk preview
- [ ] Quick Actions

## Done When

- Dashboard looks like a mobile banking home screen.
- User can understand financial status quickly.
- UI is clean and presentable.

---

# Phase 4: Financial Health Engine

## Goal

Implement the core scoring system.

## Tasks

### Files

- [ ] Create `src/features/financialHealth/financialHealth.engine.ts`
- [ ] Create `src/features/financialHealth/financialHealth.rules.ts`
- [ ] Create `src/features/financialHealth/financialHealth.types.ts`

### Logic

Calculate score from:

- [ ] Savings rate
- [ ] Spending control
- [ ] Debt risk
- [ ] Emergency fund progress
- [ ] Security behaviour

Suggested weights:

```text
Savings rate: 30%
Spending control: 25%
Debt risk: 25%
Emergency fund: 10%
Security score: 10%
```

### Output

- [ ] score from 0 to 100
- [ ] status: Excellent / Healthy / Watch / Risk
- [ ] risk level
- [ ] AI-style recommendation

## Done When

- Dashboard uses calculated score from mock data.
- Score changes logically when mock data changes.

---

# Phase 5: Savings and Automation

## Goal

Build automated saving behaviour.

## Tasks

### Screen

- [ ] Create `app/savings.tsx`

### Components

- [ ] Create `src/components/savings/BonusPocketCard.tsx`
- [ ] Create `src/components/savings/AutoAllocationCard.tsx`
- [ ] Create `src/components/savings/RoundUpSavingCard.tsx`
- [ ] Create `src/components/savings/EmergencyFundCard.tsx`
- [ ] Create `src/components/savings/SavingGoalCard.tsx`
- [ ] Create `src/components/savings/ManualIncomeCard.tsx`

### Feature Logic

- [ ] Create `src/features/automation/salaryAllocation.engine.ts`
- [ ] Create `src/features/automation/roundUpSaving.engine.ts`
- [ ] Create `src/features/automation/manualIncome.engine.ts`
- [ ] Create `src/features/automation/automation.types.ts`
- [ ] Create `src/features/bonusPocket/bonusPocket.service.ts`
- [ ] Create `src/features/bonusPocket/bonusPocket.types.ts`

### Store and Hook

- [ ] Create `src/store/savingsStore.ts`
- [ ] Create `src/hooks/useAutoAllocation.ts`

### Required Behaviour

- [ ] Simulate RM3000 salary allocation
- [ ] Allocate 60% to Spending Wallet
- [ ] Allocate 20% to Bonus Pocket
- [ ] Allocate 10% to Emergency Fund
- [ ] Allocate 10% to Goal Savings
- [ ] Support manual income input
- [ ] Apply allocation rule to manual income
- [ ] Calculate round-up savings from transactions

## Done When

- Savings screen clearly shows automated financial behaviour.
- User can understand that SmartGX reduces dependence on discipline.

---

# Phase 6: Transactions and GX Card Spending

## Goal

Build transaction view and spending risk detection.

## Tasks

### Screen

- [ ] Create `app/transactions.tsx`

### Components

- [ ] Create `src/components/transactions/TransactionItem.tsx`
- [ ] Create `src/components/transactions/TransactionList.tsx`
- [ ] Create `src/components/transactions/SpendingCategorySummary.tsx`
- [ ] Create `src/components/transactions/SpendingCategoryChart.tsx`
- [ ] Create `src/components/transactions/SpendRiskBanner.tsx`

### Feature Logic

- [ ] Create `src/features/gxCard/gxCard.service.ts`
- [ ] Create `src/features/gxCard/gxCard.types.ts`
- [ ] Create transaction category risk logic

### Store and Hook

- [ ] Create `src/store/transactionStore.ts`
- [ ] Create `src/hooks/useTransactions.ts`

### Required Behaviour

- [ ] Show GX Card transactions
- [ ] Show merchant
- [ ] Show category
- [ ] Show amount
- [ ] Show risk level
- [ ] Summarize spending by category
- [ ] Detect high food, transport, or entertainment spending

## Done When

- Transactions are not just records.
- Transactions become behavioural insights.

---

# Phase 7: AI Nudges and Soft Friction

## Goal

Build contextual AI nudges and behavioural intervention.

## Tasks

### Components

- [ ] Create `src/components/nudges/NudgeCard.tsx`
- [ ] Create `src/components/nudges/NudgeList.tsx`
- [ ] Create `src/components/nudges/SoftFrictionModal.tsx`
- [ ] Create `src/components/nudges/ActionableAdviceCard.tsx`

### Feature Logic

- [ ] Create `src/features/nudges/nudge.engine.ts`
- [ ] Create `src/features/nudges/nudge.rules.ts`
- [ ] Create `src/features/nudges/nudge.types.ts`

### Hook

- [ ] Create `src/hooks/useNudges.ts`

### Required Nudges

- [ ] Food spending warning
- [ ] Weekend spending warning
- [ ] Cashflow risk warning
- [ ] Saving opportunity
- [ ] Credit risk warning
- [ ] Scam-risk warning

### Soft Friction Options

- [ ] Continue
- [ ] Delay purchase
- [ ] Move money to goal
- [ ] View impact on month-end balance

## Done When

- Nudges are specific and actionable.
- Soft friction preserves user freedom.
- App goes beyond data presentation.

---

# Phase 8: Debt Prevention and FlexiCredit Risk

## Goal

Build debt prevention module.

## Tasks

### Screen

- [ ] Create `app/debt-risk.tsx`

### Components

- [ ] Create `src/components/debt/DebtRiskScoreCard.tsx`
- [ ] Create `src/components/debt/CreditUsageWarning.tsx`
- [ ] Create `src/components/debt/FutureMoneyBlocker.tsx`
- [ ] Create `src/components/debt/FlexiCreditSimulationCard.tsx`
- [ ] Create `src/components/debt/RepaymentPlanCard.tsx`

### Feature Logic

- [ ] Create `src/features/flexiCredit/flexiCredit.service.ts`
- [ ] Create `src/features/flexiCredit/flexiCredit.types.ts`
- [ ] Create debt risk calculation logic
- [ ] Create Future Money Blocker logic

### Required Behaviour

- [ ] Calculate Debt Risk Score
- [ ] Detect credit dependency
- [ ] Detect BNPL-like spending
- [ ] Show Future Money Blocker
- [ ] Suggest repayment plan
- [ ] Recommend using current money instead of future money

## Done When

- Debt prevention is clearly shown.
- App directly addresses debt accumulation among youth.

---

# Phase 9: Rewards and Gamification

## Goal

Build habit-forming rewards.

## Tasks

### Screen

- [ ] Create `app/rewards.tsx`

### Components

- [ ] Create `src/components/rewards/SavingStreakCard.tsx`
- [ ] Create `src/components/rewards/BadgeCard.tsx`
- [ ] Create `src/components/rewards/MissionCard.tsx`
- [ ] Create `src/components/rewards/LeaderboardCard.tsx`
- [ ] Create `src/components/rewards/FriendChallengeCard.tsx`

### Feature Logic

- [ ] Create `src/features/gamification/streak.engine.ts`
- [ ] Create `src/features/gamification/badge.engine.ts`
- [ ] Create `src/features/gamification/leaderboard.engine.ts`
- [ ] Create `src/features/gamification/gamification.types.ts`
- [ ] Create `src/features/rewards/rewards.service.ts`
- [ ] Create `src/features/rewards/rewards.types.ts`

### Store and Hook

- [ ] Create `src/store/gamificationStore.ts`
- [ ] Create `src/hooks/useGamification.ts`

### Required Features

- [ ] Saving streak
- [ ] Badges
- [ ] Missions
- [ ] Leaderboard
- [ ] Friend challenge

## Done When

- Gamification supports habit formation.
- It does not feel like random points only.

---

# Phase 10: Campaigns

## Goal

Build behaviour-based campaign module.

## Tasks

### Screen

- [ ] Create `app/campaigns.tsx`

### Components

- [ ] Create `src/components/campaigns/CampaignCard.tsx`
- [ ] Create `src/components/campaigns/CampaignProgressCard.tsx`
- [ ] Create `src/components/campaigns/ChallengeCard.tsx`
- [ ] Create `src/components/campaigns/CampaignRewardCard.tsx`

### Feature Logic

- [ ] Create `src/features/campaigns/campaign.service.ts`
- [ ] Create `src/features/campaigns/campaign.engine.ts`
- [ ] Create `src/features/campaigns/campaign.types.ts`

### Store and Hook

- [ ] Create `src/store/campaignStore.ts`
- [ ] Create `src/hooks/useCampaigns.ts`

### Required Campaigns

- [ ] RM5 Daily Save Challenge
- [ ] No Overspend Week
- [ ] Emergency Fund Sprint
- [ ] Round-up Booster
- [ ] Debt-Free Month
- [ ] Safe Banking Challenge

## Done When

- Campaigns reward financial resilience behaviour.
- Campaigns feel like GXBank-style engagement with stronger purpose.

---

# Phase 11: Security / Anti-Malware

## Goal

Build safe banking support module.

## Tasks

### Screen

- [ ] Create `app/security.tsx`

### Components

- [ ] Create `src/components/security/SecurityScoreCard.tsx`
- [ ] Create `src/components/security/AntiMalwareTipCard.tsx`
- [ ] Create `src/components/security/ScamRiskAlertCard.tsx`
- [ ] Create `src/components/security/SafeBankingChecklist.tsx`
- [ ] Create `src/components/security/CyberFraudProtectCard.tsx`

### Feature Logic

- [ ] Create `src/features/security/security.service.ts`
- [ ] Create `src/features/security/security.engine.ts`
- [ ] Create `src/features/security/security.rules.ts`
- [ ] Create `src/features/security/security.types.ts`

### Store and Hook

- [ ] Create `src/store/securityStore.ts`
- [ ] Create `src/hooks/useSecurity.ts`

### Required Features

- [ ] Security Score
- [ ] Suspicious transaction alert
- [ ] Scam-risk warning
- [ ] Anti-malware education
- [ ] Safe banking checklist
- [ ] Security badge

## Done When

- Security feels like a supporting banking safety module.
- It does not distract from the main financial resilience goal.

---

# Phase 12: Profile and Settings

## Goal

Build user profile and settings screen.

## Tasks

### Screen

- [ ] Create `app/profile.tsx`

### Required Content

- [ ] User information
- [ ] User type
- [ ] Monthly income or allowance
- [ ] Automation settings
- [ ] Allocation percentages
- [ ] Security settings
- [ ] Logout button

## Done When

- User can view profile.
- User can logout.
- User can understand SmartGX settings.

---

# Phase 13: Demo Flow Integration

## Goal

Ensure the hackathon demo story works smoothly.

## Required Demo Flow

- [ ] User logs in as Aina Rahman
- [ ] Dashboard shows RM3000 salary received
- [ ] SmartGX shows automatic allocation:
  - RM1800 Spending Wallet
  - RM600 Bonus Pocket
  - RM300 Emergency Fund
  - RM300 Goal Savings
- [ ] User views transactions
- [ ] SmartGX detects risky spending
- [ ] AI nudge appears
- [ ] Soft friction modal appears
- [ ] User checks Debt Risk screen
- [ ] Future Money Blocker appears
- [ ] User checks Rewards
- [ ] Streak, badges, missions, and leaderboard appear
- [ ] User checks Campaigns
- [ ] No Overspend Week is recommended
- [ ] User checks Security
- [ ] Scam-risk and anti-malware reminders appear

## Done When

- Judge can understand the full product within 3 to 5 minutes.
- Demo does not require real API or real banking integration.
- Screens connect logically.

---

# Phase 14: UI Polish

## Goal

Make the app look professional and banking-grade.

## Tasks

- [ ] Improve spacing consistency
- [ ] Improve card design
- [ ] Improve button states
- [ ] Improve color hierarchy
- [ ] Improve typography
- [ ] Improve empty states
- [ ] Improve risk badges
- [ ] Improve dashboard layout
- [ ] Ensure all screens look mobile-first
- [ ] Ensure RM currency formatting is consistent
- [ ] Ensure app does not look childish

## Done When

- UI looks clean, modern, and trustworthy.
- App is presentable for hackathon judging.

---

# Phase 15: Final Testing

## Goal

Make sure the app is stable before presentation.

## Tasks

- [ ] Run app with `npx expo start`
- [ ] Test login
- [ ] Test register
- [ ] Test logout
- [ ] Test dashboard
- [ ] Test savings screen
- [ ] Test transactions screen
- [ ] Test debt risk screen
- [ ] Test rewards screen
- [ ] Test campaigns screen
- [ ] Test security screen
- [ ] Test profile screen
- [ ] Fix TypeScript errors
- [ ] Fix runtime errors
- [ ] Remove unused imports
- [ ] Ensure demo flow works

## Done When

- App runs without crashing.
- Demo flow is smooth.
- No major broken layout.
- Ready for presentation.

---

# Cursor Prompt Template

Use this when asking Cursor to implement:

```text
Read PROJECT_BRIEF.md and TODO.md.

Implement Phase [number] only.

Do not implement future phases yet.

After completing this phase:
1. summarize files created
2. summarize files modified
3. mention dependencies installed
4. mention assumptions made
5. mention errors found
6. stop and wait for my confirmation
```