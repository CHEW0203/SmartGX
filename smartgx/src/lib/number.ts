export function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeScore(value: unknown, fallback = 70): number {
  return Math.round(clamp(safeNumber(value, fallback), 0, 100));
}

export function normalizeSmartScore(value: unknown, fallback = 420): number {
  return Math.round(clamp(safeNumber(value, fallback), 0, 1000));
}
