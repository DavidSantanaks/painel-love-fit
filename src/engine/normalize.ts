/** RF-08: lowercase, strip accents, trim, collapse spaces. */
export function normalizeText(input: string | null | undefined): string {
  return (input ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes a phone number to Brazilian E.164 digits (no "+").
 * "(11) 97634-1183", "11976341183" and "5511976341183" → "5511976341183".
 * Returns null when the input cannot be a valid phone (too few digits).
 */
export function normalizePhone(input: string | null | undefined): string | null {
  let digits = (input ?? "").split("@")[0].replace(/\D/g, "");
  digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  if (digits.length < 12 || digits.length > 15) return null;
  return digits;
}

/**
 * Brazilian mobile numbers may appear with or without the extra 9.
 * Returns every equivalent form of a normalized number (always includes itself).
 */
export function phoneVariants(normalized: string): string[] {
  const out = new Set<string>([normalized]);
  if (normalized.startsWith("55")) {
    const ddd = normalized.slice(2, 4);
    const rest = normalized.slice(4);
    if (rest.length === 9 && rest.startsWith("9")) out.add(`55${ddd}${rest.slice(1)}`);
    if (rest.length === 8) out.add(`55${ddd}9${rest}`);
  }
  return [...out];
}

/** Pretty print for the panel: +55 (11) 97634-1183 */
export function formatPhone(normalized: string | null | undefined): string {
  if (!normalized) return "—";
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(normalized);
  if (!m) return "+" + normalized;
  return `+55 (${m[1]}) ${m[2]}-${m[3]}`;
}

/** Parses a free-form pasted list (one per line, or separated by ; ,) into normalized numbers. */
export function parsePhoneList(raw: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const piece of raw.split(/[\n;,]+/)) {
    const t = piece.trim();
    if (!t) continue;
    const n = normalizePhone(t);
    if (n) valid.push(n);
    else invalid.push(t);
  }
  return { valid, invalid };
}
