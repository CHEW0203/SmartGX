import { weakPinReason } from "../security/pin.rules";
import type { LoginInput, RegisterInput } from "./auth.types";

export type ValidationErrors<T extends string> = Partial<Record<T, string>>;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const malaysiaMobileRegex = /^(\+60|601|01)\d{7,9}$/;

export const validateLoginInput = (
  input: LoginInput
): ValidationErrors<"emailOrMobile" | "password"> => {
  const errors: ValidationErrors<"emailOrMobile" | "password"> = {};
  if (!input.emailOrMobile.trim())
    errors.emailOrMobile = "Email or mobile number is required.";
  if (!input.password.trim()) errors.password = "Password is required.";
  else if (input.password.length < 8)
    errors.password = "Password must be at least 8 characters.";
  return errors;
};

export const validateRegisterInput = (
  input: RegisterInput
): ValidationErrors<
  "fullName" | "mobileNumber" | "email" | "password" | "confirmPassword"
> => {
  const errors: ValidationErrors<
    "fullName" | "mobileNumber" | "email" | "password" | "confirmPassword"
  > = {};

  if (!input.fullName.trim()) errors.fullName = "Full legal name is required.";

  const mobile = input.mobileNumber.replace(/\s/g, "");
  if (!mobile) errors.mobileNumber = "Mobile number is required.";
  else if (!malaysiaMobileRegex.test(mobile))
    errors.mobileNumber = "Use Malaysian format: +60 or 01.";

  if (!input.email.trim()) errors.email = "Email is required.";
  else if (!emailRegex.test(input.email)) errors.email = "Enter a valid email address.";

  if (!input.password.trim()) errors.password = "Password is required.";
  else if (input.password.length < 8)
    errors.password = "Password must be at least 8 characters.";

  if (input.confirmPassword !== input.password)
    errors.confirmPassword = "Passwords do not match.";

  return errors;
};

export const validateOtp = (otp: string): string | null => {
  if (otp.length !== 6) return "Enter all 6 digits.";
  if (!/^\d{6}$/.test(otp)) return "OTP must be 6 digits.";
  return null;
};

export const validatePasscode = (passcode: string, confirm: string): string | null => {
  const weak = weakPinReason(passcode);
  if (weak) return weak;
  if (passcode !== confirm) return "Passcodes do not match.";
  return null;
};
