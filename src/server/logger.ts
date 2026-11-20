/** Structured JSON log line (RNF-04). Never pass customer message text here (RNF-07). */
export function log(level: "info" | "warn" | "error", event: string, data: Record<string, unknown> = {}) {
  if (process.env.VITEST && !process.env.LOG_IN_TESTS) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...data });
  if (level === "error") console.error(line);
  else console.log(line);
}

/** Masks a phone for stdout logs: 5511976341183 → 55119****1183 */
export function mask(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.length > 8 ? phone.slice(0, 5) + "****" + phone.slice(-4) : "****";
}
