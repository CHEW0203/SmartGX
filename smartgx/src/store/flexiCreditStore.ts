import { create } from "zustand";
import { randomUUIDCompat } from "../lib/uuid";
import type { BorrowPurpose, DebtReadinessResult } from "../features/flexiCredit/debtReadiness.service";
import { syncFlexi } from "../services/db/persist";

export type FlexiCreditStatus =
  | "not_applied"
  | "checking_eligibility"
  | "documents_required"
  | "under_review"
  | "approved"
  | "activated"
  | "rejected";

export type EmploymentType =
  | "salaried_employee"
  | "self_employed"
  | "business_owner"
  | "student"
  | "housewife_househusband"
  | "retiree"
  | "unemployed";

export interface FlexiCreditEligibilityInput {
  malaysianCitizen: boolean;
  hasMyKad: boolean;
  age: number;
  monthlyIncome: number;
  employmentType: EmploymentType;
  accountActive: boolean;
}

export interface FlexiCreditDocState {
  epfStatement: "not_uploaded" | "uploaded" | "verified" | "needs_review" | "rejected";
  businessBank6Months: "not_uploaded" | "uploaded" | "verified" | "needs_review" | "rejected";
  myKad: "not_uploaded" | "uploaded" | "verified" | "needs_review" | "rejected";
}

export interface FlexiCreditApplication {
  fullName: string;
  myKadNumber: string;
  age: number;
  citizenship: string;
  phoneNumber: string;
  email: string;
  employmentType: EmploymentType;
  employerOrBusinessName: string;
  monthlyIncome: number;
  industry: string;
  employmentDurationMonths: number;
  existingMonthlyCommitments: number;
  existingDebtAmount: number;
  repaymentHistoryScore: number;
  gxHealthScore: number;
  savingsBalance: number;
  desiredLimit: number;
  drawdownAmount: number;
  purpose: BorrowPurpose;
  tenureMonths: number;
  autoRepayment: boolean;
}

export interface FlexiCreditDrawdown {
  drawdownId: string;
  principalAmount: number;
  annualInterestRate: number;
  tenureMonths: number;
  estimatedInterest: number;
  totalRepayment: number;
  monthlyRepayment: number;
  remainingBalance: number;
  remainingPrincipal: number;
  paidAmount: number;
  principalPaid: number;
  interestPaid: number;
  nextDueDate: string;
  remainingMonths: number;
  purpose: BorrowPurpose;
  status: "active" | "paid" | "overdue";
  createdAt: string;
}

export interface FlexiCreditRepaymentRecord {
  id: string;
  drawdownId: string;
  amount: number;
  principalPortion: number;
  interestPortion: number;
  date: string;
}

interface FlexiCreditState {
  status: FlexiCreditStatus;
  eligibility: { ok: boolean; reasons: string[] } | null;
  docs: FlexiCreditDocState;
  application: FlexiCreditApplication | null;
  debtAnalysis: DebtReadinessResult | null;
  approvedLimit: number;
  availableLimit: number;
  outstanding: number;
  nextRepaymentDate: string | null;
  monthlyRepayment: number;
  annualInterestRate: number;
  autoRepaymentEnabled: boolean;
  safeDrawdownRecommendation: number;
  activeDrawdowns: FlexiCreditDrawdown[];
  repaymentHistory: FlexiCreditRepaymentRecord[];
  setStatus: (status: FlexiCreditStatus) => void;
  setEligibility: (eligibility: { ok: boolean; reasons: string[] }) => void;
  uploadDocument: (doc: keyof FlexiCreditDocState) => void;
  setDocumentStatus: (doc: keyof FlexiCreditDocState, status: FlexiCreditDocState[keyof FlexiCreditDocState]) => void;
  saveApplication: (application: FlexiCreditApplication) => void;
  setDebtAnalysis: (analysis: DebtReadinessResult) => void;
  setApproval: (approvedLimit: number, status: "approved" | "rejected" | "documents_required") => void;
  activate: () => void;
  setSafeDrawdownRecommendation: (amount: number) => void;
  drawdown: (amount: number, purpose: BorrowPurpose, tenureMonths: number, annualInterestRate?: number) => void;
  repay: (amount: number, drawdownId?: string) => void;
  toggleAutoRepayment: () => void;
}

