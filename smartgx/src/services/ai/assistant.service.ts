/**
 * SmartGX Assistant: local FAQ + remote hook via `invokeAssistantChat`.
 */

import { invokeAssistantChat, type AssistantChatMessage } from "./ai.client";
import { getAiConfig } from "./ai.config";

export type AssistantReplySource = "gemini" | "local" | "fallback";

const SYSTEM_PROMPT =
  "You are SmartGX Assistant, a concise in-app guide for the SmartGX personal finance app. " +
  "Answer in plain English, short paragraphs or bullets. " +
  "Do not mention other banks by name. Do not say the app is a prototype or uses fake money. " +
  "If unsure, suggest the user open the relevant SmartGX screen (Saving & Automation, Transfer, FlexiCredit, Security Center, etc.).";

export const ASSISTANT_QUICK_FAQ: { q: string; a: string }[] = [
  {
    q: "What is SmartGX?",
    a: "SmartGX helps you manage savings, spending, card activity, and financial health in one place—with automation, streaks, and timely guidance.",
  },
  {
    q: "How do I add money?",
    a: "Open Add Money from the dashboard or shortcuts. Enter an amount and confirm; your main balance updates everywhere in SmartGX right away.",
  },
  {
    q: "How do I transfer money?",
    a: "Go to Transfer, pick a recent contact or enter details, enter the amount, review, and confirm. The amount leaves your main balance and appears in Transactions.",
  },
  {
    q: "How do I receive income?",
    a: "Use Receive Income (or your income entry flow) to log salary or other inflows. SmartGX can use that signal for auto allocation and GXHealth.",
  },
  {
    q: "Why is my balance different from savings?",
    a: "Your main balance is spendable cash. Savings pockets (Bonus, Emergency, Goals) are separate buckets—money moved there is no longer in the main balance until you withdraw or reallocate.",
  },
  {
    q: "How do I withdraw from savings?",
    a: "In Saving & Automation, use withdraw or move actions for the pocket you want. The funds return to your main balance (or as the screen specifies) and records update.",
  },
  {
    q: "How does auto allocation work?",
    a: "When SmartGX detects income, it splits it into Spending Wallet, Emergency, Goals, and Bonus based on your percentages in Saving & Automation. You can change those rules anytime.",
  },
  {
    q: "What is Bonus saving?",
    a: "Bonus is a savings pocket—often for rewards or flexible savings. Rules for interest and withdrawals are shown in Saving & Automation; withdrawing from Bonus may differ from Emergency or Goals.",
  },
  {
    q: "What is Emergency saving?",
    a: "Emergency is your buffer pocket for unexpected costs. SmartGX encourages keeping this funded before discretionary spending.",
  },
  {
    q: "What is Goal saving?",
    a: "Goals are named targets (e.g. travel, education). Contributions go to that goal’s balance until you complete or adjust the goal.",
  },
  {
    q: "How is daily interest estimated?",
    a: "SmartGX shows an estimate based on current pocket rates and balances. Actual posting can depend on product rules; treat the figure as a helpful projection.",
  },
  {
    q: "What happens if I withdraw from Bonus?",
    a: "Your Bonus balance decreases and funds move per your withdrawal choice. Some campaigns or streak bonuses may depend on keeping Bonus funded—check Saving & Automation for details.",
  },
  {
    q: "What is GXHealth?",
    a: "GXHealth (0–100) is SmartGX’s financial wellness score. It blends savings rate, spending control, emergency funding, subscriptions, income stability, and debt pressure—higher means healthier overall patterns.",
  },
  {
    q: "What does my GXHealth score mean?",
    a: "GXHealth (0–100) summarizes savings behaviour, spending control, subscriptions, income stability, and debt pressure. Higher means healthier overall patterns.",
  },
  {
    q: "How can I improve GXHealth?",
    a: "Save consistently, keep emergency funded, reduce high‑risk spending, avoid unnecessary credit use, and follow SmartGX nudges when they appear.",
  },
  {
    q: "Why did my GXHealth drop?",
    a: "Common causes: lower savings rate, higher spending vs income, more subscription load, or increased credit or debt signals. Check GXHealth factors on your dashboard for what moved.",
  },
  {
    q: "Why did SmartGX warn me?",
    a: "SmartGX warns when a pattern looks risky (e.g. large or unusual spend, credit use, or scam-like context). It’s a guardrail—you can still proceed after reading the context.",
  },
  {
    q: "What is a high-risk transaction?",
    a: "Typically larger amounts, unfamiliar merchants, credit-funded spend, or patterns that spike your risk score. SmartGX highlights these so you can double-check.",
  },
  {
    q: "What does critical risk mean?",
    a: "Critical means SmartGX strongly recommends pausing—often due to scam indicators, extreme spend, or dangerous context. Review details and consider cancelling or verifying first.",
  },
  {
    q: "What is FlexiCredit?",
    a: "FlexiCredit is SmartGX’s guided credit line with affordability checks, safe drawdown guidance, and repayment tracking.",
  },
  {
    q: "How does drawdown work?",
    a: "After approval, you request a drawdown amount and tenure. Funds credit to your flow as the app defines; you repay on schedule with principal and interest.",
  },
  {
    q: "Why does repayment include interest?",
    a: "Borrowed money accrues interest per the annual rate and tenure. Each repayment covers interest plus principal, shown in FlexiCredit repayment and statements.",
  },
  {
    q: "What is SmartGX Safe Drawdown?",
    a: "It’s a recommended maximum draw based on repayment capacity and risk—not the same as your full technical limit. It helps keep repayments manageable.",
  },
  {
    q: "Why is available credit different from safe drawdown?",
    a: "Available credit is what you could technically use. Safe drawdown is what SmartGX recommends so monthly repayments stay within safer capacity.",
  },
  {
    q: "How does saving streak work?",
    a: "Save at least the daily threshold to count a day. Consecutive days build your streak; milestones can unlock rewards shown on Saving Streak.",
  },
  {
    q: "How do I earn water?",
    a: "Water (or similar gamification currency) is earned by completing saving actions and missions—check Money Tree and missions for the exact rules and claims.",
  },
  {
    q: "How does Money Tree grow?",
    a: "Consistent saves and mission progress improve tree health and rewards. Skipping saves or heavy spending can slow growth—your dashboard reflects the state.",
  },
  {
    q: "How is SmartScore calculated?",
    a: "SmartScore aggregates streaks, saves, missions, and healthy habits. Exact weightings are in the gamification layer; keep saving and completing missions to raise it.",
  },
  {
    q: "What is Security Center?",
    a: "Security Center in SmartGX is where you manage PIN, Emergency Lock, scam checks, device safety, and alerts—so payments and sensitive actions stay protected.",
  },
  {
    q: "How do I change my PIN?",
    a: "Open Security Center → change PIN (or equivalent). You’ll verify first, then set a new 6‑digit PIN used for sensitive actions.",
  },
  {
    q: "What is Emergency Lock?",
    a: "Emergency Lock quickly restricts sensitive actions when you feel at risk. Unlock with your PIN when you’re ready—see Security Center for toggles.",
  },
  {
    q: "What is Device Safety Check?",
    a: "A quick checklist (biometrics, lock screen, app updates) to improve device security. Completing items raises your security posture score in SmartGX.",
  },
  {
    q: "How does Scam Protection work?",
    a: "SmartGX scans messages or context for scam patterns, risky links, and urgency cues. It warns before you send money or share sensitive info.",
  },
  {
    q: "How does GXHealth work?",
    a: "GXHealth combines savings rate, spending, subscriptions, income patterns, and debt pressure into one score with factors you can act on from the dashboard.",
  },
  {
    q: "What is TapPay?",
    a: "TapPay simulates a card tap: SmartGX generates merchant details, you confirm with PIN, and your balance and transactions update.",
  },
  {
    q: "What is Credit?",
    a: "Credit in SmartGX is a separate spending line with its own limit. Using it increases debt‑risk signals; SmartGX may warn before you confirm.",
  },
  {
    q: "How do I freeze my card?",
    a: "MyCard → Card Controls → Freeze. While frozen, new spends are blocked; unfreeze the same way when you need the card again.",
  },
  {
    q: "Why did SmartGX warn me before using Credit?",
    a: "Credit spends future money and can lower GXHealth. The short pause is intentional so you can confirm the purchase is worth the debt risk.",
  },
  {
    q: "How do I save manually?",
    a: "Saving & Automation → Manual Save. Choose amount and destination pocket; funds move from main balance immediately.",
  },
  {
    q: "What is the Scan button for?",
    a: "Scan starts a QR-style payment flow: review merchant details, confirm with PIN, and the transaction posts to your history and balance.",
  },
];

