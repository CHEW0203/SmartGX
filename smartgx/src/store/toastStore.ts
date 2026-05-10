import { create } from "zustand";

/** In-app toast (backed separately from persisted notifications). */
export interface ToastPayload {
  id: string;
  title: string;
  message: string;
  type: ToastVisualType;
  linkedScreen?: string;
}

export type ToastVisualType =
  | "success"
  | "warning"
  | "risk"
  | "danger"
  | "security"
  | "reward"
  | "campaign"
  | "info";

interface ToastState {
  current: ToastPayload | null;
  queue: ToastPayload[];
  enqueue: (p: Omit<ToastPayload, "id"> & { id?: string }) => void;
  dequeue: () => void;
}

export const mapNotificationTypeToToast = (t: string): ToastVisualType => {
  if (t === "alert" || t === "warning") return "warning";
  if (t === "risk") return "risk";
  if (t === "challenge_overtake") return "danger";
  if (t === "security") return "security";
  if (t === "reward") return "reward";
  if (t === "campaign" || t === "challenge") return "campaign";
  if (t === "success") return "success";
  if (t === "insight") return "info";
  return "info";
};

export const useToastStore = create<ToastState>((set, get) => ({
  current: null,
  queue: [],
  enqueue: (p) => {
    const id = p.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: ToastPayload = {
      id,
      title: p.title,
      message: p.message,
      type: p.type,
      linkedScreen: p.linkedScreen,
    };
    const { current, queue } = get();
    if (!current) {
      set({ current: item });
    } else {
      set({ queue: [...queue.slice(-4), item] });
    }
  },
  dequeue: () => {
    const { queue } = get();
    const [next, ...rest] = queue;
    set({ current: next ?? null, queue: rest });
  },
}));
