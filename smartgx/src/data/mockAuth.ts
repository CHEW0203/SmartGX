import type { AuthUser } from "../types/auth";

export const mockAuthUsers: AuthUser[] = [
  {
    id: "u-student-001",
    name: "Jason Tan",
    email: "jason@student.my",
    password: "password123",
    monthlyIncome: 1200,
    userType: "student",
  },
  {
    id: "u-freshgrad-001",
    name: "Aina Rahman",
    email: "aina@freshgrad.my",
    password: "password123",
    monthlyIncome: 3000,
    userType: "fresh_graduate",
  },
];