const GENERIC_FALLBACK =
  "I don’t have a specific answer for that yet. Try a quick question below, or ask about transfers, savings pockets, GXHealth, FlexiCredit, streaks, or Security Center.";

function normalize(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ");
}

function tokenize(n: string) {
  return n.split(" ").filter((w) => w.length > 2);
}

/** Best-effort local match for offline / fallback. */
export function findLocalAssistantAnswer(userMessage: string): string | null {
  const n = normalize(userMessage);
  if (!n) return null;

  for (const { q, a } of ASSISTANT_QUICK_FAQ) {
    const qn = normalize(q);
    if (n === qn || n.includes(qn) || qn.includes(n)) return a;
  }

  const userTokens = new Set(tokenize(n));
  let best: { a: string; score: number } | null = null;
  for (const { q, a } of ASSISTANT_QUICK_FAQ) {
    const qt = tokenize(normalize(q));
    if (qt.length === 0) continue;
    let score = 0;
    for (const t of qt) {
      if (userTokens.has(t)) score += 1;
    }
    const ratio = score / qt.length;
    if (ratio >= 0.45 && (!best || score > best.score)) best = { a, score };
  }

  return best?.a ?? null;
}

export async function getAssistantReplyDetailed(
  userMessage: string,
  history: { role: "user" | "assistant"; content: string }[]
): Promise<{ text: string; source: AssistantReplySource }> {
  const trimmed = userMessage.trim();
  const config = getAiConfig();

  if (config.remoteAiEnabled && config.fallbackEnabled) {
    const messages: AssistantChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: trimmed },
    ];
    const remote = await invokeAssistantChat(messages);
    if (remote) return { text: remote, source: "gemini" };
  }

  if (config.fallbackEnabled) {
    const local = findLocalAssistantAnswer(trimmed);
    if (local) return { text: local, source: "local" };
  }

  return { text: GENERIC_FALLBACK, source: "fallback" };
}

export async function getAssistantReply(
  userMessage: string,
  history: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const { text } = await getAssistantReplyDetailed(userMessage, history);
  return text;
}
