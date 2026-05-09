import { create } from "zustand";
import { randomUUIDCompat } from "../lib/uuid";
import type { AppActivity } from "../types/activity";
import { getAuthUserId, syncActivity } from "../services/db/persist";

const AUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ActivityState {
  activities: AppActivity[];
  addActivity: (activity: AppActivity) => void;
  clearActivities: () => void;
}

export const useActivityStore = create<ActivityState>((set) => ({
  activities: [],
  addActivity: (activity) => {
    const id = AUUID.test(activity.id) ? activity.id : randomUUIDCompat();
    const next = { ...activity, id };
    set((s) => ({
      activities: [next, ...s.activities],
    }));
    const uid = getAuthUserId();
    if (uid) syncActivity(next);
  },
  clearActivities: () => set({ activities: [] }),
}));

