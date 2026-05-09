import { create } from "zustand";

export type RecipientChannel = "smartgx" | "bank" | "duitnow" | "recent";
export type DuitNowIdType = "mobile" | "nric" | "passport" | "army" | "business";

export interface StoredRecipient {
  id:             string;
  name:           string;
  /** Account number, mobile, NRIC, etc. */
  identifier:     string;
  /** Human-readable label for the identifier */
  identifierLabel: string;
  channel:        RecipientChannel;
  bankName?:      string;
  lastUsed:       string;
  isFavourite:    boolean;
}

interface RecipientState {
  recentRecipients: StoredRecipient[];
  addRecipient:     (r: StoredRecipient) => void;
  markUsed:         (id: string) => void;
  toggleFavourite:  (id: string) => void;
}

/** Seed recipients so Recent list isn't empty on first launch */
const SEED_RECIPIENTS: StoredRecipient[] = [
  {
    id:              "seed-1",
    name:            "Ahmad Danial",
    identifier:      "••••1234",
    identifierLabel: "Maybank • ••••1234",
    channel:         "bank",
    bankName:        "Maybank",
    lastUsed:        "2026-05-06",
    isFavourite:     false,
  },
  {
    id:              "seed-2",
    name:            "Nurul Ain",
    identifier:      "+6011-2233 4455",
    identifierLabel: "DuitNow • Mobile",
    channel:         "duitnow",
    lastUsed:        "2026-05-04",
    isFavourite:     false,
  },
];

export const useRecipientStore = create<RecipientState>((set, get) => ({
  recentRecipients: SEED_RECIPIENTS,

  addRecipient: (r) => {
    const existing = get().recentRecipients.find(
      (x) => x.identifier === r.identifier && x.channel === r.channel
    );
    if (existing) {
      set((s) => ({
        recentRecipients: s.recentRecipients.map((x) =>
          x.id === existing.id ? { ...x, lastUsed: r.lastUsed } : x
        ),
      }));
    } else {
      set((s) => ({ recentRecipients: [r, ...s.recentRecipients] }));
    }
  },

  markUsed: (id) => {
    set((s) => ({
      recentRecipients: s.recentRecipients.map((r) =>
        r.id === id ? { ...r, lastUsed: new Date().toISOString().slice(0, 10) } : r
      ),
    }));
  },

  toggleFavourite: (id) => {
    set((s) => ({
      recentRecipients: s.recentRecipients.map((r) =>
        r.id === id ? { ...r, isFavourite: !r.isFavourite } : r
      ),
    }));
  },
}));
