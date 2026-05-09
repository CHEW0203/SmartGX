import { sha256Hex } from "../../lib/hash";

export async function hashAppPin(authUserId: string, pin: string): Promise<string> {
  const payload = `${authUserId}:${pin}`;
  return Promise.resolve(sha256Hex(payload));
}

export async function verifyAppPin(authUserId: string, pin: string, storedHash: string | null): Promise<boolean> {
  if (!storedHash) return false;
  const h = await hashAppPin(authUserId, pin);
  return h === storedHash;
}
