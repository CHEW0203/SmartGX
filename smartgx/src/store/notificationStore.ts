import { create } from "zustand";
import type { AppNotification } from "../types/notification";
import { pushToastFromNotification } from "./toastFromNotification";
import { randomUUIDCompat } from "../lib/uuid";
import { deleteNotificationDb, getAuthUserId, syncNotification } from "../services/db/persist";

const NUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification:    (notif: AppNotification) => void;
  deleteNotification: (id: string) => void;
  clearAll:           () => void;
  markAsRead:         (id: string) => void;
  markAllAsRead:      () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount:   0,

  addNotification: (notif) => {
    const id = NUUID.test(notif.id) ? notif.id : randomUUIDCompat();
    const next = { ...notif, id };
    pushToastFromNotification({
      id: next.id,
      title: next.title,
      message: next.message,
      type: next.type,
      linkedScreen: next.linkedScreen,
    });
    set((s) => ({
      notifications: [next, ...s.notifications],
      unreadCount:   s.unreadCount + (next.read ? 0 : 1),
    }));
    syncNotification(next);
  },

  deleteNotification: (id) => {
    const uid = getAuthUserId();
    if (uid) void deleteNotificationDb(uid, id);
    set((s) => {
      const updated = s.notifications.filter((n) => n.id !== id);
      return { notifications: updated, unreadCount: updated.filter((n) => !n.read).length };
    });
  },

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  markAsRead: (id) =>
    set((s) => {
      const updated = s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      const n = updated.find((x) => x.id === id);
      if (n) syncNotification(n);
      return { notifications: updated, unreadCount: updated.filter((x) => !x.read).length };
    }),

  markAllAsRead: () =>
    set((s) => {
      const next = s.notifications.map((n) => ({ ...n, read: true }));
      next.forEach((n) => syncNotification(n));
      return { notifications: next, unreadCount: 0 };
    }),
}));
