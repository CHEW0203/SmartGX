/** 6-digit app PIN validation for SmartGX (shared setup + change flows). */

const BLOCKED = new Set(["000000", "111111", "123456", "654321", "121212", "112233", "101010"]);

export function pinFormatError(pin: string): string | null {
  if (!pin || pin.length !== 6) return "Enter all 6 digits.";
  if (!/^\d{6}$/.test(pin)) return "PIN must be digits only.";
  return null;
}

function allSameDigit(pin: string): boolean {
  return /^(\d)\1{5}$/.test(pin);
}

function isSequential(pin: string): boolean {
  const d = pin.split("").map(Number);
  let inc = true;
  let dec = true;
  for (let i = 1; i < d.length; i += 1) {
    if (d[i] !== d[i - 1] + 1) inc = false;
    if (d[i] !== d[i - 1] - 1) dec = false;
  }
  return inc || dec;
}

/** Returns user-facing error message if PIN is too weak, else null. */
export function weakPinReason(pin: string): string | null {
  const fmt = pinFormatError(pin);
  if (fmt) return fmt;
  if (BLOCKED.has(pin)) return "This PIN is too easy to guess. Choose a stronger PIN.";
  if (allSameDigit(pin)) return "Avoid PINs with all identical digits.";
  if (isSequential(pin)) return "Avoid sequential PINs.";
  return null;
}

export function validateNewPin(pin: string, confirm: string, currentPin?: string): string | null {
  const w = weakPinReason(pin);
  if (w) return w;
  if (pin !== confirm) return "PINs do not match.";
  if (currentPin !== undefined && pin === currentPin) return "New PIN must be different from your current PIN.";
  return null;
}
