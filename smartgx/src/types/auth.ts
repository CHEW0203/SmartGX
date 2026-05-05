import type { User, UserType } from "./user";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  userType: UserType;
  monthlyIncome: number;
}

export interface AuthUser extends User {
  password: string;
}
