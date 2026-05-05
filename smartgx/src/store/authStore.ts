import { create } from "zustand";
import { mockAuthUsers } from "../data/mockAuth";
import type { AuthUser, LoginPayload, RegisterPayload } from "../types/auth";

interface AuthState {
  currentUser: AuthUser | null;
  users: AuthUser[];
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => { ok: boolean; message?: string };
  register: (payload: RegisterPayload) => { ok: boolean; message?: string };
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  users: mockAuthUsers,
  isAuthenticated: false,
  login: ({ email, password }) => {
    const user = get().users.find(
      (item) =>
        item.email.trim().toLowerCase() === email.trim().toLowerCase() &&
        item.password === password
    );

    if (!user) {
      return { ok: false, message: "Invalid email or password." };
    }

    set({ currentUser: user, isAuthenticated: true });
    return { ok: true };
  },
  register: (payload) => {
    const exists = get().users.some(
      (item) => item.email.trim().toLowerCase() === payload.email.trim().toLowerCase()
    );

    if (exists) {
      return { ok: false, message: "Email already exists." };
    }

    const newUser: AuthUser = {
      id: `u-${Date.now()}`,
      name: payload.name,
      email: payload.email,
      password: payload.password,
      userType: payload.userType,
      monthlyIncome: payload.monthlyIncome,
    };

    set((state) => ({
      users: [...state.users, newUser],
      currentUser: newUser,
      isAuthenticated: true,
    }));

    return { ok: true };
  },
  logout: () => set({ currentUser: null, isAuthenticated: false }),
}));
