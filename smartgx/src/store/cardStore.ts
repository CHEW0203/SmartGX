import { create } from "zustand";

export interface CardControls {
  frozen: boolean;
  onlinePayment: boolean;
  overseasPayment: boolean;
  contactless: boolean;
}

export type CardType = "debit" | "flexicard";

interface CardState {
  selectedCard: CardType;
  debitControls: CardControls;
  flexiControls: CardControls;
  setSelectedCard: (card: CardType) => void;
  updateDebitControls: (partial: Partial<CardControls>) => void;
  updateFlexiControls: (partial: Partial<CardControls>) => void;
}

export const useCardStore = create<CardState>((set) => ({
  selectedCard: "debit",

  debitControls: {
    frozen: false,
    onlinePayment: true,
    overseasPayment: false,
    contactless: true,
  },

  flexiControls: {
    frozen: false,
    onlinePayment: true,
    overseasPayment: false,
    contactless: true,
  },

  setSelectedCard: (card) => set({ selectedCard: card }),

  updateDebitControls: (partial) =>
    set((s) => ({ debitControls: { ...s.debitControls, ...partial } })),

  updateFlexiControls: (partial) =>
    set((s) => ({ flexiControls: { ...s.flexiControls, ...partial } })),
}));
