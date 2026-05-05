export type UserType = "student" | "fresh_graduate";

export interface User {
  id: string;
  name: string;
  email: string;
  monthlyIncome: number;
  userType: UserType;
}
