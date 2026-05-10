/**
 * Formats notification `time` strings for display (ISO from DB, legacy app strings).
 * Uses the device local timezone. Never echoes raw ISO.
 */

function sameLocalCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function yesterdayOf(now: Date): Date {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() - 1);
  return d;
}

function formatTimeHm(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatRelativeDayLabel(d: Date, now: Date): string {
  const timePart = formatTimeHm(d);
  if (sameLocalCalendarDay(d, now)) {
    return `Today, ${timePart}`;
  }
  if (sameLocalCalendarDay(d, yesterdayOf(now))) {
    return `Yesterday, ${timePart}`;
  }
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();
  return `${day} ${month} ${year}, ${timePart}`;
}

function parseNotificationDate(raw: string): Date | null {
  const s = raw.trim();
  if (/^just now$/i.test(s)) {
    return new Date();
  }
  if (/·\s*now$/i.test(s)) {
    return new Date();
  }

  const normalized = s.replace(/·/g, " ").replace(/\s+/g, " ").trim();

  let t = Date.parse(normalized);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // "YYYY-MM-DD · HH:mm" or "YYYY-MM-DD HH:mm" (UTC-agnostic local interpretation)
  const ymdHm = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(normalized);
  if (ymdHm) {
    const [, y, mo, day, h, mi, sec] = ymdHm;
    const d = new Date(
      Number(y),
      Number(mo) - 1,
      Number(day),
      Number(h),
      Number(mi),
      sec != null ? Number(sec) : 0
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Date-only ISO / app date fragment
  const ymdOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (ymdOnly) {
    const [, y, mo, day] = ymdOnly;
    const d = new Date(Number(y), Number(mo) - 1, Number(day), 12, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function looksLikeRawIsoDbString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s.trim());
}

/**
 * Safe display string for Notifications list / detail.
 * Invalid or unparseable ISO-like values fall back to "--" instead of showing raw ISO.
 */
export function formatNotificationTimestamp(timestamp: string | undefined | null, referenceNow?: Date): string {
  if (timestamp == null) return "--";
  const s = String(timestamp).trim();
  if (!s) return "--";

  const now = referenceNow ?? new Date();
  const parsed = parseNotificationDate(s);

  if (parsed) {
    return formatRelativeDayLabel(parsed, now);
  }

  if (looksLikeRawIsoDbString(s)) {
    const t = Date.parse(s.trim());
    if (!Number.isNaN(t)) {
      const d = new Date(t);
      if (!Number.isNaN(d.getTime())) {
        return formatRelativeDayLabel(d, now);
      }
    }
    return "--";
  }

  // Legacy human-readable copy (mock / in-app strings) — not raw ISO
  return s;
}
