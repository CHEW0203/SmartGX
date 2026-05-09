import { getAiConfig } from "../ai/ai.config";
import { callSmartGxAi } from "../../services/ai/ai.client";

export type IncomingDetectedType =
  | "salary"
  | "allowance"
  | "part_time_income"
  | "freelance_income"
  | "cash_income"
  | "transfer_in"
  | "refund"
  | "cashback"
  | "unknown";

export interface IncomingReceipt {
  amount: number;
  source: string;
  description: string;
  receivedAt: string;
  channel: "instant_transfer" | "salary_credit" | "duitnow" | "internal_transfer";
}

export interface IncomingClassifierInput {
  receipt: IncomingReceipt;
  previousIncomePattern?: string[];
  recentIncomingTransfers?: Array<{ amount: number; source: string; description: string }>;
}

export interface IncomingClassifierResult {
  detectedType: IncomingDetectedType;
  confidence: "high" | "medium" | "low";
  shouldAutoAllocate: boolean;
  reason: string;
  allocationPriority: "apply" | "ask" | "skip";
  aiExplanation: string;
}

const EMPLOYER_LIKE = /(sdn bhd|bhd|enterprise|technolog|tech|employer|payroll|company)/i;
const SALARY_KW = ["salary", "payroll", "gaji", "monthly pay", "wages", "remuneration", "gaji bulanan"];
const ALLOWANCE_KW = ["allowance", "student allowance", "monthly allowance", "elaun", "stipend"];
const PART_TIME_KW = ["part-time", "part time", "shift payment", "hourly pay", "wages"];
const FREELANCE_KW = ["freelance", "project payment", "client payment", "invoice"];
const REFUND_KW = ["refund", "reversal", "cashback", "rebate"];
const FRIEND_KW = ["dinner", "food", "paid back", "split", "friend", "duitnow transfer", "transfer received", "pocket money", "help"];

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFrom<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type ReceiptTemplate = {
  source: string;
  descriptionOptions: readonly string[];
  amountMin: number;
  amountMax: number;
  channel: IncomingReceipt["channel"];
  priority: "high" | "low";
};

const TEMPLATES: readonly ReceiptTemplate[] = [
  {
    source: "ABC Tech Sdn Bhd",
    descriptionOptions: ["Monthly Salary", "Payroll", "Gaji Bulanan"],
    amountMin: 2800,
    amountMax: 4500,
    channel: "salary_credit",
    priority: "high",
  },
  {
    source: "UTM Allowance",
    descriptionOptions: ["Monthly Allowance", "Student Allowance"],
    amountMin: 1200,
    amountMax: 1800,
    channel: "instant_transfer",
    priority: "high",
  },
  {
    source: "Part-time Employer",
    descriptionOptions: ["Part-time Pay", "Wages", "Shift Payment"],
    amountMin: 1000,
    amountMax: 2200,
    channel: "instant_transfer",
    priority: "high",
  },
  {
    source: "Freelance Client",
    descriptionOptions: ["Project Payment", "Freelance Payment", "Client Payment"],
    amountMin: 1000,
    amountMax: 3000,
    channel: "instant_transfer",
    priority: "high",
  },
  {
    source: "Jason Tan",
    descriptionOptions: ["Dinner split", "Paid back", "Food money"],
    amountMin: 10,
    amountMax: 300,
    channel: "duitnow",
    priority: "low",
  },
  {
    source: "Family Support",
    descriptionOptions: ["Pocket money", "Help"],
    amountMin: 50,
    amountMax: 500,
    channel: "instant_transfer",
    priority: "low",
  },
  {
    source: "Merchant Refund",
    descriptionOptions: ["Refund", "Reversal", "Cashback"],
    amountMin: 20,
    amountMax: 800,
    channel: "internal_transfer",
    priority: "low",
  },
  {
    source: "DuitNow Sender",
    descriptionOptions: ["DuitNow Transfer Received"],
    amountMin: 10,
    amountMax: 500,
    channel: "duitnow",
    priority: "low",
  },
];

export function generateIncomingReceipt(): IncomingReceipt {
  const highPriority = Math.random() < 0.75;
  const pool = TEMPLATES.filter((t) => (highPriority ? t.priority === "high" : t.priority === "low"));
  const chosen = randFrom(pool);
  return {
    amount: round2(randInt(chosen.amountMin * 100, chosen.amountMax * 100) / 100),
    source: chosen.source,
    description: randFrom(chosen.descriptionOptions),
    receivedAt: new Date().toISOString(),
    channel: chosen.channel,
  };
}

const VALID_TYPES = new Set<IncomingDetectedType>([
  "salary",
  "allowance",
  "part_time_income",
  "freelance_income",
  "cash_income",
  "transfer_in",
  "refund",
  "cashback",
  "unknown",
]);

function parseIncomeClassifierJson(raw: string): IncomingClassifierResult | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]) as Record<string, unknown>;
    const detectedType = j.detectedType;
    if (typeof detectedType !== "string" || !VALID_TYPES.has(detectedType as IncomingDetectedType)) return null;
    const confidence = j.confidence;
    if (confidence !== "high" && confidence !== "medium" && confidence !== "low") return null;
    const shouldAutoAllocate = Boolean(j.shouldAutoAllocate);
    const reason = typeof j.reason === "string" ? j.reason : "";
    const ap = j.allocationPriority;
    if (ap !== "apply" && ap !== "ask" && ap !== "skip") return null;
    const aiExplanation = typeof j.aiExplanation === "string" ? j.aiExplanation : "";
    return {
      detectedType: detectedType as IncomingDetectedType,
      confidence,
      shouldAutoAllocate,
      reason,
      allocationPriority: ap,
      aiExplanation: aiExplanation || "Classified via SmartGX AI.",
    };
  } catch {
    return null;
  }
}

