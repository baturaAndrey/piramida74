/**
 * Date helpers for the club, which lives in Asia/Yekaterinburg (Челябинск, UTC+5).
 *
 * Framework-free (no `next/*`, React or DB imports) so it is safe to use from
 * Server Actions, server modules and `"use client"` components alike.
 *
 * Only the built-in `Intl` API is used. The TZ offset is always derived via
 * `Intl` (never hard-coded), so results do not depend on the host machine's
 * timezone. Month names are spelled out manually in the genitive case so the
 * output is deterministic regardless of the Node/ICU build.
 */

export const TZ = "Asia/Yekaterinburg";
/** Операционные сутки начинаются в 09:00 */
const OP_DAY_START_HOUR = 9;
const OP_DAY_START_MIN = OP_DAY_START_HOUR * 60;
const DAY_MIN = 1440;

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Wall-clock components of `date` as seen in {@link TZ}. */
function wallParts(date: Date): WallParts {
  const o: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(date)) {
    if (p.type !== "literal") o[p.type] = Number(p.value);
  }
  return {
    year: o.year ?? 1970,
    month: o.month ?? 1,
    day: o.day ?? 1,
    // Some ICU builds render midnight as "24" even with h23 — normalise.
    hour: (o.hour ?? 0) % 24,
    minute: o.minute ?? 0,
    second: o.second ?? 0,
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

/** Календарная дата в Екатеринбурге, YYYY-MM-DD */
export function getToday(now: Date = new Date()): string {
  const p = wallParts(now);
  return isoOf(p.year, p.month, p.day);
}

/** Дата операционных суток: до 09:00 (по Екатеринбургу) считается предыдущий день */
export function getOpDate(now: Date = new Date()): string {
  const p = wallParts(now);
  if (p.hour >= OP_DAY_START_HOUR) return isoOf(p.year, p.month, p.day);
  // Date.UTC normalises day 0 into the last day of the previous month/year.
  const prev = new Date(Date.UTC(p.year, p.month - 1, p.day - 1));
  return isoOf(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate());
}

const MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

function splitIso(iso: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new RangeError(`Invalid date: ${iso}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** "5 марта" | "5–7 марта" | "30 марта – 2 апреля" (без года; en dash) */
export function formatEventDate(start: string, end?: string | null): string {
  const s = splitIso(start);
  const monthOf = (m: number) => MONTHS_GEN[m - 1] ?? "";
  if (!end || end === start) return `${s.d} ${monthOf(s.m)}`;
  const e = splitIso(end);
  if (s.y === e.y && s.m === e.m) return `${s.d}–${e.d} ${monthOf(s.m)}`;
  return `${s.d} ${monthOf(s.m)} – ${e.d} ${monthOf(e.m)}`;
}

/** Минуты операционных суток → часы: 0 → "09:00", 960 → "01:00", 1020 → "02:00" */
export function minToClock(min: number): string {
  // Double modulo keeps the result in [0, DAY_MIN) for negative inputs too.
  const total = (((OP_DAY_START_MIN + min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

/** Обратное преобразование: "09:00" → 0, "19:00" → 600, "01:00" → 960 */
export function clockToMin(hhmm: string): number {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) throw new RangeError(`Invalid time: ${hhmm}`);
  const abs = Number(match[1]) * 60 + Number(match[2]);
  return (((abs - OP_DAY_START_MIN) % DAY_MIN) + DAY_MIN) % DAY_MIN;
}

/** Смещение TZ относительно UTC (мс) в данный момент */
function tzOffsetMs(date: Date): number {
  const p = wallParts(date);
  // Wall parts have second precision, so truncate the instant to whole seconds too.
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
    Math.floor(date.getTime() / 1000) * 1000
  );
}

/** Значение <input type="datetime-local"> ("2026-12-05T19:30") как время Екатеринбурга → Date (UTC-момент) */
export function parseLocalDateTime(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) throw new RangeError(`Invalid datetime-local value: ${value}`);
  const asUtc = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? 0)
  );
  let t = asUtc - tzOffsetMs(new Date(asUtc));
  t = asUtc - tzOffsetMs(new Date(t)); // второй проход на случай смены смещения
  return new Date(t);
}