export const useFlexiCreditStore = create<FlexiCreditState>((set) => ({
  status: "not_applied",
  eligibility: null,
  docs: { epfStatement: "not_uploaded", businessBank6Months: "not_uploaded", myKad: "not_uploaded" },
  application: null,
  debtAnalysis: null,
  approvedLimit: 0,
  availableLimit: 0,
  outstanding: 0,
  nextRepaymentDate: null,
  monthlyRepayment: 0,
  annualInterestRate: 0.06,
  autoRepaymentEnabled: true,
  safeDrawdownRecommendation: 0,
  activeDrawdowns: [],
  repaymentHistory: [],
  setStatus: (status) => {
    set({ status });
    syncFlexi();
  },
  setEligibility: (eligibility) => {
    set({ eligibility });
    syncFlexi();
  },
  uploadDocument: (doc) => {
    set((s) => ({ docs: { ...s.docs, [doc]: "uploaded" } }));
    syncFlexi();
  },
  setDocumentStatus: (doc, status) => {
    set((s) => ({ docs: { ...s.docs, [doc]: status } }));
    syncFlexi();
  },
  saveApplication: (application) => {
    set({ application, status: "under_review" });
    syncFlexi();
  },
  setDebtAnalysis: (analysis) => {
    set({ debtAnalysis: analysis });
    syncFlexi();
  },
  setApproval: (approvedLimit, status) => {
    set({
      status: status === "approved" ? "approved" : status === "documents_required" ? "documents_required" : "rejected",
      approvedLimit: status === "approved" ? approvedLimit : 0,
      availableLimit: status === "approved" ? approvedLimit : 0,
    });
    syncFlexi();
  },
  activate: () => {
    set((s) => ({
      status: s.status === "approved" ? "activated" : s.status,
      safeDrawdownRecommendation:
        s.safeDrawdownRecommendation > 0
          ? s.safeDrawdownRecommendation
          : Math.round((s.availableLimit * 0.75) * 100) / 100,
    }));
    syncFlexi();
  },
  setSafeDrawdownRecommendation: (amount) => {
    set({ safeDrawdownRecommendation: Math.max(0, Math.round(amount * 100) / 100) });
    syncFlexi();
  },
  drawdown: (amount, purpose, tenureMonths, annualInterestRate) => {
    set((s) => {
      if (amount <= 0 || amount > s.availableLimit || tenureMonths <= 0) return s;
      const rate = annualInterestRate ?? s.annualInterestRate;
      const estimatedInterest = Math.round((amount * rate * (tenureMonths / 12)) * 100) / 100;
      const totalRepayment = Math.round((amount + estimatedInterest) * 100) / 100;
      const monthlyRepayment = Math.round((totalRepayment / tenureMonths) * 100) / 100;
      const nowIso = new Date().toISOString();
      const nextDueDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
      const drawdown: FlexiCreditDrawdown = {
        drawdownId: randomUUIDCompat(),
        principalAmount: amount,
        annualInterestRate: rate,
        tenureMonths,
        estimatedInterest,
        totalRepayment,
        monthlyRepayment,
        remainingBalance: totalRepayment,
        remainingPrincipal: amount,
        paidAmount: 0,
        principalPaid: 0,
        interestPaid: 0,
        nextDueDate,
        remainingMonths: tenureMonths,
        purpose,
        status: "active",
        createdAt: nowIso,
      };
      const nextDrawdowns = [drawdown, ...s.activeDrawdowns];
      const nextOutstanding = Math.round(nextDrawdowns.reduce((sum, d) => sum + d.remainingBalance, 0) * 100) / 100;
      const nextMonthly = Math.round(nextDrawdowns.reduce((sum, d) => sum + (d.status === "active" ? d.monthlyRepayment : 0), 0) * 100) / 100;
      return {
        outstanding: nextOutstanding,
        availableLimit: Math.max(0, Math.round((s.availableLimit - amount) * 100) / 100),
        nextRepaymentDate: nextDrawdowns.find((d) => d.status === "active")?.nextDueDate ?? null,
        monthlyRepayment: nextMonthly,
        activeDrawdowns: nextDrawdowns,
      };
    });
    syncFlexi();
  },
  repay: (amount, drawdownId) => {
    set((s) => {
      if (amount <= 0 || s.outstanding <= 0) return s;
      const active = s.activeDrawdowns.filter((d) => d.status === "active");
      if (active.length === 0) return s;
      const target =
        (drawdownId && active.find((d) => d.drawdownId === drawdownId)) ||
        [...active].sort((a, b) => Date.parse(a.nextDueDate) - Date.parse(b.nextDueDate))[0];
      if (!target) return s;
      const paid = Math.min(amount, target.remainingBalance);
      if (paid <= 0) return s;
      const interestRatio = target.estimatedInterest / Math.max(0.01, target.totalRepayment);
      const interestPortion = Math.round(Math.min(target.remainingBalance, paid) * interestRatio * 100) / 100;
      const principalPortion = Math.round((paid - interestPortion) * 100) / 100;

      const updatedDrawdowns = s.activeDrawdowns.map((d) => {
        if (d.drawdownId !== target.drawdownId) return d;
        const nextRemainingBalance = Math.max(0, Math.round((d.remainingBalance - paid) * 100) / 100);
        const nextRemainingPrincipal = Math.max(0, Math.round((d.remainingPrincipal - principalPortion) * 100) / 100);
        const nextRemainingMonths = nextRemainingBalance <= 0 ? 0 : Math.max(1, d.remainingMonths - 1);
        return {
          ...d,
          remainingBalance: nextRemainingBalance,
          remainingPrincipal: nextRemainingPrincipal,
          paidAmount: Math.round((d.paidAmount + paid) * 100) / 100,
          principalPaid: Math.round((d.principalPaid + principalPortion) * 100) / 100,
          interestPaid: Math.round((d.interestPaid + interestPortion) * 100) / 100,
          remainingMonths: nextRemainingMonths,
          nextDueDate:
            nextRemainingBalance <= 0
              ? d.nextDueDate
              : new Date(Date.parse(d.nextDueDate) + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10),
          status: (nextRemainingBalance <= 0 ? "paid" : "active") as FlexiCreditDrawdown["status"],
        };
      });

      const nextOutstanding = Math.round(updatedDrawdowns.reduce((sum, d) => sum + d.remainingBalance, 0) * 100) / 100;
      const nextMonthly = Math.round(
        updatedDrawdowns.reduce((sum, d) => sum + (d.status === "active" ? d.monthlyRepayment : 0), 0) * 100
      ) / 100;
      return {
        outstanding: nextOutstanding,
        availableLimit: Math.min(s.approvedLimit, Math.round((s.availableLimit + principalPortion) * 100) / 100),
        monthlyRepayment: nextMonthly,
        nextRepaymentDate:
          updatedDrawdowns
            .filter((d) => d.status === "active")
            .sort((a, b) => Date.parse(a.nextDueDate) - Date.parse(b.nextDueDate))[0]?.nextDueDate ?? null,
        activeDrawdowns: updatedDrawdowns,
        repaymentHistory: [
          {
            id: randomUUIDCompat(),
            drawdownId: target.drawdownId,
            amount: paid,
            principalPortion,
            interestPortion,
            date: new Date().toISOString(),
          },
          ...s.repaymentHistory,
        ],
      };
    });
    syncFlexi();
  },
  toggleAutoRepayment: () => {
    set((s) => ({ autoRepaymentEnabled: !s.autoRepaymentEnabled }));
    syncFlexi();
  },
}));