async function classifyIncomingReceiptRemote(input: IncomingClassifierInput): Promise<IncomingClassifierResult | null> {
  const config = getAiConfig();
  if (!config.enabled) return null;
  try {
    const res = await callSmartGxAi(
      "income_classification",
      [
        "Classify this incoming receipt for SmartGX.",
        "Reply JSON only with keys: detectedType, confidence (high|medium|low), shouldAutoAllocate (boolean),",
        "reason (short string), allocationPriority (apply|ask|skip), aiExplanation (one sentence).",
        "detectedType must be one of: salary, allowance, part_time_income, freelance_income, cash_income, transfer_in, refund, cashback, unknown.",
      ].join(" "),
      {
        amount: input.receipt.amount,
        source: input.receipt.source,
        description: input.receipt.description,
        dateTime: input.receipt.receivedAt,
        channel: input.receipt.channel,
        previousIncomePattern: input.previousIncomePattern ?? [],
        recentIncomingTransfers: input.recentIncomingTransfers ?? [],
      },
      config
    );
    if (!res?.success || !res.content.trim()) return null;
    const fromStruct =
      Object.keys(res.structured).length > 0 ? parseIncomeClassifierJson(JSON.stringify(res.structured)) : null;
    return fromStruct ?? parseIncomeClassifierJson(res.content);
  } catch {
    return null;
  }
}

export function classifyIncomingReceiptFallback(input: IncomingClassifierInput): IncomingClassifierResult {
  const { receipt } = input;
  const h = `${receipt.source} ${receipt.description}`.toLowerCase();
  const amount = receipt.amount;

  const isRefund = hasAny(h, REFUND_KW);
  const isFriendLike = hasAny(h, FRIEND_KW);
  const isSalary = hasAny(h, SALARY_KW);
  const isAllowance = hasAny(h, ALLOWANCE_KW);
  const isPartTime = hasAny(h, PART_TIME_KW);
  const isFreelance = hasAny(h, FREELANCE_KW);
  const employerLike = EMPLOYER_LIKE.test(receipt.source);

  if (isRefund) {
    const detectedType: IncomingDetectedType = h.includes("cashback") ? "cashback" : "refund";
    return {
      detectedType,
      confidence: "high",
      shouldAutoAllocate: false,
      reason: "Refund/cashback pattern detected.",
      allocationPriority: "skip",
      aiExplanation: "This incoming receipt looks like a refund/cashback event, so SmartGX keeps it in Main Account.",
    };
  }

  if (amount < 1000) {
    if (isFriendLike) {
      return {
        detectedType: "transfer_in",
        confidence: "high",
        shouldAutoAllocate: false,
        reason: "Small friend-like transfer detected.",
        allocationPriority: "skip",
        aiExplanation: "This is a small personal transfer, so SmartGX does not auto-allocate it.",
      };
    }
    return {
      detectedType: "transfer_in",
      confidence: "medium",
      shouldAutoAllocate: false,
      reason: "Amount below RM1000 and no strong income pattern.",
      allocationPriority: "skip",
      aiExplanation: "This incoming transfer is treated as normal transfer-in and stays in Main Account.",
    };
  }

  if (isSalary || employerLike) {
    return {
      detectedType: "salary",
      confidence: isSalary ? "high" : "medium",
      shouldAutoAllocate: true,
      reason: "Salary/payroll/employer pattern detected.",
      allocationPriority: "apply",
      aiExplanation: "This receipt appears to be salary-related, so SmartGX applies your current allocation rule.",
    };
  }
  if (isAllowance) {
    return {
      detectedType: "allowance",
      confidence: "high",
      shouldAutoAllocate: true,
      reason: "Allowance pattern detected.",
      allocationPriority: "apply",
      aiExplanation: "This receipt appears to be allowance income, so SmartGX applies your current allocation rule.",
    };
  }
  if (isPartTime) {
    return {
      detectedType: "part_time_income",
      confidence: "medium",
      shouldAutoAllocate: true,
      reason: "Part-time wages pattern detected.",
      allocationPriority: "apply",
      aiExplanation: "This receipt appears to be part-time income, so SmartGX applies your current allocation rule.",
    };
  }
  if (isFreelance) {
    return {
      detectedType: "freelance_income",
      confidence: "medium",
      shouldAutoAllocate: true,
      reason: "Freelance/project payment pattern detected.",
      allocationPriority: "apply",
      aiExplanation: "This receipt appears to be freelance income, so SmartGX applies your current allocation rule.",
    };
  }

  if (amount >= 1500 && /cash deposit|cash income|cash/.test(h)) {
    return {
      detectedType: "cash_income",
      confidence: "medium",
      shouldAutoAllocate: true,
      reason: "Large cash-income pattern detected.",
      allocationPriority: "ask",
      aiExplanation: "This looks like a large cash income. SmartGX applies allocation with conservative confidence.",
    };
  }

  return {
    detectedType: "unknown",
    confidence: "low",
    shouldAutoAllocate: false,
    reason: "Incoming pattern is unclear.",
    allocationPriority: "skip",
    aiExplanation: "Income detected, allocation not applied due to low confidence.",
  };
}

const INCOME_AI_WAIT_MS = 2800;

export async function classifyIncomingReceipt(input: IncomingClassifierInput): Promise<IncomingClassifierResult> {
  const config = getAiConfig();
  if (!config.enabled) return classifyIncomingReceiptFallback(input);

  const remotePromise = classifyIncomingReceiptRemote(input);
  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), INCOME_AI_WAIT_MS));
  const remote = await Promise.race([remotePromise, timeoutPromise]);
  if (remote) return remote;
  return classifyIncomingReceiptFallback(input);
}
