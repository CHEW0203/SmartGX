/**
 * Post-process SmartGX AI text so money is always expressed in Malaysian Ringgit.
 * Conservative patterns only — avoids touching "$" in non-currency contexts when possible.
 */

/** Match $ or USD prefix amounts; "1,234.50" style */
const LEADING_MONEY = /(?:USD\s*|\$)\s*(\d[\d,]*(?:\.\d{1,2})?)/gi;
/** Trailing "dollars" / "usd" after a number */
const TRAILING_DOLLARS = /(\d[\d,]*(?:\.\d{1,2})?)\s*(?:US\s*)?dollars?\b/gi;

export function sanitizeAiCurrencyToRM(text: string): string {
  if (!text) return text;
  let s = text.replace(LEADING_MONEY, (_, num: string) => `RM${num}`);
  s = s.replace(TRAILING_DOLLARS, (_, num: string) => `RM${num}`);
  return s;
}
