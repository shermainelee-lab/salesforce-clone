import { optionLabel, type FieldDef } from "./objects";

/** Time zone used to show and enter date-times (server renders, so this is app-wide). */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "UTC";
const LOCALE = "en-US";
const CURRENCY = process.env.APP_CURRENCY || "USD";

export function formatCurrency(v: unknown, compact = false): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(n);
}

export function formatNumber(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : new Intl.NumberFormat(LOCALE).format(n);
}

export function formatDate(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  // plain dates (YYYY-MM-DD) are calendar dates: format in UTC so they never shift a day
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T00:00:00Z") : new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const tz = s.length === 10 ? "UTC" : APP_TIMEZONE;
  return d.toLocaleDateString(LOCALE, { timeZone: tz, year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString(LOCALE, {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatFieldText(field: FieldDef, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  switch (field.type) {
    case "currency":
      return formatCurrency(value);
    case "number":
      return formatNumber(value);
    case "percent":
      return `${value}%`;
    case "date":
      return formatDate(value);
    case "datetime":
      return formatDateTime(value);
    case "picklist":
      return optionLabel(field, value);
    case "boolean":
      return value ? "Yes" : "No";
    default:
      return String(value);
  }
}

// ---------------------------------------------------------------------------
// datetime-local <-> UTC conversion in APP_TIMEZONE
// ---------------------------------------------------------------------------
function zonedParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  return m;
}

function offsetMinutes(date: Date, tz: string) {
  const m = zonedParts(date, tz);
  const asUtc = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** "2026-11-20T09:30" entered in APP_TIMEZONE -> ISO string in UTC */
export function localInputToUtc(local: string, tz = APP_TIMEZONE): string | null {
  const s = local.length === 16 ? local + ":00Z" : local.length === 19 ? local + "Z" : local;
  const guess = new Date(s);
  if (Number.isNaN(guess.getTime())) return null;
  const first = offsetMinutes(guess, tz);
  const candidate = new Date(guess.getTime() - first * 60000);
  const second = offsetMinutes(candidate, tz); // handles DST boundaries
  return new Date(guess.getTime() - second * 60000).toISOString();
}

/** ISO timestamp -> "YYYY-MM-DDTHH:mm" in APP_TIMEZONE for <input type="datetime-local"> */
export function utcToLocalInput(iso: unknown, tz = APP_TIMEZONE): string {
  if (!iso) return "";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "";
  const m = zonedParts(d, tz);
  return `${m.year}-${m.month}-${m.day}T${m.hour}:${m.minute}`;
}
