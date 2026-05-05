import type { User } from "../types/user";

export const mockUsers: User[] = [
  {
    id: "u-student-001",
    name: "Jason Tan",
    email: "jason@student.my",
    monthlyIncome: 1200,
    userType: "student",
  },
  {
    id: "u-freshgrad-001",
    name: "Aina Rahman",
    email: "aina@freshgrad.my",
    monthlyIncome: 3000,
    userType: "fresh_graduate",
  },
];
